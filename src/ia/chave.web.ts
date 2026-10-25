/**
 * Versão web: o navegador não tem um cofre como o do celular. A chave fica no
 * armazenamento local deste navegador (localStorage), separada do banco e fora
 * do backup. Só este site, neste navegador, consegue lê-la. Por isso: use um
 * perfil de navegador só seu e não use em computador compartilhado.
 */
import { chaveComFormatoValido, ERRO_FORMATO_CHAVE } from './formatoChave';

export { chaveComFormatoValido, mascararChave } from './formatoChave';

const NOME = 'gemini_api_key';

function armazenamento(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // alguns modos de navegação privada bloqueiam o acesso
  }
}

export async function lerChave(): Promise<string> {
  return armazenamento()?.getItem(NOME) ?? '';
}

export async function salvarChave(chave: string): Promise<void> {
  const c = chave.trim();
  if (!chaveComFormatoValido(c)) throw new Error(ERRO_FORMATO_CHAVE);
  const a = armazenamento();
  if (!a) throw new Error('Este navegador não permite guardar a chave. Saia da janela anônima e tente de novo.');
  a.setItem(NOME, c);
}

export async function apagarChave(): Promise<void> {
  armazenamento()?.removeItem(NOME);
}
