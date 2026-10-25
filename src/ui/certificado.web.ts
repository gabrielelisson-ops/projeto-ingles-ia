/**
 * Versão web do certificado: abre a janela de impressão do navegador com o
 * certificado. Para guardar o PDF, escolha "Salvar como PDF" como impressora.
 */
import { htmlCertificado, type DadosCertificado } from '../logica/certificado';

export async function compartilharCertificado(d: DadosCertificado): Promise<void> {
  const quadro = document.createElement('iframe');
  quadro.style.position = 'fixed';
  quadro.style.width = '0';
  quadro.style.height = '0';
  quadro.style.border = '0';
  // O HTML do certificado já escapa os textos do aluno (esc). O quadro não executa scripts.
  quadro.setAttribute('sandbox', 'allow-modals allow-same-origin');
  document.body.appendChild(quadro);
  const doc = quadro.contentDocument;
  if (!doc || !quadro.contentWindow) {
    quadro.remove();
    throw new Error('O navegador não permitiu abrir a impressão.');
  }
  doc.open();
  doc.write(htmlCertificado(d).replace('</head>', '<style>@page { size: A4 landscape; margin: 0; }</style></head>'));
  doc.close();
  await new Promise((r) => setTimeout(r, 300));
  quadro.contentWindow.focus();
  quadro.contentWindow.print();
  setTimeout(() => quadro.remove(), 60_000);
}
