/**
 * Lembrete diário de estudo (notificação local: não precisa de servidor nem internet).
 */
import * as Notifications from 'expo-notifications';
import { interpretarHora } from '../logica/hora';

const CANAL = 'lembrete-diario';

/** No celular o lembrete existe; na web (lembrete.web.ts) não. */
export const LEMBRETE_DISPONIVEL = true;

/** Mostra a notificação mesmo com o app aberto. */
export function configurarExibicaoDeNotificacoes() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Liga (no horário "HH:MM") ou desliga o lembrete diário. */
export async function aplicarLembrete(ativo: boolean, horario: string): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!ativo) return;
  const h = interpretarHora(horario);
  if (!h) throw new Error('Horário inválido. Use o formato 07:30.');
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) {
    throw new Error('O Android não permitiu notificações. Libere em Configurações do Android › Apps › Inglês com IA › Notificações.');
  }
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Lembrete diário',
    // AndroidImportance é reexportado por "export *"; o plugin de import do lint não o enxerga.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Hora do inglês! 🇺🇸', body: 'Seu professor está esperando. Que tal 15 minutinhos hoje?' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h.hora, minute: h.minuto, channelId: CANAL },
  });
}
