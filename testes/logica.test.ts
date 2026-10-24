import {
  ESPERA_REPROVACAO_MS,
  ITENS_POR_NIVEL,
  nivelAtual,
  percentualDoNivel,
  proximoItem,
  statusCurso,
  type EstruturaNivel,
  type Progresso,
} from '../src/logica/desbloqueio';
import { calcularProva, contarFrases, notaDaTarefa, testeRapidoAprovado } from '../src/logica/notas';
import { corrigir, normalizar, respostaCerta, respostaIgual } from '../src/logica/respostas';
import { DIA_MS, novoCartao, revisar } from '../src/logica/sm2';
import { diaLocal, embaralhar, sequenciaDeDias } from '../src/logica/estatisticas';
import type { Exercicio } from '../src/conteudo/schema';

// ---------- Estrutura de exemplo: A1 com 2 unidades prontas, A2 com 1 ----------

const unidade = (nivel: 'A1' | 'A2', n: number, pronta = true) => ({
  nivel,
  numero: n,
  aulas: pronta ? [1, 2, 3, 4, 5].map((a) => `${nivel}-u${n}-l${a}`.toLowerCase()) : [],
  prova: pronta ? `${nivel}-u${n}-prova`.toLowerCase() : null,
});

const estrutura: EstruturaNivel[] = [
  { nivel: 'A1', unidades: [unidade('A1', 1), unidade('A1', 2)], provaFinal: 'a1-final' },
  { nivel: 'A2', unidades: [unidade('A2', 1), unidade('A2', 2, false)], provaFinal: null },
];

const vazio = (): Progresso => ({ aulasConcluidas: new Set(), provas: {} });
const AGORA = 1_800_000_000_000;

describe('desbloqueio de aulas', () => {
  test('no começo só a primeira aula está liberada', () => {
    const s = statusCurso(estrutura, vazio(), AGORA);
    expect(s.get('a1-u1-l1')?.estado).toBe('disponivel');
    expect(s.get('a1-u1-l2')?.estado).toBe('bloqueada');
    expect(s.get('a1-u1-prova')?.estado).toBe('bloqueada');
  });

  test('concluir uma aula libera a seguinte', () => {
    const p = { ...vazio(), aulasConcluidas: new Set(['a1-u1-l1']) };
    const s = statusCurso(estrutura, p, AGORA);
    expect(s.get('a1-u1-l1')?.estado).toBe('concluida');
    expect(s.get('a1-u1-l2')?.estado).toBe('disponivel');
    expect(s.get('a1-u1-l3')?.estado).toBe('bloqueada');
  });

  test('a prova da unidade só libera depois das 5 aulas', () => {
    const quatro = { ...vazio(), aulasConcluidas: new Set(['a1-u1-l1', 'a1-u1-l2', 'a1-u1-l3', 'a1-u1-l4']) };
    expect(statusCurso(estrutura, quatro, AGORA).get('a1-u1-prova')?.estado).toBe('bloqueada');
    const cinco = { ...vazio(), aulasConcluidas: new Set([...quatro.aulasConcluidas, 'a1-u1-l5']) };
    expect(statusCurso(estrutura, cinco, AGORA).get('a1-u1-prova')?.estado).toBe('disponivel');
  });

  const unidade1Feita = () => new Set([1, 2, 3, 4, 5].map((a) => `a1-u1-l${a}`));

  test('reprovou: espera 24h e a próxima unidade continua bloqueada', () => {
    const p: Progresso = {
      aulasConcluidas: unidade1Feita(),
      provas: { 'a1-u1-prova': [{ nota: 60, aprovado: false, data: AGORA - 1000 }] },
    };
    const s = statusCurso(estrutura, p, AGORA);
    expect(s.get('a1-u1-prova')).toEqual({ estado: 'aguardando', liberaEm: AGORA - 1000 + ESPERA_REPROVACAO_MS });
    expect(s.get('a1-u2-l1')?.estado).toBe('bloqueada');
    // 24h depois a prova volta a ficar disponível
    const depois = statusCurso(estrutura, p, AGORA - 1000 + ESPERA_REPROVACAO_MS);
    expect(depois.get('a1-u1-prova')?.estado).toBe('disponivel');
  });

  test('aprovado na prova libera a próxima unidade, mesmo com reprovação antes', () => {
    const p: Progresso = {
      aulasConcluidas: unidade1Feita(),
      provas: {
        'a1-u1-prova': [
          { nota: 50, aprovado: false, data: AGORA - 2 * DIA_MS },
          { nota: 80, aprovado: true, data: AGORA - DIA_MS },
        ],
      },
    };
    const s = statusCurso(estrutura, p, AGORA);
    expect(s.get('a1-u1-prova')?.estado).toBe('concluida');
    expect(s.get('a1-u2-l1')?.estado).toBe('disponivel');
    expect(proximoItem(estrutura, s)?.id).toBe('a1-u2-l1');
  });

  test('prova final libera o próximo nível; unidade sem conteúdo fica fora', () => {
    const tudo = new Set(
      [1, 2].flatMap((u) => [1, 2, 3, 4, 5].map((a) => `a1-u${u}-l${a}`)).concat(
        [1, 2, 3, 4, 5].map((a) => `a2-u1-l${a}`),
      ),
    );
    const ok = [{ nota: 90, aprovado: true, data: AGORA }];
    const p: Progresso = {
      aulasConcluidas: tudo,
      provas: { 'a1-u1-prova': ok, 'a1-u2-prova': ok, 'a1-final': ok },
    };
    const s = statusCurso(estrutura, p, AGORA);
    expect(s.get('a2-u1-l1')?.estado).toBe('concluida');
    expect(s.get('a2-u1-prova')?.estado).toBe('disponivel');
    expect(s.has('a2-u2-l1')).toBe(false);
    expect(nivelAtual(estrutura, p)).toBe('A2');
  });

  test('sem a prova final aprovada, o A2 fica bloqueado', () => {
    const tudo = new Set([1, 2].flatMap((u) => [1, 2, 3, 4, 5].map((a) => `a1-u${u}-l${a}`)));
    const ok = [{ nota: 90, aprovado: true, data: AGORA }];
    const p: Progresso = { aulasConcluidas: tudo, provas: { 'a1-u1-prova': ok, 'a1-u2-prova': ok } };
    const s = statusCurso(estrutura, p, AGORA);
    expect(s.get('a1-final')?.estado).toBe('disponivel');
    expect(s.get('a2-u1-l1')?.estado).toBe('bloqueada');
  });

  test('nivelamento: começar no A2 libera a primeira aula do A2', () => {
    const s = statusCurso(estrutura, vazio(), AGORA, 'A2');
    expect(s.get('a2-u1-l1')?.estado).toBe('disponivel');
    expect(nivelAtual(estrutura, vazio(), 'A2')).toBe('A2');
  });

  test('percentual do nível conta as 49 etapas planejadas', () => {
    expect(ITENS_POR_NIVEL).toBe(49);
    const p = { ...vazio(), aulasConcluidas: unidade1Feita() };
    expect(percentualDoNivel(estrutura[0]!, p)).toBe(Math.round((5 / 49) * 100));
  });
});

