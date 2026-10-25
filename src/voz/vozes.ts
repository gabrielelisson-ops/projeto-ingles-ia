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

export type VozDisponivel = { identifier: string; language: string; quality?: string; name?: string };

const normalizaIdioma = (l: string) => l.replace('_', '-').toLowerCase();

/**
 * Vozes que não servem para um professor: infantis (Microsoft Ana, Apple Junior)
 * e de brincadeira do iPhone/Mac (Bubbles, Zarvox, Good News…).
 */
const VOZ_INADEQUADA =
  /\b(ana|junior|princess|bubbles|bahh|bells|boing|cellos|good news|bad news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|deranged|hysterical)\b/i;

/** Vozes adultas naturais conhecidas (Edge, Chrome, iPhone, Mac e Windows). */
const VOZ_BOA =
  /\b(aria|jenny|guy|ava|andrew|emma|brian|christopher|eric|michelle|roger|steffan|libby|ryan|sonia|thomas|maisie|samantha|alex|daniel|kate|serena|arthur|martha|oliver|tom|allison|susan|nathan|evan|zoe|joelle|noelle|nicky|aaron|google (us|uk) english)\b/i;

const textoDaVoz = (v: VozDisponivel) => `${v.name ?? ''} ${v.identifier}`;

/** Falsa se a voz for infantil, de brincadeira ou da família antiga de efeitos da Apple. */
export function vozAdequada(v: VozDisponivel): boolean {
  if (/com\.apple\.speech\.synthesis\.voice\./i.test(v.identifier)) return false;
  return !VOZ_INADEQUADA.test(textoDaVoz(v));
}

function pontos(v: VozDisponivel): number {
  const t = textoDaVoz(v);
  let p = 0;
  if (/natural|neural|premium|enhanced|siri/i.test(t) || v.quality === 'Enhanced') p += 4;
  if (VOZ_BOA.test(t)) p += 2;
  // Android: prefere as que funcionam sem internet.
  if (!/-network\b|network$/i.test(v.identifier)) p += 1;
  // Vozes antigas e robóticas do iPhone/Mac (Eddy, Flo, Grandma…) só em último caso.
  if (/com\.apple\.eloquence\./i.test(v.identifier)) p -= 3;
  return p;
}

/** Vozes adultas do sotaque pedido, da melhor para a pior. */
export function vozesAdultas(vozes: VozDisponivel[], sotaque: Sotaque): VozDisponivel[] {
  const alvo = sotaque.toLowerCase();
  return vozes
    .filter((v) => normalizaIdioma(v.language) === alvo && vozAdequada(v))
    .sort((x, y) => pontos(y) - pontos(x) || x.identifier.localeCompare(y.identifier));
}

/** Nome para mostrar na tela ("Microsoft Aria Online (Natural) - English…" → "Aria"). */
export function nomeDaVoz(v: VozDisponivel, posicao: number): string {
  const n = (v.name ?? '').trim();
  if (!n || (n === v.identifier && /-x-|_/.test(n))) return `Voz ${posicao + 1}`;
  const limpo = n.replace(/^(Microsoft|Google)\s+/i, '').replace(/\s+-\s+.*$/, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+Online\b/i, '').trim();
  return limpo || `Voz ${posicao + 1}`;
}

/**
 * Escolhe até duas vozes do sotaque pedido (diálogos usam voz "a" e "b").
 * A voz escolhida pela pessoa em Configurações vem primeiro, se existir neste aparelho.
 */
export function escolherVozes(vozes: VozDisponivel[], sotaque: Sotaque, preferida?: string): { a?: string; b?: string } {
  const ordenadas = vozesAdultas(vozes, sotaque).map((v) => v.identifier);
  if (preferida && ordenadas.includes(preferida)) {
    ordenadas.splice(ordenadas.indexOf(preferida), 1);
    ordenadas.unshift(preferida);
  }
  return { a: ordenadas[0], b: ordenadas[1] ?? ordenadas[0] };
}

/** Identificador de voz aceito nas preferências (vem do aparelho; só limita tamanho e caracteres). */
export const VOZ_VALIDA = /^[^\u0000-\u001f\u007f]{1,200}$/;
