import { escolherVozes, nomeDaVoz, velocidade, VOZ_VALIDA, vozAdequada, vozesAdultas } from '../src/voz/vozes';
import { chaveComFormatoValido, mascararChave } from '../src/ia/chave';

jest.mock('expo-secure-store', () => ({}));

test('velocidade: A1 devagar, C1 normal, "mais devagar" reduz, com limites', () => {
  expect(velocidade('A1')).toBe(0.75);
  expect(velocidade('C1')).toBe(1.05);
  expect(velocidade('A1', 1, true)).toBeCloseTo(0.52, 2);
  expect(velocidade('A1', 0.1)).toBe(0.4);
  expect(velocidade('C1', 3)).toBe(1.5);
});

test('escolhe vozes do sotaque, preferindo as offline e de melhor qualidade', () => {
  const vozes = [
    { identifier: 'en-us-x-network', language: 'en-US', quality: 'Enhanced' },
    { identifier: 'en-us-x-local', language: 'en-US', quality: 'Enhanced' },
    { identifier: 'en-gb-x-local', language: 'en_GB' },
    { identifier: 'pt-br-x', language: 'pt-BR' },
  ];
  expect(escolherVozes(vozes, 'en-US')).toEqual({ a: 'en-us-x-local', b: 'en-us-x-network' });
  // só uma voz britânica: as duas falas usam a mesma (o tom muda na hora de falar)
  expect(escolherVozes(vozes, 'en-GB')).toEqual({ a: 'en-gb-x-local', b: 'en-gb-x-local' });
  expect(escolherVozes([], 'en-GB')).toEqual({ a: undefined, b: undefined });
});

const ms = (nome: string) => ({ identifier: `Microsoft ${nome} - English (United States)`, name: `Microsoft ${nome} - English (United States)`, language: 'en-US' });

test('Edge: nunca escolhe a voz infantil (Ana) e prefere as naturais', () => {
  const vozes = [ms('Ana Online (Natural)'), ms('Aria Online (Natural)'), ms('David'), ms('Guy Online (Natural)'), ms('Zira')];
  const r = escolherVozes(vozes, 'en-US');
  expect(r.a).toBe(ms('Aria Online (Natural)').identifier);
  expect(r.b).toBe(ms('Guy Online (Natural)').identifier);
  expect(vozesAdultas(vozes, 'en-US').map((v) => v.name)).not.toContain(ms('Ana Online (Natural)').name);
});

test('iPhone/Mac: tira vozes de brincadeira e infantis, prefere as melhores', () => {
  const ap = (id: string, nome: string, quality?: string) => ({ identifier: id, name: nome, language: 'en-US', quality });
  const vozes = [
    ap('com.apple.speech.synthesis.voice.Albert', 'Albert'),
    ap('com.apple.speech.synthesis.voice.Junior', 'Junior'),
    ap('com.apple.speech.synthesis.voice.Bubbles', 'Bubbles'),
    ap('com.apple.eloquence.en-US.Eddy', 'Eddy'),
    ap('com.apple.voice.compact.en-US.Samantha', 'Samantha'),
    ap('com.apple.voice.enhanced.en-US.Evan', 'Evan', 'Enhanced'),
  ];
  expect(vozesAdultas(vozes, 'en-US').map((v) => v.name)).toEqual(['Evan', 'Samantha', 'Eddy']);
  expect(vozAdequada(ap('x', 'Good News'))).toBe(false);
  expect(vozAdequada(ap('x', 'Daniel'))).toBe(true);
});

test('a voz escolhida em Configurações vem primeiro; se não existir no aparelho, volta ao automático', () => {
  const vozes = [ms('Aria Online (Natural)'), ms('Guy Online (Natural)'), ms('David')];
  expect(escolherVozes(vozes, 'en-US', ms('David').identifier)).toEqual({ a: ms('David').identifier, b: ms('Aria Online (Natural)').identifier });
  expect(escolherVozes(vozes, 'en-US', 'voz-de-outro-aparelho').a).toBe(ms('Aria Online (Natural)').identifier);
  // a voz infantil não pode ser forçada nem pela preferência
  expect(escolherVozes([ms('Ana Online (Natural)'), ms('David')], 'en-US', ms('Ana Online (Natural)').identifier).a).toBe(ms('David').identifier);
});

test('nome curto das vozes na tela', () => {
  expect(nomeDaVoz(ms('Aria Online (Natural)'), 0)).toBe('Aria');
  expect(nomeDaVoz({ identifier: 'Google UK English Female', name: 'Google UK English Female', language: 'en-GB' }, 0)).toBe('UK English Female');
  expect(nomeDaVoz({ identifier: 'en-us-x-iol-local', name: 'en-us-x-iol-local', language: 'en-US' }, 2)).toBe('Voz 3');
  expect(nomeDaVoz({ identifier: 'com.apple.voice.compact.en-GB.Daniel', name: 'Daniel', language: 'en-GB' }, 0)).toBe('Daniel');
});

test('identificador de voz: aceita nomes reais, recusa vazios, enormes e com caracteres de controle', () => {
  expect(VOZ_VALIDA.test(ms('Aria Online (Natural)').identifier)).toBe(true);
  expect(VOZ_VALIDA.test('')).toBe(false);
  expect(VOZ_VALIDA.test('a'.repeat(201))).toBe(false);
  expect(VOZ_VALIDA.test('voz\nfalsa')).toBe(false);
});

test('chave da API: valida o formato e nunca mostra inteira', () => {
  expect(chaveComFormatoValido('AIzaSyA1234567890abcdefghijklmnopqrstu')).toBe(true);
  expect(chaveComFormatoValido('AQ.Ab12TESTEchaveFalsa_novoFormato-1234567890xyz')).toBe(true);
  expect(chaveComFormatoValido('minha chave')).toBe(false);
  expect(chaveComFormatoValido('AQ.chave:falsa/1234567890abcdefghijklmnop')).toBe(false);
  expect(chaveComFormatoValido('<script>')).toBe(false);
  expect(mascararChave('AIzaSyA1234567890abcdefghijklmnopqrstu')).toBe('AIza…rstu');
});
