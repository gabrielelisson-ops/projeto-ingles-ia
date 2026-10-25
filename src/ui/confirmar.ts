/** Pergunta de confirmação (sim/não). No celular usa a caixa de diálogo do sistema. */
import { Alert } from 'react-native';

export function confirmar(titulo: string, mensagem: string, botaoSim: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: botaoSim, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
