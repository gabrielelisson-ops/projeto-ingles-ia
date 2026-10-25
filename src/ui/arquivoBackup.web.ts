/**
 * Versão web do backup: baixa um arquivo .json pelo navegador e importa
 * escolhendo o arquivo no computador. O conteúdo é o mesmo do celular,
 * então dá para levar o progresso do celular para o computador e vice-versa.
 */
import { exportarBackup, TAMANHO_MAX, validarBackup, type ResultadoValidacao } from '../dados/backup';
import type { Banco } from '../dados/banco';
import { diaLocal } from '../logica/estatisticas';

export async function compartilharBackup(db: Banco): Promise<void> {
  const backup = await exportarBackup(db);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-ingles-ia-${diaLocal(Date.now())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Abre a janela de escolher arquivo e valida o backup (não altera nada ainda). */
export function escolherBackup(): Promise<ResultadoValidacao | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    input.onchange = async () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return resolve(null);
      if (arquivo.size > TAMANHO_MAX) return resolve({ ok: false, erro: 'O arquivo é grande demais para ser um backup deste app.' });
      resolve(validarBackup(await arquivo.text()));
    };
    input.click();
  });
}
