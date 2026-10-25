/**
 * Guarda a chave da API no cofre do celular (expo-secure-store, criptografado
 * pelo Android Keystore / iOS Keychain). A chave nunca vai para o SQLite, para
 * o backup nem para o código. A versão web fica em chave.web.ts.
 */
import * as SecureStore from 'expo-secure-store';
import { chaveComFormatoValido, ERRO_FORMATO_CHAVE } from './formatoChave';

export { chaveComFormatoValido, mascararChave } from './formatoChave';

const NOME = 'gemini_api_key';

export async function lerChave(): Promise<string> {
  return (await SecureStore.getItemAsync(NOME)) ?? '';
}

export async function salvarChave(chave: string): Promise<void> {
  const c = chave.trim();
  if (!chaveComFormatoValido(c)) throw new Error(ERRO_FORMATO_CHAVE);
  await SecureStore.setItemAsync(NOME, c);
}

export async function apagarChave(): Promise<void> {
  await SecureStore.deleteItemAsync(NOME);
}
