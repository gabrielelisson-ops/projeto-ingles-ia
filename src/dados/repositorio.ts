/**
 * Leitura e gravação do progresso de cada perfil.
 * Todo SQL usa parâmetros (?), nunca texto colado, para evitar injeção.
 */
import type { Progresso, Tentativa } from '../logica/desbloqueio';
import { diaLocal } from '../logica/estatisticas';
import { novoCartao, revisar, type CartaoRevisao, type Qualidade } from '../logica/sm2';
import type { Banco } from './banco';

export type Perfil = { id: number; nome: string; nivel_inicial: string };

export const NOME_MAX = 30;
export function nomeValido(nome: string): string | null {
  const n = nome.replace(/[\u0000-\u001f]/g, '').trim();
  return n.length >= 1 && n.length <= NOME_MAX ? n : null;
}

// ---------- Perfis ----------

export async function listarPerfis(db: Banco): Promise<Perfil[]> {
  return db.getAllAsync<Perfil>('SELECT id, nome, nivel_inicial FROM perfis ORDER BY id', []);
}

export async function criarPerfil(db: Banco, nome: string, agora = Date.now()): Promise<void> {
  const n = nomeValido(nome);
  if (!n) throw new Error(`O nome precisa ter de 1 a ${NOME_MAX} letras.`);
  await db.runAsync('INSERT INTO perfis (nome, criado_em) VALUES (?, ?)', [n, agora]);
}

export async function renomearPerfil(db: Banco, id: number, nome: string): Promise<void> {
  const n = nomeValido(nome);
  if (!n) throw new Error(`O nome precisa ter de 1 a ${NOME_MAX} letras.`);
  await db.runAsync('UPDATE perfis SET nome = ? WHERE id = ?', [n, id]);
}

/** Na primeira vez que o app abre, cria os dois perfis. */
export async function garantirPerfisIniciais(db: Banco): Promise<void> {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM perfis', []);
  if ((r?.n ?? 0) === 0) {
    await criarPerfil(db, 'Gabriel');
    await criarPerfil(db, 'Esposa');
  }
}

// ---------- Progresso ----------

export async function carregarProgresso(db: Banco, perfilId: number): Promise<Progresso> {
  const aulas = await db.getAllAsync<{ aula_id: string }>(
    'SELECT aula_id FROM aulas_concluidas WHERE perfil_id = ?',
    [perfilId],
  );
  const tent = await db.getAllAsync<{ prova_id: string; nota: number; aprovado: number; data: number }>(
    'SELECT prova_id, nota, aprovado, data FROM tentativas_prova WHERE perfil_id = ?',
    [perfilId],
  );
  const provas: Record<string, Tentativa[]> = {};
  for (const t of tent) (provas[t.prova_id] ??= []).push({ nota: t.nota, aprovado: !!t.aprovado, data: t.data });
  return { aulasConcluidas: new Set(aulas.map((a) => a.aula_id)), provas };
}

export async function concluirAula(db: Banco, perfilId: number, aulaId: string, acertos: number, agora = Date.now()) {
  await db.runAsync(
    `INSERT INTO aulas_concluidas (perfil_id, aula_id, acertos, concluida_em) VALUES (?, ?, ?, ?)
     ON CONFLICT (perfil_id, aula_id) DO UPDATE SET acertos = MAX(acertos, excluded.acertos)`,
    [perfilId, aulaId, acertos, agora],
  );
}

export type TentativaSalva = Tentativa & { id: number; prova_id: string; detalhes: unknown };

export async function registrarTentativa(
  db: Banco,
  perfilId: number,
  provaId: string,
  t: Tentativa,
  detalhes: unknown,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO tentativas_prova (perfil_id, prova_id, nota, aprovado, data, detalhes) VALUES (?, ?, ?, ?, ?, ?)',
    [perfilId, provaId, Math.round(t.nota), t.aprovado ? 1 : 0, t.data, JSON.stringify(detalhes ?? {})],
  );
}

export async function listarTentativas(db: Banco, perfilId: number): Promise<TentativaSalva[]> {
  const linhas = await db.getAllAsync<{ id: number; prova_id: string; nota: number; aprovado: number; data: number; detalhes: string }>(
    'SELECT id, prova_id, nota, aprovado, data, detalhes FROM tentativas_prova WHERE perfil_id = ? ORDER BY data DESC',
    [perfilId],
  );
  return linhas.map((l) => {
    let detalhes: unknown = {};
    try {
      detalhes = JSON.parse(l.detalhes);
    } catch {
      // detalhe corrompido não impede de mostrar a nota
    }
    return { id: l.id, prova_id: l.prova_id, nota: l.nota, aprovado: !!l.aprovado, data: l.data, detalhes };
  });
}

// ---------- Erros frequentes (memória do professor) ----------

export type Correcao = { errado: string; certo: string; explicacao_pt: string };

const corta = (s: string, n: number) => s.trim().slice(0, n);

