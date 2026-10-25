/**
 * Partes exclusivas da versão web que dá para testar sem navegador.
 */
import { apagarChave, lerChave, mascararChave, salvarChave } from '../src/ia/chave.web';
import { readFileSync } from 'fs';
import { join } from 'path';
import { aplicarLembrete, LEMBRETE_DISPONIVEL } from '../src/ui/lembrete.web';
import { abertoDentroDeOutroSite } from '../src/ui/protecaoWeb';

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

describe('proteção contra o site aberto dentro de outro site', () => {
  test('janela normal abre', () => {
    const w: { top: unknown; self: unknown } = { top: null, self: null };
    w.top = w;
    w.self = w;
    expect(abertoDentroDeOutroSite(w)).toBe(false);
  });

  test('dentro de um quadro de outro site, bloqueia', () => {
    expect(abertoDentroDeOutroSite({ top: {}, self: {} })).toBe(true);
  });

  test('se o navegador negar acesso à janela de cima, bloqueia', () => {
    const w = {
      get top(): unknown {
        throw new Error('acesso negado');
      },
      self: {},
    };
    expect(abertoDentroDeOutroSite(w)).toBe(true);
  });
});

describe('index.html do site', () => {
  const html = readFileSync(join(__dirname, '../public/index.html'), 'utf8');
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? '';

  test('tem política de segurança (CSP) restrita', () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  test('só conversa com o próprio site e com a IA do Google', () => {
    const connect = /connect-src ([^;]+)/.exec(csp)?.[1]?.trim();
    expect(connect).toBe("'self' https://generativelanguage.googleapis.com");
  });

  test('não manda o endereço do site para outros sites', () => {
    expect(html).toContain('<meta name="referrer" content="no-referrer" />');
  });
});
