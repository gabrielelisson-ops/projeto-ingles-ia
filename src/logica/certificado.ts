/**
 * Certificado de conclusão de nível (vira PDF no celular).
 * Todo texto é "escapado" antes de entrar no HTML: um nome como
 * "<b>Ana</b>" aparece exatamente assim, sem virar código.
 */
import type { Nivel } from '../conteudo/schema';

export function esc(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const DESCRICAO_NIVEL: Record<Nivel, string> = {
  A1: 'Básico 1 — consegue se apresentar, falar da rotina e fazer perguntas simples.',
  A2: 'Básico 2 — consegue falar do passado, de planos e resolver situações de viagem e trabalho.',
  B1: 'Intermediário 1 — consegue contar experiências, dar opiniões e lidar com problemas no trabalho.',
  B2: 'Intermediário 2 — consegue participar de reuniões, negociar e escrever e-mails formais.',
  C1: 'Avançado — consegue apresentar, debater e usar inglês corporativo e técnico com naturalidade.',
};

export type DadosCertificado = {
  nome: string;
  nivel: Nivel;
  nomeNivel: string;
  nota: number;
  data: number;
};

export function htmlCertificado(d: DadosCertificado): string {
  const data = new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const nota = Math.max(0, Math.min(100, Math.round(d.nota)));
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1B2430; }
  .folha { box-sizing: border-box; width: 297mm; height: 210mm; padding: 18mm; }
  .moldura { height: 100%; box-sizing: border-box; border: 3mm double #2F6BFF; padding: 14mm; text-align: center; }
  h1 { font-size: 34pt; margin: 4mm 0 2mm; letter-spacing: 1px; }
  .sub { font-size: 13pt; color: #5B6675; margin: 0; }
  .nome { font-size: 30pt; font-weight: bold; margin: 12mm 0 4mm; border-bottom: 1px solid #DCE2EA; display: inline-block; padding: 0 10mm 2mm; }
  .nivel { font-size: 22pt; color: #2F6BFF; margin: 6mm 0 2mm; font-weight: bold; }
  .desc { font-size: 13pt; margin: 0 20mm; }
  .rodape { margin-top: 14mm; font-size: 12pt; color: #5B6675; }
</style></head>
<body><div class="folha"><div class="moldura">
  <p class="sub">Inglês com IA · curso pessoal</p>
  <h1>Certificado de Conclusão</h1>
  <p class="sub">Certificamos que</p>
  <div class="nome">${esc(d.nome)}</div>
  <p class="sub">concluiu com aprovação o nível</p>
  <div class="nivel">${esc(d.nivel)} — ${esc(d.nomeNivel)}</div>
  <p class="desc">${esc(DESCRICAO_NIVEL[d.nivel])}</p>
  <p class="rodape">Nota da prova final: ${nota}/100 · ${esc(data)}<br>
  Referência: Quadro Europeu Comum de Referência para Línguas (CEFR). Certificado de uso pessoal, sem valor oficial.</p>
</div></div></body></html>`;
}
