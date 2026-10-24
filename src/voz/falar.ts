/**
 * O celular falando (texto → voz), com a voz do próprio aparelho. Grátis e offline.
 */
import * as Speech from 'expo-speech';
import type { Nivel } from '../conteudo/schema';
import { escolherVozes, velocidade, type Sotaque } from './vozes';

let vozes: { sotaque: Sotaque; a?: string; b?: string } | null = null;

async function vozesPara(sotaque: Sotaque) {
  if (vozes?.sotaque === sotaque) return vozes;
  try {
    const lista = await Speech.getAvailableVoicesAsync();
    vozes = { sotaque, ...escolherVozes(lista, sotaque) };
  } catch {
    vozes = { sotaque };
  }
  return vozes;
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
  const v = await vozesPara(o.sotaque);
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
