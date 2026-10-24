/**
 * Gera o PDF do certificado no próprio celular e abre o menu de compartilhar
 * (salvar nos arquivos, mandar por WhatsApp, imprimir…).
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { htmlCertificado, type DadosCertificado } from '../logica/certificado';

export async function compartilharCertificado(d: DadosCertificado): Promise<void> {
  // A4 deitado, em pontos (1 pt = 1/72 polegada).
  const { uri } = await Print.printToFileAsync({ html: htmlCertificado(d), width: 842, height: 595 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Certificado ${d.nivel}`, UTI: 'com.adobe.pdf' });
  } else {
    throw new Error('O compartilhamento não está disponível neste aparelho.');
  }
}
