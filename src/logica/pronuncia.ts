/**
 * Treino de pronúncia: compara a frase que o aluno devia ler com o que o
 * reconhecimento de voz entendeu e marca cada palavra como reconhecida ou não.
 *
 * Limite honesto: o reconhecimento de voz às vezes "adivinha" a palavra certa
 * mesmo com pronúncia imperfeita. Serve como indicador, não como análise fonética.
 */
import { normalizar } from './respostas';

const UNIDADES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const DEZENAS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0 a 100 por extenso (o reconhecimento de voz costuma devolver números em algarismos). */
export function numeroPorExtenso(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 100) return null;
  if (n === 100) return 'one hundred';
  if (n < 20) return UNIDADES[n]!;
  const d = DEZENAS[Math.floor(n / 10)]!;
  return n % 10 ? `${d}-${UNIDADES[n % 10]}` : d;
}

/** Palavras normalizadas, com números convertidos e hífens separados. */
function palavras(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .flatMap((p) => {
      const n = /^\d+$/.test(p) ? numeroPorExtenso(Number(p)) : null;
      return (n ?? p).split('-');
    })
    .filter(Boolean);
}

export type PalavraAvaliada = { texto: string; ok: boolean };
export type ResultadoPronuncia = { palavras: PalavraAvaliada[]; acertos: number; total: number; porcentagem: number };

/**
 * Alinha as palavras esperadas com as reconhecidas (maior sequência em comum),
 * para que uma palavra a mais ou a menos não estrague o resto da frase.
 */
export function compararPronuncia(esperada: string, reconhecida: string): ResultadoPronuncia {
  const exibidas = esperada.split(/\s+/).filter(Boolean);
  // Cada palavra exibida vira uma ou mais palavras normalizadas (ex.: "I'm" → "i am").
  const unidades = exibidas.map((t) => palavras(t));
  const ouvidas = palavras(reconhecida);
  const U = unidades.length;
  const W = ouvidas.length;

  // melhor[i][j] = maior número de palavras exibidas reconhecidas a partir de (i, j)
  const melhor: number[][] = Array.from({ length: U + 1 }, () => new Array<number>(W + 1).fill(0));
  const casa = (i: number, j: number) => {
    const u = unidades[i]!;
    if (u.length === 0) return 0;
    for (let k = 0; k < u.length; k++) if (ouvidas[j + k] !== u[k]) return 0;
    return u.length;
  };
  for (let i = U - 1; i >= 0; i--) {
    for (let j = W; j >= 0; j--) {
      let v = Math.max(melhor[i + 1]![j]!, j < W ? melhor[i]![j + 1]! : 0);
      const k = j < W ? casa(i, j) : 0;
      if (k) v = Math.max(v, 1 + melhor[i + 1]![j + k]!);
      melhor[i]![j] = v;
    }
  }

  const ok = new Array<boolean>(U).fill(false);
  let i = 0;
  let j = 0;
  while (i < U) {
    const k = j < W ? casa(i, j) : 0;
    if (k && melhor[i]![j] === 1 + melhor[i + 1]![j + k]!) {
      ok[i] = true;
      i++;
      j += k;
    } else if (j < W && melhor[i]![j] === melhor[i]![j + 1]) j++;
    else i++;
  }

  // Pontuação sozinha (ex.: "—") não conta.
  const contam = unidades.map((u) => u.length > 0);
  const total = contam.filter(Boolean).length;
  const acertos = ok.filter((v, idx) => v && contam[idx]).length;
  return {
    palavras: exibidas.map((texto, idx) => ({ texto, ok: ok[idx]! || !contam[idx] })),
    acertos,
    total,
    porcentagem: total ? Math.round((acertos / total) * 100) : 0,
  };
}
