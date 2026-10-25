/**
 * Banco de dados na versão web: sql.js (SQLite no navegador) com cópia no IndexedDB.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import initSqlJs from 'sql.js';
import type { Banco } from './banco';
import { abrirBancoWeb } from './bancoWeb';
import { persistenciaNavegador } from './persistenciaNavegador';

const Ctx = createContext<Banco | null>(null);

export function ProvedorBanco({ children, aoIniciar }: { children: ReactNode; aoIniciar: (db: Banco) => Promise<void> }) {
  const [db, setDb] = useState<Banco | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      // O arquivo .wasm é servido junto com o site (pasta public/).
      const SQL = await initSqlJs({ locateFile: (arquivo) => `/${arquivo}` });
      const banco = await abrirBancoWeb(SQL, persistenciaNavegador());
      await aoIniciar(banco);
      if (!cancelado) setDb(banco);
    })().catch((e: unknown) => {
      if (!cancelado) setErro(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelado = true;
    };
    // aoIniciar é uma função fixa do layout: o banco abre uma vez só.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (erro) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, textAlign: 'center' }}>
          Não consegui abrir os dados do curso neste navegador. Se estiver numa janela anônima, abra numa janela normal.
          {'\n\n'}Detalhe: {erro}
        </Text>
      </View>
    );
  }
  if (!db) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <Ctx.Provider value={db}>{children}</Ctx.Provider>;
}

export function useBanco(): Banco {
  const db = useContext(Ctx);
  if (!db) throw new Error('useBanco fora do ProvedorBanco');
  return db;
}
