/**
 * Proteções da versão web que não dependem do servidor.
 */

/**
 * Verdadeiro se o app foi aberto dentro de um quadro (iframe) de outro site.
 * Um site falso poderia mostrar o app "por baixo" e enganar a pessoa para clicar
 * em botões dele (clickjacking). Na dúvida (o navegador bloqueou o acesso), considera que sim.
 */
export function abertoDentroDeOutroSite(janela: { top: unknown; self: unknown }): boolean {
  try {
    return janela.top !== janela.self;
  } catch {
    return true;
  }
}

export const AVISO_DENTRO_DE_OUTRO_SITE =
  'Por segurança, o curso só abre direto no navegador. Digite o endereço https://projeto-ingles-ia.expo.app na barra de endereços.';
