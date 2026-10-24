import fs from 'fs';
import path from 'path';
import { NivelamentoSchema } from '../src/conteudo/schema';
import { exerciciosInconsistentes } from '../src/gerador/gerador';
import { continuarTeste, sugerirNivel, type ResultadoNivel } from '../src/logica/nivelamento';

const r = (nivel: ResultadoNivel['nivel'], acertos: number, total = 6): ResultadoNivel => ({ nivel, acertos, total });

test('não passou no A1: começa no A1', () => {
  expect(sugerirNivel([r('A1', 3)])).toBe('A1');
  expect(sugerirNivel([])).toBe('A1');
});

test('passou no A1 e no A2, parou no B1: começa no B1', () => {
  expect(sugerirNivel([r('A1', 6), r('A2', 5), r('B1', 2)])).toBe('B1');
});

test('passou em tudo: C1', () => {
  expect(sugerirNivel([r('A1', 6), r('A2', 6), r('B1', 6), r('B2', 5), r('C1', 6)])).toBe('C1');
});

test('75% é o mínimo para passar no nível', () => {
  expect(sugerirNivel([r('A1', 5), r('A2', 4)])).toBe('A2'); // 4/6 = 67% não passa no A2
  expect(sugerirNivel([r('A1', 3, 4), r('A2', 0, 4)])).toBe('A2'); // 3/4 = 75% passa no A1
});

test('a fala só puxa um nível para baixo, e só se estiver bem abaixo', () => {
  const ate = [r('A1', 6), r('A2', 6), r('B1', 6), r('B2', 1)]; // sugere B2
  expect(sugerirNivel(ate, 'B1')).toBe('B2'); // fala um nível abaixo: mantém
  expect(sugerirNivel(ate, 'A2')).toBe('B1'); // fala dois abaixo: desce um
  expect(sugerirNivel(ate, 'A1')).toBe('B1'); // nunca desce mais de um
  expect(sugerirNivel(ate, 'C1')).toBe('B2'); // fala acima: não sobe
});

test('o teste para no primeiro nível em que não passar', () => {
  expect(continuarTeste(r('A1', 6))).toBe(true);
  expect(continuarTeste(r('A2', 3))).toBe(false);
  expect(continuarTeste(r('C1', 6))).toBe(false);
});

test('nivelamento.json: 5 níveis, 6 questões cada, respostas aceitas', () => {
  const bruto = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'conteudo', 'nivelamento.json'), 'utf8'));
  const n = NivelamentoSchema.parse(bruto);
  expect(n.niveis.map((x) => x.nivel)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  for (const nv of n.niveis) {
    expect(nv.perguntas).toHaveLength(6);
    expect(nv.perguntas.some((p) => p.tipo === 'multipla' && p.audio)).toBe(true);
    expect(exerciciosInconsistentes(nv.perguntas)).toEqual([]);
  }
});