// ---------- Correção de respostas ----------

describe('correção de respostas', () => {
  test('ignora maiúsculas, pontuação, espaços e apóstrofo curvo', () => {
    expect(normalizar('  Hello,   I’M   Ana!! ')).toBe('hello i am ana');
    expect(respostaIgual("I'm from Brazil.", ['I am from Brazil'])).toBe(true);
    expect(respostaIgual('i am from brasil', ['I am from Brazil'])).toBe(false);
  });

  test('resposta vazia nunca está certa', () => {
    expect(respostaIgual('   ', ['   '])).toBe(false);
  });

  const ex: Record<string, Exercicio> = {
    multipla: { id: 'm', tipo: 'multipla', enunciado: '?', opcoes: ['a', 'b'], correta: 1 },
    completar: { id: 'c', tipo: 'completar', frase: 'She ___ a nurse.', respostas: ['is'] },
    ordenar: { id: 'o', tipo: 'ordenar', frase: 'Where are you from?' },
    ouvir: { id: 'u', tipo: 'ouvir_escrever', audio: 'Nice to meet you.', aceitas: ['Nice meeting you'] },
    traduzir: { id: 't', tipo: 'traduzir', pt: 'Eu sou professor.', respostas: ['I am a teacher.'] },
  };

  test('cada tipo de exercício', () => {
    expect(corrigir(ex.multipla!, 1)).toBe(true);
    expect(corrigir(ex.multipla!, '1')).toBe(false);
    expect(corrigir(ex.completar!, ' IS ')).toBe(true);
    expect(corrigir(ex.ordenar!, 'where are you from')).toBe(true);
    expect(corrigir(ex.ordenar!, 'are you where from')).toBe(false);
    expect(corrigir(ex.ouvir!, 'nice meeting you')).toBe(true);
    expect(corrigir(ex.traduzir!, "I'm a teacher")).toBe(true);
    expect(corrigir(ex.traduzir!, 'I am teacher')).toBe(false);
  });

  test('mostra a resposta certa', () => {
    expect(respostaCerta(ex.completar!)).toBe('She is a nurse.');
    expect(respostaCerta(ex.multipla!)).toBe('b');
  });
});

