/** Versão web: no navegador, Alert.alert com botões não faz nada; usamos a confirmação do navegador. */
export async function confirmar(titulo: string, mensagem: string, _botaoSim: string): Promise<boolean> {
  return window.confirm(`${titulo}\n\n${mensagem}`);
}
