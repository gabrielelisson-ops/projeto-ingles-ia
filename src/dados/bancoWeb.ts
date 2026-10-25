/**
 * Banco de dados na versão web (navegador do computador).
 *
 * Usa o sql.js (o mesmo SQLite, compilado para rodar no navegador) e guarda
 * uma cópia do arquivo do banco depois de cada alteração. Onde guardar é
 * decidido por quem chama (IndexedDB no navegador, memória nos testes).
 * Assim, o resto do app usa exatamente a mesma interface Banco do celular.
 */
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import type { Banco, Valor } from './banco';

export interface Persistencia {
  carregar(): Promise<Uint8Array | null>;
  salvar(dados: Uint8Array): Promise<void>;
}

export type BancoWeb = Banco & {
  /** Espera todas as gravações pendentes terminarem. */
  aguardarGravacao(): Promise<void>;
  fechar(): void;
};

/** Depois de um execAsync, ainda há uma transação aberta? (BEGIN sem COMMIT/ROLLBACK depois). */
export function deixaTransacaoAberta(sql: string, estavaAberta: boolean): boolean {
  const s = sql.toUpperCase();
  const inicio = s.lastIndexOf('BEGIN');
  const fim = Math.max(s.lastIndexOf('COMMIT'), s.lastIndexOf('ROLLBACK'));
  if (inicio === -1 && fim === -1) return estavaAberta;
  return inicio > fim;
}

export async function abrirBancoWeb(SQL: SqlJsStatic, persistencia: Persistencia): Promise<BancoWeb> {
  const dados = await persistencia.carregar();
  const db: Database = dados ? new SQL.Database(dados) : new SQL.Database();
  let emTransacao = false;
  let fila: Promise<void> = Promise.resolve();
  let erroGravacao: unknown = null;

  function gravar() {
    if (emTransacao) return;
    // export() fecha e reabre o banco, o que desliga as chaves estrangeiras: religamos em seguida.
    const copia = db.export();
    db.exec('PRAGMA foreign_keys = ON;');
    fila = fila
      .then(() => persistencia.salvar(copia))
      .catch((e: unknown) => {
        erroGravacao = e;
      });
  }

  function consultar<T>(sql: string, params: Valor[], limite?: number): T[] {
    const st = db.prepare(sql);
    try {
      st.bind(params as SqlValue[]);
      const linhas: T[] = [];
      while (st.step()) {
        linhas.push(st.getAsObject() as T);
        if (limite && linhas.length >= limite) break;
      }
      return linhas;
    } finally {
      st.free();
    }
  }

  return {
    async execAsync(sql) {
      db.exec(sql);
      emTransacao = deixaTransacaoAberta(sql, emTransacao);
      gravar();
    },
    async runAsync(sql, params) {
      db.run(sql, params as SqlValue[]);
      const r = { changes: db.getRowsModified() };
      gravar();
      return r;
    },
    async getAllAsync<T>(sql: string, params: Valor[]) {
      return consultar<T>(sql, params);
    },
    async getFirstAsync<T>(sql: string, params: Valor[]) {
      return consultar<T>(sql, params, 1)[0] ?? null;
    },
    async aguardarGravacao() {
      await fila;
      if (erroGravacao) {
        const e = erroGravacao;
        erroGravacao = null;
        throw e;
      }
    },
    fechar() {
      db.close();
    },
  };
}
