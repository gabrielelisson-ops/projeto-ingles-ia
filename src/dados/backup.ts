/**
 * Backup do progresso em JSON (exportar e importar).
 *
 * - A chave da IA NUNCA entra no backup (ela fica no cofre do celular, fora do banco).
 * - Na importação, o arquivo é tratado como não confiável: tudo é validado
 *   (formato, tamanhos, valores) antes de tocar no banco, e a troca é feita numa
 *   transação. Se algo falhar no meio, nada muda.
 */
import { z } from 'zod';
import { NIVEIS } from '../conteudo/schema';
import type { Banco } from './banco';

export const APP_BACKUP = 'ingles-ia';
export const VERSAO_BACKUP = 1;
/** Tamanho máximo do arquivo aceito na importação (5 MB). */
export const TAMANHO_MAX = 5 * 1024 * 1024;

const txt = (max: number) => z.string().max(max);
const inteiro = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const data = inteiro;
const idPerfil = z.number().int().min(1).max(1_000_000);

/** Só estas preferências podem ser restauradas. */
const CONFIG_PERMITIDA: Record<string, z.ZodType<string>> = {
  sotaque: z.enum(['en-US', 'en-GB']),
  ajuste_velocidade: z.string().regex(/^(0\.[6-9]|1(\.[0-4])?)\d*$/),
  modelo_conversa: z.string().regex(/^[a-z0-9][a-z0-9.-]{2,60}$/),
  modelo_avaliacao: z.string().regex(/^[a-z0-9][a-z0-9.-]{2,60}$/),
  perfil_ativo: z.string().regex(/^\d{1,7}$/),
  lembrete_ativo: z.enum(['0', '1']),
  lembrete_hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
};

export const BackupSchema = z
  .object({
    app: z.literal(APP_BACKUP),
    versao: z.literal(VERSAO_BACKUP),
    exportado_em: data,
    perfis: z
      .array(z.object({ id: idPerfil, nome: txt(30).min(1), nivel_inicial: z.enum(NIVEIS), criado_em: data }))
      .min(1)
      .max(10),
    aulas_concluidas: z.array(z.object({ perfil_id: idPerfil, aula_id: txt(40), acertos: z.number().int().min(0).max(5), concluida_em: data })).max(5000),
    tentativas_prova: z
      .array(
        z.object({
          perfil_id: idPerfil,
          prova_id: txt(40),
          nota: z.number().int().min(0).max(100),
          aprovado: z.union([z.literal(0), z.literal(1)]),
          data,
          detalhes: txt(20000),
        }),
      )
      .max(5000),
    erros: z
      .array(z.object({ perfil_id: idPerfil, errado: txt(200), certo: txt(200), explicacao: txt(300), vezes: inteiro, ultima_vez: data }))
      .max(20000),
    revisao: z
      .array(
        z.object({
          perfil_id: idPerfil,
          item_id: txt(120),
          tipo: z.enum(['palavra', 'erro', 'frase']),
          frente: txt(300),
          verso: txt(300),
          emoji: txt(16),
          repeticoes: inteiro,
          intervalo: z.number().int().min(0).max(36500),
          facilidade: z.number().min(1.3).max(5),
          proxima: data,
        }),
      )
      .max(50000),
    atividade: z
      .array(z.object({ perfil_id: idPerfil, dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), segundos_fala: inteiro, segundos_estudo: inteiro }))
      .max(20000),
    config: z.array(z.object({ chave: txt(40), valor: txt(100) })).max(50),
  })
  .superRefine((b, ctx) => {
    const ids = new Set(b.perfis.map((p) => p.id));
    if (ids.size !== b.perfis.length) ctx.addIssue({ code: 'custom', message: 'perfis com id repetido' });
    const listas = [b.aulas_concluidas, b.tentativas_prova, b.erros, b.revisao, b.atividade] as { perfil_id: number }[][];
    if (listas.some((l) => l.some((x) => !ids.has(x.perfil_id)))) {
      ctx.addIssue({ code: 'custom', message: 'há registros de um perfil que não existe no arquivo' });
    }
    for (const c of b.config) {
      const regra = CONFIG_PERMITIDA[c.chave];
      if (regra && !regra.safeParse(c.valor).success) ctx.addIssue({ code: 'custom', message: `configuração inválida: ${c.chave}` });
    }
    try {
      for (const t of b.tentativas_prova) JSON.parse(t.detalhes);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'detalhes de prova corrompidos' });
    }
  });
export type Backup = z.infer<typeof BackupSchema>;

