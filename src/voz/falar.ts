/**
 * O celular falando (texto → voz), com a voz do próprio aparelho. Grátis e offline.
 */
import * as Speech from 'expo-speech';
import type { Nivel } from '../conteudo/schema';
import { escolherVozes, velocidade, vozesAdultas, type Sotaque, type VozDisponivel } from './vozes';

let vozes: { sotaque: Sotaque; preferida?: string; a?: string; b?: string } | null = null;

async function vozesPara(sotaque: Sotaque, preferida?: string) {
  if (vozes?.sotaque === sotaque && vozes.preferida === preferida && vozes.a) return vozes;
  try {
    const lista = await Speech.getAvailableVoicesAsync();
    vozes = { sotaque, preferida, ...escolherVozes(lista, sotaque, preferida) };
  } catch {
    vozes = { sotaque, preferida };
  }
  return vozes;
}

let preferidas: Partial<Record<Sotaque, string>> = {};

/** Voz escolhida em Configurações para cada sotaque (o app chama ao carregar as preferências). */
export function definirVozesPreferidas(v: Partial<Record<Sotaque, string>>) {
  preferidas = { ...v };
}

/** Vozes adultas deste aparelho no sotaque pedido, para escolher em Configurações. */
export async function listarVozes(sotaque: Sotaque): Promise<VozDisponivel[]> {
  try {
    return vozesAdultas(await Speech.getAvailableVoicesAsync(), sotaque);
  } catch {
    return [];
  }
}

export type OpcoesFala = {
  nivel: Nivel;
  sotaque: Sotaque;
  ajuste?: number;
  devagar?: boolean;
  voz?: 'a' | 'b';
};

/** Fala o texto e resolve a promessa quando termina (ou é interrompido). */
export async function falar(texto: string, o: OpcoesFala): Promise<void> {
  await Speech.stop();
  const v = await vozesPara(o.sotaque, preferidas[o.sotaque]);
  const voz = o.voz === 'b' ? v.b : v.a;
  return new Promise((resolve) => {
    Speech.speak(texto.slice(0, 3000), {
      language: o.sotaque,
      voice: voz,
      rate: velocidade(o.nivel, o.ajuste, o.devagar),
      // Sem uma segunda voz no aparelho, muda o tom para diferenciar as pessoas do diálogo.
      pitch: o.voz === 'b' && v.b === v.a ? 0.85 : 1,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

/** Explicações em português (botão "Não entendi"). */
export async function falarPortugues(texto: string): Promise<void> {
  await Speech.stop();
  return new Promise((resolve) => {
    Speech.speak(texto.slice(0, 3000), { language: 'pt-BR', rate: 1, onDone: () => resolve(), onStopped: () => resolve(), onError: () => resolve() });
  });
}

export function pararFala() {
  void Speech.stop();
}
