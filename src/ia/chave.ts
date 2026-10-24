/**
 * Guarda a chave da API no cofre do celular (expo-secure-store, criptografado
 * pelo Android Keystore). A chave nunca vai para o SQLite, para o backup
 * nem para o código.
 */
import * as SecureStore from 'expo-secure-store';

const NOME = 'gemini_api_key';

/** Formato das chaves do Google AI Studio: letras, números, _ e -, sem espaços. */
export function chaveComFormatoValido(chave: string): boolean {
  return /^[A-Za-z0-9_-]{30,100}$/.test(chave.trim());
}

export async function lerChave(): Promise<string> {
  return (await SecureStore.getItemAsync(NOME)) ?? '';
}

export async function salvarChave(chave: string): Promise<void> {
  const c = chave.trim();
  if (!chaveComFormatoValido(c)) throw new Error('Essa chave não parece válida. Copie de novo no Google AI Studio.');
  await SecureStore.setItemAsync(NOME, c);
}

export async function apagarChave(): Promise<void> {
  await SecureStore.deleteItemAsync(NOME);
}

/** Mostra só o começo e o fim, para conferir sem expor a chave. */
export function mascararChave(chave: string): string {
  return chave.length > 8 ? `${chave.slice(0, 4)}…${chave.slice(-4)}` : '••••';
}
