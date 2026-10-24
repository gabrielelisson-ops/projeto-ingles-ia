/**
 * Revisão espaçada (algoritmo SM-2, o mesmo princípio do Anki).
 *
 * Cada palavra/frase/erro tem um "intervalo" em dias. Lembrou bem → o
 * intervalo cresce (1, 6, 15, 38 dias…). Esqueceu → volta para amanhã.
 * Assim você revisa pouco o que já sabe e muito o que ainda erra.
 */
export const DIA_MS = 24 * 60 * 60 * 1000;

export type CartaoRevisao = {
  /** Quantas vezes seguidas o aluno acertou. */
  repeticoes: number;
  /** Intervalo atual, em dias. */
  intervalo: number;
  /** "Facilidade": começa em 2,5 e nunca fica abaixo de 1,3. */
  facilidade: number;
  /** Quando deve ser revisado (milissegundos). */
  proxima: number;
};

/** Qualidade da lembrança, de 0 (não lembrei nada) a 5 (perfeito). */
export type Qualidade = 0 | 1 | 2 | 3 | 4 | 5;

export function novoCartao(agora: number): CartaoRevisao {
  return { repeticoes: 0, intervalo: 0, facilidade: 2.5, proxima: agora };
}

export function revisar(c: CartaoRevisao, q: Qualidade, agora: number): CartaoRevisao {
  const facilidade = Math.max(1.3, c.facilidade + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (q < 3) {
    return { repeticoes: 0, intervalo: 1, facilidade, proxima: agora + DIA_MS };
  }
  const repeticoes = c.repeticoes + 1;
  const intervalo = repeticoes === 1 ? 1 : repeticoes === 2 ? 6 : Math.round(c.intervalo * c.facilidade);
  return { repeticoes, intervalo, facilidade, proxima: agora + intervalo * DIA_MS };
}

export function estaVencido(c: CartaoRevisao, agora: number): boolean {
  return c.proxima <= agora;
}
