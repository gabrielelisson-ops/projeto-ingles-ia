/**
 * Testa o gerador de conteúdo com uma IA "de mentira": confere o fluxo
 * plano → 5 aulas → prova, a correção automática quando a IA erra o formato
 * e que nada é aceito sem passar pelo schema.
 */
import fs from 'fs';
import path from 'path';
import { AulaSchema, CurriculoSchema, ProvaSchema } from '../src/conteudo/schema';
import { contextoDaUnidade, gerarUnidade, gerarValidado, PlanoSchema, problemasDaAula, promptAula, promptPlano } from '../src/gerador/gerador';

const ler = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
const curriculo = CurriculoSchema.parse(ler('conteudo/curriculo.json'));
const aulaEx = AulaSchema.parse(ler('conteudo/a1/u01/aula1.json'));
const provaEx = ProvaSchema.parse(ler('conteudo/a1/u01/prova.json'));

const resposta = (obj: unknown) =>
  ({
    status: 200,
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
    text: async () => '',
  }) as unknown as Response;

function iaFalsa(sequencia: unknown[]) {
  const pedidos: any[] = [];
  const fetchFn = (async (_url: string, init: RequestInit) => {
    pedidos.push(JSON.parse(init.body as string));
    return resposta(sequencia.shift());
  }) as unknown as typeof fetch;
  return { fetchFn, pedidos };
}

const plano = { aulas: [1, 2, 3, 4, 5].map((n) => ({ titulo: `Lesson ${n}`, objetivo_pt: 'objetivo', foco: 'foco' })) };
const aulaComo = (n: number) => ({ ...aulaEx, id: `a2-u03-l${n}`, nivel: 'A2', unidade: 3, numero: n });
const provaComo = () => ({ ...provaEx, id: 'a2-u03-prova', nivel: 'A2', unidade: 3 });

test('contexto da unidade vem do currículo e lista as anteriores', () => {
  const u = contextoDaUnidade(curriculo, 'A2', 3);
  expect(u.tema_pt).toBe('O que está acontecendo agora');
  expect(u.anteriores.at(-1)).toMatch(/^A2-2/);
  expect(() => contextoDaUnidade(curriculo, 'A2', 9)).toThrow();
});

test('prompts pedem conteúdo original e trazem ids e regras', () => {
  const u = contextoDaUnidade(curriculo, 'A2', 3);
  expect(promptPlano(u)).toContain('ORIGINAL');
  const p = promptAula(u, plano, 2, aulaEx);
  expect(p).toContain('"a2-u03-l2"');
  expect(p).toContain('a2u03l2-t1');
  expect(p).toContain('EXATAMENTE 5');
});

test('unidade completa: plano, 5 aulas e prova validados', async () => {
  const { fetchFn, pedidos } = iaFalsa([plano, ...[1, 2, 3, 4, 5].map(aulaComo), provaComo()]);
  const r = await gerarUnidade({ chave: 'x'.repeat(39), modelo: 'm', fetchFn }, contextoDaUnidade(curriculo, 'A2', 3), { aula: aulaEx, prova: provaEx });
  expect(r.aulas.map((a) => a.id)).toEqual([1, 2, 3, 4, 5].map((n) => `a2-u03-l${n}`));
  expect(r.prova.id).toBe('a2-u03-prova');
  expect(r.unidade.id).toBe('a2-u03');
  expect(pedidos).toHaveLength(7);
});

test('IA erra o formato: recebe os erros e corrige na segunda tentativa', async () => {
  const errado = { ...aulaComo(1), teste: aulaEx.teste.slice(0, 4) };
  const { fetchFn, pedidos } = iaFalsa([errado, aulaComo(1)]);
  const a = await gerarValidado({ chave: 'k', modelo: 'm', fetchFn }, 'prompt', AulaSchema, () => [], 'aula');
  expect(a.teste).toHaveLength(5);
  const ultimaMsg = pedidos[1].contents.at(-1).parts[0].text;
  expect(ultimaMsg).toContain('teste');
});

test('resposta registrada que a correção não aceita é recusada', async () => {
  const ruim = { ...aulaComo(1), teste: [{ ...aulaEx.teste[0]!, respostas: ['   '] }, ...aulaEx.teste.slice(1)] };
  const { fetchFn } = iaFalsa([ruim, ruim, ruim]);
  await expect(
    gerarValidado({ chave: 'k', modelo: 'm', fetchFn }, 'p', AulaSchema, (a) => problemasDaAula(a, 'A2', 3, 1), 'aula 1'),
  ).rejects.toThrow(/não ficou válido/);
});

test('plano precisa de exatamente 5 aulas', () => {
  expect(PlanoSchema.safeParse({ aulas: plano.aulas.slice(0, 4) }).success).toBe(false);
});
