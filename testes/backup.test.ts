/**
 * Backup: exportar → importar devolve tudo igual; arquivos estranhos ou
 * adulterados são recusados sem mexer no banco.
 */
import { exportarBackup, importarBackup, validarBackup, type Backup } from '../src/dados/backup';
import { migrar, type Banco, type Valor } from '../src/dados/banco';
import * as repo from '../src/dados/repositorio';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

function bancoDeTeste(): Banco {
  const d = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => void d.exec(sql),
    runAsync: async (sql: string, p: Valor[]) => d.prepare(sql).run(...p),
    getAllAsync: async (sql: string, p: Valor[]) => d.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, p: Valor[]) => d.prepare(sql).get(...p) ?? null,
  };
}

async function bancoComDados() {
  const db = bancoDeTeste();
  await migrar(db);
  await repo.garantirPerfisIniciais(db);
  await repo.renomearPerfil(db, 2, 'Ana');
  await repo.concluirAula(db, 1, 'a1-u01-l1', 5, 1000);
  await repo.registrarTentativa(db, 2, 'a1-u01-prova', { nota: 82, aprovado: true, data: 2000 }, { partes: { leitura: 90 } });
  await repo.registrarErros(db, 1, [{ errado: 'I am engineer', certo: 'I am an engineer', explicacao_pt: 'artigo' }], 3000);
  await repo.adicionarRevisao(db, 1, [{ item_id: 'w:hello', tipo: 'palavra', frente: 'hello', verso: 'olá', emoji: '👋' }], 4000);
  await repo.registrarAtividade(db, 1, { segundosFala: 60, segundosEstudo: 600 }, new Date(2026, 9, 24, 10).getTime());
  await repo.gravarConfig(db, 'sotaque', 'en-GB');
  await repo.gravarConfig(db, 'coisa_estranha', 'x');
  return db;
}

test('exportar e importar num celular novo devolve tudo igual (sem a chave da IA)', async () => {
  const origem = await bancoComDados();
  const backup = await exportarBackup(origem, 5000);
  const texto = JSON.stringify(backup);
  expect(texto).not.toMatch(/AIza|api[_-]?key|gemini_api_key/i);
  expect(backup.config.map((c) => c.chave)).toEqual(['sotaque']);

  const destino = bancoDeTeste();
  await migrar(destino);
  await repo.garantirPerfisIniciais(destino);
  await repo.concluirAula(destino, 1, 'a1-u05-l1', 5); // progresso antigo do destino é substituído
  const v = validarBackup(texto);
  expect(v.ok).toBe(true);
  if (!v.ok) return;
  expect(v.resumo).toContain('Gabriel e Ana');
  await importarBackup(destino, v.backup);
  expect(await exportarBackup(destino, 5000)).toEqual(backup);
  expect([...(await repo.carregarProgresso(destino, 1)).aulasConcluidas]).toEqual(['a1-u01-l1']);
});

test('recusa arquivos que não são backup ou estão adulterados', async () => {
  const backup = await exportarBackup(await bancoComDados());
  const comAlteracao = (f: (b: Backup) => unknown) => validarBackup(JSON.stringify(f(structuredClone(backup))));
  expect(validarBackup('isto não é json')).toMatchObject({ ok: false, erro: expect.stringContaining('JSON') });
  expect(validarBackup('{"a": 1}')).toMatchObject({ ok: false, erro: expect.stringContaining('não é um backup') });
  expect(comAlteracao((b) => ({ ...b, versao: 99 })).ok).toBe(false);
  expect(comAlteracao((b) => ({ ...b, aulas_concluidas: [{ ...b.aulas_concluidas[0], acertos: 50 }] })).ok).toBe(false);
  expect(comAlteracao((b) => ({ ...b, perfis: [{ ...b.perfis[0], nome: 'x'.repeat(500) }, b.perfis[1]] })).ok).toBe(false);
  expect(comAlteracao((b) => ({ ...b, tentativas_prova: [{ ...b.tentativas_prova[0], perfil_id: 99 }] })).ok).toBe(false);
  expect(comAlteracao((b) => ({ ...b, config: [{ chave: 'modelo_conversa', valor: 'http://site-malicioso' }] })).ok).toBe(false);
  expect(comAlteracao((b) => ({ ...b, tentativas_prova: [{ ...b.tentativas_prova[0], detalhes: '{quebrado' }] })).ok).toBe(false);
  expect(validarBackup('x'.repeat(6 * 1024 * 1024)).ok).toBe(false);
});

test('se a importação falhar no meio, o progresso antigo continua intacto', async () => {
  const db = await bancoComDados();
  const antes = await exportarBackup(db, 1);
  const ruim = { ...antes, perfis: [antes.perfis[0]!, antes.perfis[0]!] } as Backup; // id repetido → erro no INSERT
  await expect(importarBackup(db, ruim)).rejects.toThrow();
  expect(await exportarBackup(db, 1)).toEqual(antes);
});