// ---------- Notas ----------

describe('notas', () => {
  test('teste rápido: 4 de 5 aprova, 3 de 5 não', () => {
    expect(testeRapidoAprovado(4)).toBe(true);
    expect(testeRapidoAprovado(5)).toBe(true);
    expect(testeRapidoAprovado(3)).toBe(false);
    expect(testeRapidoAprovado(0, 0)).toBe(false);
  });

  test('nota da tarefa: média dos critérios, limitada a 0–10', () => {
    expect(notaDaTarefa({ gramatica: 8, vocabulario: 6, fluencia: 7 }, 'escrita')).toBe(7);
    expect(notaDaTarefa({ gramatica: 8, vocabulario: 8, fluencia: 8, pronuncia: 4 }, 'fala')).toBe(7);
    expect(notaDaTarefa({ gramatica: 99, vocabulario: -5, fluencia: NaN }, 'escrita')).toBeCloseTo(10 / 3);
  });

  test('prova: 4 partes com o mesmo peso, aprova com 70', () => {
    const r = calcularProva({
      leitura: { acertos: 8, total: 8 },
      escuta: { acertos: 4, total: 8 },
      escrita: [8, 6],
      fala: [7, 7],
    });
    expect(r.partes).toEqual({ leitura: 100, escuta: 50, escrita: 70, fala: 70 });
    expect(r.nota).toBe(73);
    expect(r.aprovado).toBe(true);
    expect(r.pontosFracos).toEqual(['escuta']);
  });

  test('conta frases da escrita', () => {
    expect(contarFrases('My name is Ana. I am from Brazil! Are you a nurse?')).toBe(3);
    expect(contarFrases('Hi. Ok. I am an engineer')).toBe(1); // "Hi" e "Ok" sozinhos não contam
    expect(contarFrases('')).toBe(0);
  });

  test('prova: abaixo de 70 reprova', () => {
    const r = calcularProva({
      leitura: { acertos: 5, total: 8 },
      escuta: { acertos: 5, total: 8 },
      escrita: [7],
      fala: [7],
    });
    // 62,5 arredonda para 63 em cada parte: (63 + 63 + 70 + 70) / 4 = 66,5 → 67
    expect(r.nota).toBe(67);
    expect(r.aprovado).toBe(false);
  });
});

// ---------- Revisão espaçada ----------

describe('revisão espaçada (SM-2)', () => {
  test('intervalos crescem quando acerta: 1, 6, 15 dias', () => {
    let c = novoCartao(0);
    c = revisar(c, 5, 0);
    expect(c.intervalo).toBe(1);
    c = revisar(c, 5, 0);
    expect(c.intervalo).toBe(6);
    c = revisar(c, 4, 0);
    expect(c.intervalo).toBe(Math.round(6 * 2.7));
    expect(c.proxima).toBe(c.intervalo * DIA_MS);
  });

  test('errou: volta para amanhã e a facilidade cai (mínimo 1,3)', () => {
    let c = { repeticoes: 5, intervalo: 40, facilidade: 1.35, proxima: 0 };
    c = revisar(c, 1, 1000);
    expect(c).toMatchObject({ repeticoes: 0, intervalo: 1, proxima: 1000 + DIA_MS });
    expect(c.facilidade).toBe(1.3);
  });
});

// ---------- Painel ----------

describe('painel', () => {
  test('sequência de dias', () => {
    expect(sequenciaDeDias(['2026-10-22', '2026-10-23', '2026-10-24'], '2026-10-24')).toBe(3);
    // ainda não estudou hoje: a sequência de ontem continua
    expect(sequenciaDeDias(['2026-10-22', '2026-10-23'], '2026-10-24')).toBe(2);
    expect(sequenciaDeDias(['2026-10-21'], '2026-10-24')).toBe(0);
    // virada de mês
    expect(sequenciaDeDias(['2026-09-30', '2026-10-01'], '2026-10-01')).toBe(2);
  });

  test('diaLocal formata a data', () => {
    expect(diaLocal(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });

  test('embaralhar: mesma semente, mesma ordem, e nunca igual à original', () => {
    const l = ['I', 'am', 'from', 'Brazil'];
    expect(embaralhar(l, 42)).toEqual(embaralhar(l, 42));
    for (let s = 1; s < 50; s++) {
      const e = embaralhar(l, s);
      expect([...e].sort()).toEqual([...l].sort());
      expect(e).not.toEqual(l);
    }
  });
});
