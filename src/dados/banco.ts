/**
 * Banco de dados local (SQLite, dentro do celular).
 *
 * Cada vez que a estrutura das tabelas mudar, crie uma nova migração no
 * fim da lista: o app aplica só as que faltam, sem apagar o que já existe.
 */

export type Valor = string | number | null;

/** O mínimo que usamos do SQLite (permite testar fora do celular). */
export interface Banco {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: Valor[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: Valor[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: Valor[]): Promise<T | null>;
}

const MIGRACOES: string[] = [
  // 1 — estrutura inicial
  `
  CREATE TABLE perfis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    nivel_inicial TEXT NOT NULL DEFAULT 'A1',
    criado_em INTEGER NOT NULL
  );
  CREATE TABLE aulas_concluidas (
    perfil_id INTEGER NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    aula_id TEXT NOT NULL,
    acertos INTEGER NOT NULL,
    concluida_em INTEGER NOT NULL,
    PRIMARY KEY (perfil_id, aula_id)
  );
  CREATE TABLE tentativas_prova (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    perfil_id INTEGER NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    prova_id TEXT NOT NULL,
    nota INTEGER NOT NULL,
    aprovado INTEGER NOT NULL,
    data INTEGER NOT NULL,
    detalhes TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX idx_tentativas ON tentativas_prova(perfil_id, prova_id);
  CREATE TABLE erros (
    perfil_id INTEGER NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    errado TEXT NOT NULL,
    certo TEXT NOT NULL,
    explicacao TEXT NOT NULL DEFAULT '',
    vezes INTEGER NOT NULL DEFAULT 1,
    ultima_vez INTEGER NOT NULL,
    PRIMARY KEY (perfil_id, errado, certo)
  );
  CREATE TABLE revisao (
    perfil_id INTEGER NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    frente TEXT NOT NULL,
    verso TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '',
    repeticoes INTEGER NOT NULL,
    intervalo INTEGER NOT NULL,
    facilidade REAL NOT NULL,
    proxima INTEGER NOT NULL,
    PRIMARY KEY (perfil_id, item_id)
  );
  CREATE TABLE atividade (
    perfil_id INTEGER NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    dia TEXT NOT NULL,
    segundos_fala INTEGER NOT NULL DEFAULT 0,
    segundos_estudo INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (perfil_id, dia)
  );
  CREATE TABLE config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );
  `,
];

export async function migrar(db: Banco): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const versao = linha?.user_version ?? 0;
  for (let v = versao; v < MIGRACOES.length; v++) {
    await db.execAsync(`BEGIN; ${MIGRACOES[v]} PRAGMA user_version = ${v + 1}; COMMIT;`);
  }
}
