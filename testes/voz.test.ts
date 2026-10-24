import { escolherVozes, velocidade } from '../src/voz/vozes';
import { chaveComFormatoValido, mascararChave } from '../src/ia/chave';

jest.mock('expo-secure-store', () => ({}));

test('velocidade: A1 devagar, C1 normal, "mais devagar" reduz, com limites', () => {
  expect(velocidade('A1')).toBe(0.75);
  expect(velocidade('C1')).toBe(1.05);
  expect(velocidade('A1', 1, true)).toBe(0.53);
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

test('chave da API: valida o formato e nunca mostra inteira', () => {
  expect(chaveComFormatoValido('AIzaSyA1234567890abcdefghijklmnopqrstu')).toBe(true);
  expect(chaveComFormatoValido('minha chave')).toBe(false);
  expect(chaveComFormatoValido('<script>')).toBe(false);
  expect(mascararChave('AIzaSyA1234567890abcdefghijklmnopqrstu')).toBe('AIza…rstu');
});
