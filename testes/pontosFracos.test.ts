import fs from 'fs';
import path from 'path';
import { montarCurso } from '../src/conteudo/curso';
import { calcularPontosFracos } from '../src/logica/pontosFracos';

const RAIZ = path.join(__dirname, '..', 'conteudo');
const ler = (p: string) => JSON.parse(fs.readFileSync(path.join(RAIZ, p), 'utf8'));
const unidade = (u: string) => ({
  meta: ler(`a1/${u}/unidade.json`),
  aulas: [1, 2, 3, 4, 5].map((n) => ler(`a1/${u}/aula${n}.json`)),
  prova: ler(`a1/${u}/prova.json`),
});
const curso = montarCurso(ler('curriculo.json'), [unidade('u01'), unidade('u02')]);

test('sem histórico: nada a mostrar', () => {
  expect(calcularPontosFracos(curso, [], [])).toEqual({ habilidades: [], gramatica: [] });
});

test('média por habilidade, da mais fraca para a mais forte', () => {
  const r = calcularPontosFracos(
    curso,
    [
      { prova_id: 'a1-u01-prova', nota: 60, aprovado: false, data: 1, detalhes: { partes: { leitura: 90, escuta: 40, escrita: 70, fala: 50 } } },
      { prova_id: 'a1-u01-prova', nota: 80, aprovado: true, data: 2, detalhes: { partes: { leitura: 100, escuta: 60, escrita: 80, fala: 70 } } },
    ],
    [],
  );
  expect(r.habilidades.map((h) => [h.parte, h.media, h.fraca])).toEqual([
    ['escuta', 50, true],
    ['fala', 60, true],
    ['escrita', 75, false],
    ['leitura', 95, false],
  ]);
});

test('gramática: reprovação na prova e aulas com 4 de 5, sem repetir', () => {
  const r = calcularPontosFracos(
    curso,
    [
      { prova_id: 'a1-u02-prova', nota: 55, aprovado: false, data: 5, detalhes: {} },
      { prova_id: 'a1-u02-prova', nota: 50, aprovado: false, data: 3, detalhes: {} },
    ],
    [
      { aula_id: 'a1-u01-l4', acertos: 4 },
      { aula_id: 'a1-u01-l1', acertos: 5 },
    ],
  );
  expect(r.gramatica).toHaveLength(2);
  expect(r.gramatica[0]!.motivo).toContain('Unidade 2');
  expect(r.gramatica[0]!.motivo).toContain('nota 55');
  expect(r.gramatica[1]!.tema).toBe('A e an com profissões');
});

test('detalhes corrompidos ou com valores estranhos são ignorados', () => {
  const r = calcularPontosFracos(
    curso,
    [
      { prova_id: 'x', nota: 0, aprovado: true, data: 1, detalhes: 'lixo' },
      { prova_id: 'x', nota: 0, aprovado: true, data: 1, detalhes: { partes: { leitura: 'abc', fala: 999 } } },
    ],
    [],
  );
  expect(r.habilidades).toEqual([{ parte: 'fala', nome: 'Fala (speaking)', media: 100, provas: 1, fraca: false }]);
});
