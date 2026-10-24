/**
 * Exportar e importar o arquivo de backup no celular.
 * O arquivo pode ter dados pessoais (nomes, progresso): guarde num lugar seguro.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportarBackup, TAMANHO_MAX, validarBackup, type ResultadoValidacao } from '../dados/backup';
import type { Banco } from '../dados/banco';
import { diaLocal } from '../logica/estatisticas';

export async function compartilharBackup(db: Banco): Promise<void> {
  const backup = await exportarBackup(db);
  const arquivo = new File(Paths.cache, `backup-ingles-ia-${diaLocal(Date.now())}.json`);
  if (arquivo.exists) arquivo.delete();
  arquivo.create();
  await arquivo.write(JSON.stringify(backup));
  if (!(await Sharing.isAvailableAsync())) throw new Error('O compartilhamento não está disponível neste aparelho.');
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/json', dialogTitle: 'Salvar backup do Inglês com IA' });
}

/** Abre o seletor de arquivos e valida o backup escolhido (não altera nada ainda). */
export async function escolherBackup(): Promise<ResultadoValidacao | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  if (a.size != null && a.size > TAMANHO_MAX) return { ok: false, erro: 'O arquivo é grande demais para ser um backup deste app.' };
  const texto = await new File(a.uri).text();
  return validarBackup(texto);
}
