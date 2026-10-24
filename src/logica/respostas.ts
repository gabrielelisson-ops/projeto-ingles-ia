/**
 * Correção automática dos exercícios.
 *
 * A ideia é ser justo: maiúsculas, pontuação, espaços a mais e
 * contrações ("I'm" = "I am") não contam como erro.
 */
import type { Exercicio } from '../conteudo/schema';

const CONTRACOES: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "we're": 'we are',
  "they're": 'they are',
  "that's": 'that is',
  "what's": 'what is',
  "where's": 'where is',
  "who's": 'who is',
  "how's": 'how is',
  "there's": 'there is',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "won't": 'will not',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "i'd": 'i would',
  "let's": 'let us',
};

/** Deixa a frase num formato único para comparar. */
export function normalizar(texto: string): string {
  let t = texto
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  t = t
    .split(' ')
    .map((p) => CONTRACOES[p] ?? p)
    .join(' ');
  return t.replace(/\bcan not\b/g, 'cannot');
}

export function respostaIgual(dada: string, aceitas: readonly string[]): boolean {
  const d = normalizar(dada);
  if (!d) return false;
  return aceitas.some((a) => normalizar(a) === d);
}

/** Resposta do aluno: índice (múltipla escolha) ou texto. */
export type Resposta = number | string;

export function corrigir(ex: Exercicio, resposta: Resposta): boolean {
  switch (ex.tipo) {
    case 'multipla':
      return resposta === ex.correta;
    case 'completar':
      return typeof resposta === 'string' && respostaIgual(resposta, ex.respostas);
    case 'ordenar':
      return typeof resposta === 'string' && respostaIgual(resposta, [ex.frase]);
    case 'ouvir_escrever':
      return typeof resposta === 'string' && respostaIgual(resposta, [ex.audio, ...(ex.aceitas ?? [])]);
    case 'traduzir':
      return typeof resposta === 'string' && respostaIgual(resposta, ex.respostas);
  }
}

/** Texto da resposta certa, para mostrar ao aluno depois que ele erra. */
export function respostaCerta(ex: Exercicio): string {
  switch (ex.tipo) {
    case 'multipla':
      return ex.opcoes[ex.correta] ?? '';
    case 'completar':
      return ex.frase.replace('___', ex.respostas[0] ?? '');
    case 'ordenar':
      return ex.frase;
    case 'ouvir_escrever':
      return ex.audio;
    case 'traduzir':
      return ex.respostas[0] ?? '';
  }
}

/** Palavras da frase para o exercício de ordenar (sem a pontuação final). */
export function palavrasParaOrdenar(frase: string): string[] {
  return frase
    .replace(/[.!?]+$/, '')
    .split(/\s+/)
    .filter(Boolean);
}
