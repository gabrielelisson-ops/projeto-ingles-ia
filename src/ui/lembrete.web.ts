/**
 * Versão web: o navegador não agenda notificações diárias sem um servidor.
 * A tela de Configurações esconde o lembrete quando LEMBRETE_DISPONIVEL é false.
 */
export const LEMBRETE_DISPONIVEL = false;

export function configurarExibicaoDeNotificacoes() {}

export async function aplicarLembrete(_ativo: boolean, _horario: string): Promise<void> {
  throw new Error('O lembrete diário só existe no app do celular. No computador, use um alarme ou a agenda.');
}
