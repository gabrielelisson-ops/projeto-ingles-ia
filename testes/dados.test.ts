/**
 * Testa o SQL de verdade usando o SQLite embutido no Node,
 * no lugar do SQLite do celular (mesma linguagem SQL).
 */
import { migrar, type Banco, type Valor } from '../src/dados/banco';
import * as repo from '../src/dados/repositorio';
import { statusCurso } from '../src/logica/desbloqueio';
import { DIA_MS } from '../src/logica/sm2';

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

let db: Banco;
beforeEach(async () => {
  db = bancoDeTeste();
  await migrar(db);
  await repo.garantirPerfisIniciais(db);
});

test('cria os dois perfis só uma vez e migra sem repetir', async () => {
  await repo.garantirPerfisIniciais(db);
  await migrar(db);
  const p = await repo.listarPerfis(db);
  expect(p.map((x) => x.nome)).toEqual(['Gabriel', 'Esposa']);
});

test('renomear valida o nome', async () => {
  await repo.renomearPerfil(db, 2, '  Ana  ');
  expect((await repo.listarPerfis(db))[1]!.nome).toBe('Ana');
  await expect(repo.renomearPerfil(db, 2, '   ')).rejects.toThrow();
  await expect(repo.renomearPerfil(db, 2, 'x'.repeat(31))).rejects.toThrow();
});

test('progresso dos perfis é separado', async () => {
  await repo.concluirAula(db, 1, 'a1-u01-l1', 5);
  await repo.concluirAula(db, 1, 'a1-u01-l1', 4); // refazer não piora a nota
  const g = await repo.carregarProgresso(db, 1);
  const e = await repo.carregarProgresso(db, 2);
  expect([...g.aulasConcluidas]).toEqual(['a1-u01-l1']);
  expect(e.aulasConcluidas.size).toBe(0);
});

test('tentativas de prova alimentam o desbloqueio', async () => {
  const agora = Date.now();
  for (let i = 1; i <= 5; i++) await repo.concluirAula(db, 1, `a1-u01-l${i}`, 5);
  await repo.registrarTentativa(db, 1, 'a1-u01-prova', { nota: 55, aprovado: false, data: agora }, { partes: {} });
  const p = await repo.carregarProgresso(db, 1);
  const est = [{ nivel: 'A1' as const, unidades: [{ nivel: 'A1' as const, numero: 1, aulas: [1, 2, 3, 4, 5].map((i) => `a1-u01-l${i}`), prova: 'a1-u01-prova' }], provaFinal: null }];
  expect(statusCurso(est, p, agora + 1000).get('a1-u01-prova')?.estado).toBe('aguardando');
  const t = await repo.listarTentativas(db, 1);
  expect(t[0]).toMatchObject({ prova_id: 'a1-u01-prova', nota: 55, aprovado: false, detalhes: { partes: {} } });
});

test('erros frequentes: conta repetições e ignora correções vazias', async () => {
  const c = { errado: 'I am engineer', certo: 'I am an engineer', explicacao_pt: 'profissão com artigo' };
  await repo.registrarErros(db, 1, [c, c, { errado: 'ok', certo: 'OK', explicacao_pt: '' }]);
  await repo.registrarErros(db, 1, [{ errado: 'He are', certo: 'He is', explicacao_pt: '' }]);
  const f = await repo.errosFrequentes(db, 1);
  expect(f.map((x) => x.certo)).toEqual(['I am an engineer', 'He is']);
  expect(await repo.errosFrequentes(db, 2)).toEqual([]);
});

test('fila de revisão: adiciona sem duplicar e reagenda pelo SM-2', async () => {
  const agora = 1_000_000;
  const item = { item_id: 'w:hello', tipo: 'palavra' as const, frente: 'hello', verso: 'olá', emoji: '👋' };
  await repo.adicionarRevisao(db, 1, [item, item], agora);
  expect(await repo.contarRevisao(db, 1, agora)).toEqual({ total: 1, vencidos: 1 });
  const [c] = await repo.revisaoVencida(db, 1, agora);
  await repo.responderRevisao(db, 1, c!, 5, agora);
  expect(await repo.contarRevisao(db, 1, agora)).toEqual({ total: 1, vencidos: 0 });
  expect(await repo.contarRevisao(db, 1, agora + DIA_MS)).toEqual({ total: 1, vencidos: 1 });
});

test('atividade soma por dia e configurações gravam', async () => {
  const agora = new Date(2026, 9, 24, 10).getTime();
  await repo.registrarAtividade(db, 1, { segundosFala: 30 }, agora);
  await repo.registrarAtividade(db, 1, { segundosFala: 15.4, segundosEstudo: 60 }, agora);
  expect(await repo.resumoAtividade(db, 1)).toEqual({ dias: ['2026-10-24'], segundosFala: 45, segundosEstudo: 60 });
  await repo.gravarConfig(db, 'sotaque', 'en-GB');
  await repo.gravarConfig(db, 'sotaque', 'en-US');
  expect(await repo.lerConfig(db, 'sotaque')).toBe('en-US');
});

test('SQL com aspas no texto não quebra (parâmetros)', async () => {
  await repo.renomearPerfil(db, 1, "G'); DROP TABLE perfis;--");
  const p = await repo.listarPerfis(db);
  expect(p.length).toBe(2);
  expect(p[0]!.nome).toBe("G'); DROP TABLE perfis;--");
});
