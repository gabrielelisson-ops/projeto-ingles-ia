/**
 * Escolha de voz e velocidade (lógica pura, testável).
 */
import type { Nivel } from '../conteudo/schema';

export type Sotaque = 'en-US' | 'en-GB';

/** No A1 o professor fala devagar; no C1, em velocidade normal. */
export const VELOCIDADE_POR_NIVEL: Record<Nivel, number> = { A1: 0.75, A2: 0.85, B1: 0.95, B2: 1.0, C1: 1.05 };
export const FATOR_DEVAGAR = 0.7;

export function velocidade(nivel: Nivel, ajusteUsuario = 1, devagar = false): number {
  const v = VELOCIDADE_POR_NIVEL[nivel] * ajusteUsuario * (devagar ? FATOR_DEVAGAR : 1);
  return Math.round(Math.min(1.5, Math.max(0.4, v)) * 100) / 100;
}

export type VozDisponivel = { identifier: string; language: string; quality?: string };

const normalizaIdioma = (l: string) => l.replace('_', '-').toLowerCase();

/**
 * Escolhe até duas vozes do sotaque pedido (diálogos usam voz "a" e "b").
 * Prefere vozes que funcionam sem internet e de melhor qualidade.
 */
export function escolherVozes(vozes: VozDisponivel[], sotaque: Sotaque): { a?: string; b?: string } {
  const alvo = sotaque.toLowerCase();
  const doSotaque = vozes.filter((v) => normalizaIdioma(v.language) === alvo);
  const pontos = (v: VozDisponivel) =>
    (v.quality === 'Enhanced' ? 2 : 0) + (/network/i.test(v.identifier) ? 0 : 1);
  const ordenadas = [...doSotaque].sort((x, y) => pontos(y) - pontos(x) || x.identifier.localeCompare(y.identifier));
  return { a: ordenadas[0]?.identifier, b: ordenadas[1]?.identifier ?? ordenadas[0]?.identifier };
}
