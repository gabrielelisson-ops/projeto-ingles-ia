/**
 * Fala no navegador (falar.web.ts). O Safari do iPhone só toca o som se a fala
 * começar logo depois do toque, sem esperar nada antes.
 */
type Fala = { text: string; lang: string; rate: number; pitch: number; voice: unknown; volume: number; onend?: () => void; onerror?: () => void };

function montar(vozes: { voiceURI: string; name: string; lang: string }[]) {
  const faladas: Fala[] = [];
  const sintese = {
    getVoices: jest.fn(() => vozes),
    speak: jest.fn((u: Fala) => faladas.push(u)),
    cancel: jest.fn(),
    resume: jest.fn(),
    addEventListener: jest.fn(),
  };
  class Utterance {
    text: string;
    lang = '';
    rate = 1;
    pitch = 1;
    volume = 1;
    voice: unknown = null;
    constructor(t: string) {
      this.text = t;
    }
  }
  const g = globalThis as Record<string, unknown>;
  g.window = { speechSynthesis: sintese };
  g.SpeechSynthesisUtterance = Utterance;
  let mod!: typeof import('../src/voz/falar.web');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- cada teste precisa de uma cópia nova do módulo
    mod = require('../src/voz/falar.web');
  });
  return { mod, sintese, faladas };
}

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.SpeechSynthesisUtterance;
});

const ms = (n: string) => ({ voiceURI: `Microsoft ${n} - English (United States)`, name: `Microsoft ${n} - English (United States)`, lang: 'en-US' });

test('começa a falar na hora, sem esperar nada (exigência do iPhone)', () => {
  const { mod, sintese, faladas } = montar([ms('Ana Online (Natural)'), ms('Aria Online (Natural)')]);
  void mod.falar('Hello!', { nivel: 'A1', sotaque: 'en-US' });
  // Ainda na mesma "volta" do toque: a fala já foi entregue ao navegador.
  expect(sintese.speak).toHaveBeenCalledTimes(1);
  expect(faladas[0]?.lang).toBe('en-US');
  expect(faladas[0]?.rate).toBe(0.75);
  expect((faladas[0]?.voice as { name: string }).name).toContain('Aria');
});

test('fala mesmo quando o navegador ainda não entregou a lista de vozes', () => {
  const { mod, sintese, faladas } = montar([]);
  void mod.falar('Hello!', { nivel: 'B1', sotaque: 'en-GB' });
  expect(sintese.speak).toHaveBeenCalledTimes(1);
  expect(faladas[0]?.voice).toBeNull();
  expect(faladas[0]?.lang).toBe('en-GB');
});

test('termina quando o navegador avisa o fim; e não trava se ele nunca avisar', async () => {
  jest.useFakeTimers();
  const { mod, faladas } = montar([ms('Aria Online (Natural)')]);
  let fim = false;
  void mod.falar('Hi', { nivel: 'C1', sotaque: 'en-US' }).then(() => (fim = true));
  faladas[0]?.onend?.();
  await Promise.resolve();
  expect(fim).toBe(true);

  let fim2 = false;
  void mod.falar('Hi again', { nivel: 'C1', sotaque: 'en-US' }).then(() => (fim2 = true));
  jest.advanceTimersByTime(10_000);
  await Promise.resolve();
  expect(fim2).toBe(true);
  jest.useRealTimers();
});

test('usa a voz escolhida em Configurações', () => {
  const { mod, faladas } = montar([ms('Aria Online (Natural)'), ms('Guy Online (Natural)')]);
  mod.definirVozesPreferidas({ 'en-US': ms('Guy Online (Natural)').voiceURI });
  void mod.falar('Hello', { nivel: 'B1', sotaque: 'en-US' });
  expect((faladas[0]?.voice as { name: string }).name).toContain('Guy');
});

test('sem síntese de voz no navegador: não quebra', async () => {
  let mod!: typeof import('../src/voz/falar.web');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- cada teste precisa de uma cópia nova do módulo
    mod = require('../src/voz/falar.web');
  });
  await expect(mod.falar('Hello', { nivel: 'A1', sotaque: 'en-US' })).resolves.toBeUndefined();
  expect(() => mod.pararFala()).not.toThrow();
  await expect(mod.listarVozes('en-US')).resolves.toEqual([]);
});
