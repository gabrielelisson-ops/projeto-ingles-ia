/**
 * Cálculo de notas.
 *
 * Teste rápido: 5 perguntas, precisa acertar pelo menos 4.
 * Provas: 4 partes (leitura, escuta, escrita, fala) com o MESMO peso.
 * A nota final é a média das partes, de 0 a 100. Aprova com 70.
 */
import { NOTA_APROVACAO } from './desbloqueio';

export const ACERTOS_MINIMOS_TESTE = 4;

export function testeRapidoAprovado(acertos: number, total = 5): boolean {
  if (total <= 0) return false;
  // Proporcional a 4 de 5 caso o teste tenha outro tamanho.
  return acertos >= Math.ceil((ACERTOS_MINIMOS_TESTE / 5) * total);
}

/** Notas que o avaliador de IA devolve, cada uma de 0 a 10. */
export type Avaliacao = {
  gramatica: number;
  vocabulario: number;
  fluencia: number;
  /** Só existe na parte de fala. */
  pronuncia?: number;
};

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Nota de uma tarefa de escrita ou fala, de 0 a 10 (média dos critérios). */
export function notaDaTarefa(av: Avaliacao, tipo: 'escrita' | 'fala'): number {
  const criterios = [av.gramatica, av.vocabulario, av.fluencia];
  if (tipo === 'fala') criterios.push(av.pronuncia ?? 0);
  const valores = criterios.map((c) => (Number.isFinite(c) ? limitar(c, 0, 10) : 0));
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

export type Parte = 'leitura' | 'escuta' | 'escrita' | 'fala';
export const NOMES_PARTES: Record<Parte, string> = {
  leitura: 'Leitura',
  escuta: 'Escuta (listening)',
  escrita: 'Escrita',
  fala: 'Fala (speaking)',
};

export type EntradaProva = {
  leitura: { acertos: number; total: number };
  escuta: { acertos: number; total: number };
  /** Nota de cada tarefa, de 0 a 10. */
  escrita: number[];
  fala: number[];
};

export type ResultadoProva = {
  partes: Record<Parte, number>;
  nota: number;
  aprovado: boolean;
  /** Partes abaixo de 70, que viram sugestão de revisão. */
  pontosFracos: Parte[];
};

const pct = (acertos: number, total: number) => (total > 0 ? (limitar(acertos, 0, total) / total) * 100 : 0);
const mediaDe10 = (notas: number[]) =>
  notas.length ? (notas.reduce((s, n) => s + limitar(n, 0, 10), 0) / notas.length) * 10 : 0;

export function calcularProva(e: EntradaProva): ResultadoProva {
  const partes: Record<Parte, number> = {
    leitura: Math.round(pct(e.leitura.acertos, e.leitura.total)),
    escuta: Math.round(pct(e.escuta.acertos, e.escuta.total)),
    escrita: Math.round(mediaDe10(e.escrita)),
    fala: Math.round(mediaDe10(e.fala)),
  };
  const valores = Object.values(partes);
  const nota = Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
  const pontosFracos = (Object.keys(partes) as Parte[]).filter((p) => partes[p] < NOTA_APROVACAO);
  return { partes, nota, aprovado: nota >= NOTA_APROVACAO, pontosFracos };
}
