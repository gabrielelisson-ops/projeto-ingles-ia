/**
 * Testa o banco da versão web (sql.js) com o mesmo código do app:
 * migrações, repositório, backup e a cópia salva a cada alteração.
 */
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { exportarBackup, importarBackup, validarBackup } from '../src/dados/backup';
import { migrar } from '../src/dados/banco';
import { abrirBancoWeb, deixaTransacaoAberta, type Persistencia } from '../src/dados/bancoWeb';
import * as repo from '../src/dados/repositorio';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

/** "Disco" de mentira: guarda a última cópia e conta as gravações. */
function discoEmMemoria() {
  const disco = { dados: null as Uint8Array | null, gravacoes: 0 };
  const p: Persistencia = {
    carregar: async () => disco.dados,
    salvar: async (d) => {
      disco.dados = d;
      disco.gravacoes++;
    },
  };
  return { disco, p };
}

async function abrirPronto(p: Persistencia) {
  const db = await abrirBancoWeb(SQL, p);
  await migrar(db);
  await repo.garantirPerfisIniciais(db);
  return db;
}

test('detecta transação aberta e fechada', () => {
  expect(deixaTransacaoAberta('BEGIN', false)).toBe(true);
  expect(deixaTransacaoAberta('COMMIT', true)).toBe(false);
  expect(deixaTransacaoAberta('ROLLBACK', true)).toBe(false);
  expect(deixaTransacaoAberta('BEGIN; CREATE TABLE x(a); COMMIT;', false)).toBe(false);
  expect(deixaTransacaoAberta('CREATE TABLE x(a)', true)).toBe(true);
  expect(deixaTransacaoAberta('CREATE TABLE x(a)', false)).toBe(false);
});

test('cria o banco, grava e recupera tudo ao reabrir (como recarregar a página)', async () => {
  const { disco, p } = discoEmMemoria();
  const db = await abrirPronto(p);
  await repo.renomearPerfil(db, 2, 'Ana');
  await repo.concluirAula(db, 1, 'a1-u01-l1', 5, 1000);
  await db.aguardarGravacao();
  expect(disco.gravacoes).toBeGreaterThan(0);
  db.fechar();

  const db2 = await abrirPronto(p);
  expect((await repo.listarPerfis(db2)).map((x) => x.nome)).toEqual(['Gabriel', 'Ana']);
  expect((await repo.carregarProgresso(db2, 1)).aulasConcluidas.has('a1-u01-l1')).toBe(true);
  db2.fechar();
});

test('as chaves estrangeiras continuam ligadas depois de gravar', async () => {
  const { p } = discoEmMemoria();
  const db = await abrirPronto(p);
  await repo.concluirAula(db, 2, 'a1-u01-l1', 5, 1000);
  await db.aguardarGravacao();
  await db.runAsync('DELETE FROM perfis WHERE id = ?', [2]);
  const resto = await db.getAllAsync<{ n: number }>('SELECT COUNT(*) AS n FROM aulas_concluidas WHERE perfil_id = ?', [2]);
  expect(resto[0]!.n).toBe(0);
  db.fechar();
});

test('não grava no meio de uma transação, e grava ao concluir', async () => {
  const { disco, p } = discoEmMemoria();
  const db = await abrirPronto(p);
  await db.aguardarGravacao();
  const antes = disco.gravacoes;
  await db.execAsync('BEGIN');
  await db.runAsync('UPDATE perfis SET nome = ? WHERE id = ?', ['X', 1]);
  await db.aguardarGravacao();
  expect(disco.gravacoes).toBe(antes);
  await db.execAsync('COMMIT');
  await db.aguardarGravacao();
  expect(disco.gravacoes).toBe(antes + 1);
  db.fechar();
});

test('backup: exportar do celular e importar na web (e vice-versa) funciona', async () => {
  const origem = await abrirPronto(discoEmMemoria().p);
  await repo.renomearPerfil(origem, 1, 'Gabriel E.');
  await repo.concluirAula(origem, 1, 'a1-u01-l1', 4, 1000);
  const json = JSON.stringify(await exportarBackup(origem));

  const { p } = discoEmMemoria();
  const destino = await abrirPronto(p);
  const v = validarBackup(json);
  if (!v.ok) throw new Error(v.erro);
  await importarBackup(destino, v.backup);
  await destino.aguardarGravacao();
  destino.fechar();

  const reaberto = await abrirPronto(p);
  expect((await repo.listarPerfis(reaberto))[0]!.nome).toBe('Gabriel E.');
  expect((await repo.carregarProgresso(reaberto, 1)).aulasConcluidas.has('a1-u01-l1')).toBe(true);
  reaberto.fechar();
});

test('erro ao gravar aparece em aguardarGravacao', async () => {
  const db = await abrirBancoWeb(SQL, {
    carregar: async () => null,
    salvar: async () => {
      throw new Error('disco cheio');
    },
  });
  await db.execAsync('CREATE TABLE t (a INTEGER)');
  await expect(db.aguardarGravacao()).rejects.toThrow('disco cheio');
  db.fechar();
});

test('o .wasm publicado no site é o mesmo da versão instalada do sql.js', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs');
  const publicado = fs.readFileSync(require.resolve('../public/sql-wasm-browser.wasm'));
  const instalado = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm-browser.wasm'));
  expect(publicado.equals(instalado)).toBe(true);
});
