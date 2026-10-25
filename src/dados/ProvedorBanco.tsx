/**
 * Banco de dados no celular (Android/iOS): SQLite do próprio aparelho.
 * A versão web fica em ProvedorBanco.web.tsx (o empacotador escolhe sozinho).
 */
import type { ReactNode } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import type { Banco } from './banco';

export function ProvedorBanco({ children, aoIniciar }: { children: ReactNode; aoIniciar: (db: Banco) => Promise<void> }) {
  return (
    <SQLiteProvider databaseName="ingles-ia.db" onInit={(db) => aoIniciar(db as unknown as Banco)}>
      {children}
    </SQLiteProvider>
  );
}

export function useBanco(): Banco {
  return useSQLiteContext() as unknown as Banco;
}