export async function exportarBackup(db: Banco, agora = Date.now()): Promise<Backup> {
  const todos = <T,>(sql: string) => db.getAllAsync<T>(sql, []);
  const config = await todos<{ chave: string; valor: string }>('SELECT chave, valor FROM config');
  return {
    app: APP_BACKUP,
    versao: VERSAO_BACKUP,
    exportado_em: agora,
    perfis: await todos('SELECT id, nome, nivel_inicial, criado_em FROM perfis ORDER BY id'),
    aulas_concluidas: await todos('SELECT perfil_id, aula_id, acertos, concluida_em FROM aulas_concluidas'),
    tentativas_prova: await todos('SELECT perfil_id, prova_id, nota, aprovado, data, detalhes FROM tentativas_prova ORDER BY id'),
    erros: await todos('SELECT perfil_id, errado, certo, explicacao, vezes, ultima_vez FROM erros'),
    revisao: await todos('SELECT perfil_id, item_id, tipo, frente, verso, emoji, repeticoes, intervalo, facilidade, proxima FROM revisao'),
    atividade: await todos('SELECT perfil_id, dia, segundos_fala, segundos_estudo FROM atividade'),
    config: config.filter((c) => c.chave in CONFIG_PERMITIDA),
  };
}

export type ResultadoValidacao = { ok: true; backup: Backup; resumo: string } | { ok: false; erro: string };

/** Lê o texto do arquivo e valida tudo. Não toca no banco. */
export function validarBackup(texto: string): ResultadoValidacao {
  if (texto.length > TAMANHO_MAX) return { ok: false, erro: 'O arquivo é grande demais para ser um backup deste app.' };
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false, erro: 'O arquivo não é um JSON válido.' };
  }
  const r = BackupSchema.safeParse(json);
  if (!r.success) {
    const app = (json as { app?: unknown } | null)?.app;
    if (app !== APP_BACKUP) return { ok: false, erro: 'Este arquivo não é um backup do Inglês com IA.' };
    return { ok: false, erro: `Backup inválido: ${r.error.issues[0]?.message ?? 'formato inesperado'}.` };
  }
  const b = r.data;
  const resumo = `${b.perfis.map((p) => p.nome).join(' e ')} · ${b.aulas_concluidas.length} aula(s) concluída(s) · ${b.tentativas_prova.length} prova(s) · exportado em ${new Date(b.exportado_em).toLocaleDateString('pt-BR')}`;
  return { ok: true, backup: b, resumo };
}

/** Substitui TODO o progresso deste celular pelo do backup (em uma transação). */
export async function importarBackup(db: Banco, b: Backup): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.execAsync(
      'DELETE FROM atividade; DELETE FROM revisao; DELETE FROM erros; DELETE FROM tentativas_prova; DELETE FROM aulas_concluidas; DELETE FROM perfis;',
    );
    for (const p of b.perfis) {
      await db.runAsync('INSERT INTO perfis (id, nome, nivel_inicial, criado_em) VALUES (?, ?, ?, ?)', [p.id, p.nome, p.nivel_inicial, p.criado_em]);
    }
    for (const a of b.aulas_concluidas) {
      await db.runAsync('INSERT OR REPLACE INTO aulas_concluidas (perfil_id, aula_id, acertos, concluida_em) VALUES (?, ?, ?, ?)', [a.perfil_id, a.aula_id, a.acertos, a.concluida_em]);
    }
    for (const t of b.tentativas_prova) {
      await db.runAsync('INSERT INTO tentativas_prova (perfil_id, prova_id, nota, aprovado, data, detalhes) VALUES (?, ?, ?, ?, ?, ?)', [t.perfil_id, t.prova_id, t.nota, t.aprovado, t.data, t.detalhes]);
    }
    for (const e of b.erros) {
      await db.runAsync('INSERT OR REPLACE INTO erros (perfil_id, errado, certo, explicacao, vezes, ultima_vez) VALUES (?, ?, ?, ?, ?, ?)', [e.perfil_id, e.errado, e.certo, e.explicacao, e.vezes, e.ultima_vez]);
    }
    for (const r of b.revisao) {
      await db.runAsync(
        'INSERT OR REPLACE INTO revisao (perfil_id, item_id, tipo, frente, verso, emoji, repeticoes, intervalo, facilidade, proxima) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [r.perfil_id, r.item_id, r.tipo, r.frente, r.verso, r.emoji, r.repeticoes, r.intervalo, r.facilidade, r.proxima],
      );
    }
    for (const a of b.atividade) {
      await db.runAsync('INSERT OR REPLACE INTO atividade (perfil_id, dia, segundos_fala, segundos_estudo) VALUES (?, ?, ?, ?)', [a.perfil_id, a.dia, a.segundos_fala, a.segundos_estudo]);
    }
    for (const c of b.config) {
      if (!(c.chave in CONFIG_PERMITIDA)) continue;
      await db.runAsync('INSERT OR REPLACE INTO config (chave, valor) VALUES (?, ?)', [c.chave, c.valor]);
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}
