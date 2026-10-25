/**
 * O navegador falando (texto → voz), com a voz do próprio aparelho.
 *
 * Versão própria para a web por causa do Safari do iPhone:
 * - ele só libera o som depois de um toque na tela, e a fala precisa começar
 *   logo após o toque, sem esperar nada antes (por isso nada aqui é "await");
 * - a lista de vozes às vezes demora ou nunca chega, então nunca esperamos por ela.
 */
import type { Nivel } from '../conteudo/schema';
import { escolherVozes, velocidade, vozesAdultas, type Sotaque, type VozDisponivel } from './vozes';

function sintese(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function vozesDoNavegador(): SpeechSynthesisVoice[] {
  try {
    return sintese()?.getVoices() ?? [];
  } catch {
    return [];
  }
}

const comoDisponivel = (v: SpeechSynthesisVoice): VozDisponivel => ({ identifier: v.voiceURI, name: v.name, language: v.lang });

// iPhone: o primeiro toque na tela "destrava" o som com uma fala vazia.
let destravado = false;
function destravar() {
  const s = sintese();
  if (destravado || !s) return;
  destravado = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    s.speak(u);
  } catch {
    // sem síntese de voz neste navegador
  }
}
if (typeof document !== 'undefined') {
  for (const ev of ['touchend', 'click', 'keydown'] as const) document.addEventListener(ev, destravar, { capture: true, passive: true });
}

let preferidas: Partial<Record<Sotaque, string>> = {};

/** Voz escolhida em Configurações para cada sotaque (o app chama ao carregar as preferências). */
export function definirVozesPreferidas(v: Partial<Record<Sotaque, string>>) {
  preferidas = { ...v };
}

/** Vozes adultas deste navegador no sotaque pedido. Espera a lista chegar por no máximo 2 segundos. */
export async function listarVozes(sotaque: Sotaque): Promise<VozDisponivel[]> {
  const s = sintese();
  if (!s) return [];
  if (vozesDoNavegador().length === 0) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 2000);
      s.addEventListener('voiceschanged', () => {
        clearTimeout(t);
        resolve();
      }, { once: true });
    });
  }
  return vozesAdultas(vozesDoNavegador().map(comoDisponivel), sotaque);
}

export type OpcoesFala = {
  nivel: Nivel;
  sotaque: Sotaque;
  ajuste?: number;
  devagar?: boolean;
  voz?: 'a' | 'b';
};

/** Começa a falar na hora (sem esperar nada) e resolve a promessa quando termina. */
function dizer(texto: string, lang: string, rate: number, pitch: number, vozId?: string): Promise<void> {
  const s = sintese();
  if (!s) return Promise.resolve();
  return new Promise((resolve) => {
    let fim = false;
    const terminar = () => {
      if (fim) return;
      fim = true;
      clearTimeout(seguranca);
      resolve();
    };
    // Se o navegador nunca avisar o fim (acontece no Safari), não trava a tela.
    const seguranca = setTimeout(terminar, 2000 + (texto.length * 120) / rate);
    try {
      s.cancel();
      const u = new SpeechSynthesisUtterance(texto.slice(0, 3000));
      u.lang = lang;
      u.rate = rate;
      u.pitch = pitch;
      const voz = vozId ? vozesDoNavegador().find((v) => v.voiceURI === vozId) : undefined;
      if (voz) u.voice = voz;
      u.onend = terminar;
      u.onerror = terminar;
      s.speak(u);
      // Safari às vezes deixa a fala "pausada" depois de outra aba ou de bloquear a tela.
      s.resume();
    } catch {
      terminar();
    }
  });
}

/** Fala o texto e resolve a promessa quando termina (ou é interrompido). */
export function falar(texto: string, o: OpcoesFala): Promise<void> {
  const v = escolherVozes(vozesDoNavegador().map(comoDisponivel), o.sotaque, preferidas[o.sotaque]);
  const vozId = o.voz === 'b' ? v.b : v.a;
  // Sem uma segunda voz, muda o tom para diferenciar as pessoas do diálogo.
  const pitch = o.voz === 'b' && v.b === v.a ? 0.85 : 1;
  return dizer(texto, o.sotaque, velocidade(o.nivel, o.ajuste, o.devagar), pitch, vozId);
}

/** Explicações em português (botão "Não entendi"). */
export function falarPortugues(texto: string): Promise<void> {
  return dizer(texto, 'pt-BR', 1, 1);
}

export function pararFala() {
  try {
    sintese()?.cancel();
  } catch {
    // sem síntese de voz neste navegador
  }
}
