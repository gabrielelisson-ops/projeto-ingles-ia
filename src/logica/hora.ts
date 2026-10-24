/** Interpreta um horário "HH:MM" (ex.: "07:30"). Devolve null se for inválido. */
export function interpretarHora(texto: string): { hora: number; minuto: number } | null {
  const m = /^\s*(\d{1,2})[:h.](\d{2})\s*$/.exec(texto);
  if (!m) return null;
  const hora = Number(m[1]);
  const minuto = Number(m[2]);
  if (hora > 23 || minuto > 59) return null;
  return { hora, minuto };
}

export function formatarHora(hora: number, minuto: number): string {
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}
