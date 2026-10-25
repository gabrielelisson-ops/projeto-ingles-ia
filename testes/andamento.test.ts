import { chaveAndamento, gravarAndamento, lerAndamento, retomarSequencia, type Andamento } from '../src/logica/andamento';

const base: Andamento = { v: 1, etapa: 4, erros: [{ pergunta: 'I is', certo: 'I am' }], escutaFeita: true, tentativa: 0 };
const lista = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];

test('grava e lê de volta o andamento da aula', () => {
  const a: Andamento = {
    ...base,
    sequencia: { etapa: 4, tentativa: 0, respostas: [{ id: 'e1', resposta: 2, acertou: true }] },
    conversa: { falas: [{ papel: 'professor', texto: 'Hi!' }, { papel: 'aluno', texto: 'Hello', correcoes: [] }, { papel: 'professor', texto: 'Nice.' }], correcoes: [], segundos: 4 },
  };
  expect(lerAndamento(gravarAndamento(a))).toEqual(a);
});

test('cada perfil tem seu andamento em cada aula', () => {
  expect(chaveAndamento(1, 'a1-u01-a2')).not.toBe(chaveAndamento(2, 'a1-u01-a2'));
  expect(chaveAndamento(1, 'a1-u01-a2')).not.toBe(chaveAndamento(1, 'a1-u01-a3'));
});

test('texto estragado ou adulterado: recomeça a aula em vez de travar', () => {
  expect(lerAndamento(null)).toBeNull();
  expect(lerAndamento('')).toBeNull();
  expect(lerAndamento('{não é json')).toBeNull();
  expect(lerAndamento(JSON.stringify({ ...base, etapa: 99 }))).toBeNull();
  expect(lerAndamento(JSON.stringify({ ...base, v: 2 }))).toBeNull();
  expect(lerAndamento(JSON.stringify({ ...base, erros: 'x' }))).toBeNull();
});

test('conversa muito longa: guarda as falas mais recentes, dentro dos limites', () => {
  const falas = Array.from({ length: 200 }, (_, i) => ({ papel: (i % 2 ? 'aluno' : 'professor') as 'aluno' | 'professor', texto: `fala ${i} ` + 'x'.repeat(5000) }));
  const lido = lerAndamento(gravarAndamento({ ...base, etapa: 5, conversa: { falas, correcoes: [], segundos: 10 } }));
  expect(lido?.conversa?.falas).toHaveLength(80);
  expect(lido?.conversa?.falas[79]?.texto.startsWith('fala 199')).toBe(true);
  expect(lido?.conversa?.falas[0]?.texto.length).toBe(3000);
});

test('retoma as questões já respondidas da sequência certa', () => {
  const seq = { etapa: 4, tentativa: 0, respostas: [{ id: 'e1', resposta: 'ok', acertou: false }] };
  expect(retomarSequencia(lista, seq, 4, 0)).toEqual([{ exercicio: { id: 'e1' }, resposta: 'ok', acertou: false }]);
  // outra etapa ou outra tentativa do teste: começa do zero
  expect(retomarSequencia(lista, seq, 3, 0)).toEqual([]);
  expect(retomarSequencia(lista, seq, 4, 1)).toEqual([]);
  // conteúdo da aula mudou: começa do zero
  expect(retomarSequencia([{ id: 'novo' }, { id: 'e2' }], seq, 4, 0)).toEqual([]);
  // sequência já completa não "retoma" (evita tela vazia)
  const completa = { ...seq, respostas: lista.map((e) => ({ id: e.id, resposta: 0, acertou: true })) };
  expect(retomarSequencia(lista, completa, 4, 0)).toEqual([]);
});