export async function registrarErros(db: Banco, perfilId: number, correcoes: Correcao[], agora = Date.now()) {
  for (const c of correcoes) {
    const errado = corta(c.errado, 200);
    const certo = corta(c.certo, 200);
    if (!errado || !certo || errado.toLowerCase() === certo.toLowerCase()) continue;
    await db.runAsync(
      `INSERT INTO erros (perfil_id, errado, certo, explicacao, vezes, ultima_vez) VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT (perfil_id, errado, certo) DO UPDATE SET vezes = vezes + 1, ultima_vez = excluded.ultima_vez,
       explicacao = excluded.explicacao`,
      [perfilId, errado, certo, corta(c.explicacao_pt, 300), agora],
    );
  }
}

export async function errosFrequentes(db: Banco, perfilId: number, limite = 5): Promise<Correcao[]> {
  const l = await db.getAllAsync<{ errado: string; certo: string; explicacao: string }>(
    'SELECT errado, certo, explicacao FROM erros WHERE perfil_id = ? ORDER BY vezes DESC, ultima_vez DESC LIMIT ?',
    [perfilId, limite],
  );
  return l.map((e) => ({ errado: e.errado, certo: e.certo, explicacao_pt: e.explicacao }));
}

// ---------- Fila de revisão ----------

export type ItemRevisao = { item_id: string; tipo: 'palavra' | 'erro' | 'frase'; frente: string; verso: string; emoji?: string };
export type CartaoSalvo = ItemRevisao & CartaoRevisao;

/** Adiciona itens novos; os que já estão na fila não são alterados. */
export async function adicionarRevisao(db: Banco, perfilId: number, itens: ItemRevisao[], agora = Date.now()) {
  const c = novoCartao(agora);
  for (const i of itens) {
    await db.runAsync(
      `INSERT OR IGNORE INTO revisao (perfil_id, item_id, tipo, frente, verso, emoji, repeticoes, intervalo, facilidade, proxima)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [perfilId, corta(i.item_id, 120), i.tipo, corta(i.frente, 300), corta(i.verso, 300), i.emoji ?? '', c.repeticoes, c.intervalo, c.facilidade, c.proxima],
    );
  }
}

export async function revisaoVencida(db: Banco, perfilId: number, agora = Date.now(), limite = 50): Promise<CartaoSalvo[]> {
  return db.getAllAsync<CartaoSalvo>(
    `SELECT item_id, tipo, frente, verso, emoji, repeticoes, intervalo, facilidade, proxima
     FROM revisao WHERE perfil_id = ? AND proxima <= ? ORDER BY proxima LIMIT ?`,
    [perfilId, agora, limite],
  );
}

export async function responderRevisao(db: Banco, perfilId: number, c: CartaoSalvo, q: Qualidade, agora = Date.now()) {
  const n = revisar(c, q, agora);
  await db.runAsync(
    'UPDATE revisao SET repeticoes = ?, intervalo = ?, facilidade = ?, proxima = ? WHERE perfil_id = ? AND item_id = ?',
    [n.repeticoes, n.intervalo, n.facilidade, n.proxima, perfilId, c.item_id],
  );
}

export async function contarRevisao(db: Banco, perfilId: number, agora = Date.now()) {
  const r = await db.getFirstAsync<{ total: number; vencidos: number }>(
    'SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN proxima <= ? THEN 1 ELSE 0 END), 0) AS vencidos FROM revisao WHERE perfil_id = ?',
    [agora, perfilId],
  );
  return { total: r?.total ?? 0, vencidos: r?.vencidos ?? 0 };
}

// ---------- Atividade (sequência de dias, minutos falados) ----------

export async function registrarAtividade(
  db: Banco,
  perfilId: number,
  { segundosFala = 0, segundosEstudo = 0 }: { segundosFala?: number; segundosEstudo?: number },
  agora = Date.now(),
) {
  const f = Math.max(0, Math.round(segundosFala));
  const e = Math.max(0, Math.round(segundosEstudo));
  await db.runAsync(
    `INSERT INTO atividade (perfil_id, dia, segundos_fala, segundos_estudo) VALUES (?, ?, ?, ?)
     ON CONFLICT (perfil_id, dia) DO UPDATE SET segundos_fala = segundos_fala + excluded.segundos_fala,
     segundos_estudo = segundos_estudo + excluded.segundos_estudo`,
    [perfilId, diaLocal(agora), f, e],
  );
}

export async function resumoAtividade(db: Banco, perfilId: number) {
  const dias = await db.getAllAsync<{ dia: string }>('SELECT dia FROM atividade WHERE perfil_id = ?', [perfilId]);
  const t = await db.getFirstAsync<{ fala: number; estudo: number }>(
    'SELECT COALESCE(SUM(segundos_fala), 0) AS fala, COALESCE(SUM(segundos_estudo), 0) AS estudo FROM atividade WHERE perfil_id = ?',
    [perfilId],
  );
  return { dias: dias.map((d) => d.dia), segundosFala: t?.fala ?? 0, segundosEstudo: t?.estudo ?? 0 };
}

// ---------- Preferências ----------

export async function lerConfig(db: Banco, chave: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM config WHERE chave = ?', [chave]);
  return r?.valor ?? null;
}

export async function gravarConfig(db: Banco, chave: string, valor: string) {
  await db.runAsync(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
    [chave, valor],
  );
}
