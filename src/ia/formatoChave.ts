/** Regras da chave da IA que valem para o celular e para a web. */

/**
 * Formato das chaves do Google AI Studio: letras, números, _, - e ponto, sem espaços.
 * Há chaves antigas ("AIza…") e novas ("AQ.…", com ponto).
 */
export function chaveComFormatoValido(chave: string): boolean {
  return /^[A-Za-z0-9_.-]{30,120}$/.test(chave.trim());
}

/** Mostra só o começo e o fim, para conferir sem expor a chave. */
export function mascararChave(chave: string): string {
  return chave.length > 8 ? `${chave.slice(0, 4)}…${chave.slice(-4)}` : '••••';
}

export const ERRO_FORMATO_CHAVE = 'Essa chave não parece válida. Copie de novo no Google AI Studio.';
