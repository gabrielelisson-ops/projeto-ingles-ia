import { compararPronuncia, numeroPorExtenso } from '../src/logica/pronuncia';

const marcadas = (esperada: string, ouvida: string) =>
  compararPronuncia(esperada, ouvida)
    .palavras.filter((p) => !p.ok)
    .map((p) => p.texto);

test('frase igual: 100%, nenhuma palavra marcada', () => {
  const r = compararPronuncia('Nice to meet you.', 'nice to meet you');
  expect(r.porcentagem).toBe(100);
  expect(r.palavras.every((p) => p.ok)).toBe(true);
});

test('marca só a palavra que não foi reconhecida', () => {
  expect(marcadas('I work in a factory.', 'I work in a fact story')).toEqual(['factory.']);
  const r = compararPronuncia('I work in a factory.', 'I work in a fact story');
  expect(r).toMatchObject({ acertos: 4, total: 5, porcentagem: 80 });
});

test('palavra a mais ou faltando não estraga o resto da frase', () => {
  expect(marcadas('She is my sister.', 'she is is my sister')).toEqual([]);
  expect(marcadas('She is my sister.', 'she my sister')).toEqual(['is']);
});

test('contrações, maiúsculas e números em algarismos', () => {
  expect(marcadas("I'm thirty-five.", 'I am 35')).toEqual([]);
  expect(marcadas('Room fourteen, please.', 'room 14 please')).toEqual([]);
  expect(marcadas('Room fourteen, please.', 'room 40 please')).toEqual(['fourteen,']);
});

test('nada reconhecido: 0%', () => {
  const r = compararPronuncia('Good morning!', '');
  expect(r.porcentagem).toBe(0);
  expect(r.palavras.map((p) => p.ok)).toEqual([false, false]);
});

test('números por extenso', () => {
  expect(numeroPorExtenso(0)).toBe('zero');
  expect(numeroPorExtenso(13)).toBe('thirteen');
  expect(numeroPorExtenso(40)).toBe('forty');
  expect(numeroPorExtenso(67)).toBe('sixty-seven');
  expect(numeroPorExtenso(100)).toBe('one hundred');
  expect(numeroPorExtenso(101)).toBeNull();
});
