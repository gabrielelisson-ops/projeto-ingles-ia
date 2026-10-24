/** Data e hora curtas, no padrão brasileiro (ex.: 25/10, 14:30). */
export function quando(ms: number) {
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function dataCurta(ms: number) {
  return new Date(ms).toLocaleDateString('pt-BR');
}
