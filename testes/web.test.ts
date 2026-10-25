/**
 * Partes exclusivas da versão web que dá para testar sem navegador.
 */
import { apagarChave, lerChave, mascararChave, salvarChave } from '../src/ia/chave.web';
import { aplicarLembrete, LEMBRETE_DISPONIVEL } from '../src/ui/lembrete.web';

const CHAVE = 'AIzaSyA1234567890abcdefghijklmnopqrstu';

function localStorageFalso(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe('chave da IA no navegador', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  test('salva, lê e apaga a chave', async () => {
    (globalThis as { localStorage?: Storage }).localStorage = localStorageFalso();
    expect(await lerChave()).toBe('');
    await salvarChave(`  ${CHAVE}  `);
    expect(await lerChave()).toBe(CHAVE);
    expect(mascararChave(CHAVE)).toBe(`AIza…${CHAVE.slice(-4)}`);
    await apagarChave();
    expect(await lerChave()).toBe('');
  });

  test('recusa chave com formato errado e não grava nada', async () => {
    const ls = localStorageFalso();
    (globalThis as { localStorage?: Storage }).localStorage = ls;
    await expect(salvarChave('minha chave')).rejects.toThrow(/não parece válida/);
    expect(ls.length).toBe(0);
  });

  test('sem armazenamento (janela anônima bloqueada) avisa com clareza', async () => {
    await expect(salvarChave(CHAVE)).rejects.toThrow(/janela anônima/);
    expect(await lerChave()).toBe('');
  });
});

test('lembrete diário não existe na web e explica o motivo', async () => {
  expect(LEMBRETE_DISPONIVEL).toBe(false);
  await expect(aplicarLembrete(true, '07:30')).rejects.toThrow(/só existe no app do celular/);
});
