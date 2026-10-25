/**
 * Guarda a cópia do banco no IndexedDB do navegador (só na versão web).
 * Os dados ficam só neste navegador, neste computador.
 */
import type { Persistencia } from './bancoWeb';

const NOME_BD = 'ingles-ia';
const LOJA = 'arquivos';
const CHAVE = 'banco.sqlite';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(NOME_BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB indisponível'));
  });
}

function pedido<T>(modo: IDBTransactionMode, fazer: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrir().then(
    (bd) =>
      new Promise<T>((resolve, reject) => {
        const tx = bd.transaction(LOJA, modo);
        const r = fazer(tx.objectStore(LOJA));
        tx.oncomplete = () => {
          bd.close();
          resolve(r.result);
        };
        tx.onerror = () => {
          bd.close();
          reject(tx.error ?? new Error('Falha ao gravar no navegador'));
        };
      }),
  );
}

export function persistenciaNavegador(): Persistencia {
  // Pede ao navegador para não apagar estes dados quando faltar espaço.
  void navigator.storage?.persist?.().catch(() => undefined);
  return {
    carregar: async () => {
      const v = await pedido<unknown>('readonly', (l) => l.get(CHAVE));
      return v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : null;
    },
    salvar: async (dados) => {
      await pedido('readwrite', (l) => l.put(dados, CHAVE));
    },
  };
}
