/**
 * Funções de alto nível: conversar com o professor e avaliar respostas da prova.
 * As respostas da IA são validadas e "aparadas" (tamanhos máximos) antes de ir para a tela.
 */
import { z } from 'zod';
import { notaDaTarefa } from '../logica/notas';
import { MODELO_AVALIACAO_PADRAO, MODELO_CONVERSA_PADRAO, pedirJSON, type Mensagem } from './gemini';
import { promptAvaliador, promptProfessor, type ContextoAvaliador, type ContextoProfessor } from './prompts';

const txt = (max: number) => z.string().transform((s) => s.trim().slice(0, max));

const CorrecaoSchema = z.object({
  errado: txt(200),
  certo: txt(200),
  explicacao_pt: txt(300).catch(''),
});

export const RespostaProfessorSchema = z.object({
  resposta: txt(1200).refine((s) => s.length > 0),
  traducao_pt: txt(1200).catch(''),
  correcoes: z
    .array(CorrecaoSchema)
    .catch([])
    .transform((l) => l.filter((c) => c.errado && c.certo).slice(0, 2)),
  dica: txt(300).catch(''),
  palavras_novas: z
    .array(z.string())
    .catch([])
    .transform((l) => l.map((s) => s.trim().slice(0, 40)).filter(Boolean).slice(0, 8)),
});
export type RespostaProfessor = z.infer<typeof RespostaProfessorSchema>;

const nota = z.coerce.number().transform((n) => (Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : 0));

export const AvaliacaoSchema = z.object({
  gramatica: nota,
  vocabulario: nota,
  fluencia: nota,
  pronuncia: nota.nullable().optional(),
  feedback_pt: txt(600).catch(''),
  erros: z
    .array(CorrecaoSchema)
    .catch([])
    .transform((l) => l.slice(0, 3)),
});
export type AvaliacaoIA = z.infer<typeof AvaliacaoSchema>;

export type ModelosIA = { conversa: string; avaliacao: string };
export const MODELOS_PADRAO: ModelosIA = { conversa: MODELO_CONVERSA_PADRAO, avaliacao: MODELO_AVALIACAO_PADRAO };

/** Tamanho máximo de cada fala do aluno enviada à IA. */
export const MAX_FALA_ALUNO = 600;
/** Quantas mensagens anteriores vão junto (economiza o limite grátis). */
const HISTORICO_MAX = 12;

export function prepararHistorico(historico: Mensagem[]): Mensagem[] {
  const recentes = historico.slice(-HISTORICO_MAX).map((m) => ({ ...m, texto: m.texto.slice(0, MAX_FALA_ALUNO) }));
  // A API exige que a conversa comece pelo aluno.
  while (recentes.length && recentes[0]!.papel !== 'aluno') recentes.shift();
  return recentes;
}

export async function falarComProfessor(
  chave: string,
  modelos: ModelosIA,
  contexto: ContextoProfessor,
  historico: Mensagem[],
  fetchFn?: typeof fetch,
): Promise<RespostaProfessor> {
  const ab = historico.find((m) => m.papel === 'professor');
  const msgs = prepararHistorico(historico);
  // A abertura do professor (fixa no conteúdo) entra como contexto.
  const sistema = promptProfessor(contexto) + (ab ? `\n\nVocê abriu a conversa dizendo: "${ab.texto.slice(0, 300)}"` : '');
  return pedirJSON({
    chave,
    modelos: [modelos.conversa, modelos.avaliacao],
    sistema,
    mensagens: msgs,
    schema: RespostaProfessorSchema,
    temperatura: 0.8,
    fetchFn,
  });
}

export type ResultadoAvaliacao = AvaliacaoIA & { nota: number };

export async function avaliarResposta(
  chave: string,
  modelos: ModelosIA,
  contexto: ContextoAvaliador,
  respostaAluno: string,
  fetchFn?: typeof fetch,
  limite = 1500,
): Promise<ResultadoAvaliacao> {
  const texto = respostaAluno.trim().slice(0, limite);
  if (!texto) {
    return { gramatica: 0, vocabulario: 0, fluencia: 0, pronuncia: 0, feedback_pt: 'Nenhuma resposta foi dada.', erros: [], nota: 0 };
  }
  const av = await pedirJSON({
    chave,
    modelos: [modelos.avaliacao, modelos.conversa],
    sistema: promptAvaliador(contexto),
    mensagens: [{ papel: 'aluno', texto: `Resposta do aluno:\n"""\n${texto}\n"""` }],
    schema: AvaliacaoSchema,
    temperatura: 0.2,
    fetchFn,
  });
  const n = notaDaTarefa(
    { gramatica: av.gramatica, vocabulario: av.vocabulario, fluencia: av.fluencia, pronuncia: av.pronuncia ?? 0 },
    contexto.parte,
  );
  return { ...av, nota: Math.round(n * 10) / 10 };
}

/** Teste rápido da chave: faz um pedido mínimo e diz qual modelo respondeu. */
export async function testarChave(chave: string, modelos: ModelosIA, fetchFn?: typeof fetch): Promise<string> {
  const resultado: string[] = [];
  for (const m of [modelos.conversa, modelos.avaliacao]) {
    await pedirJSON({
      chave,
      modelos: [m],
      sistema: 'Responda apenas {"ok": true}.',
      mensagens: [{ papel: 'aluno', texto: 'teste' }],
      schema: z.object({ ok: z.literal(true) }),
      temperatura: 0,
      fetchFn,
    });
    resultado.push(m);
  }
  return resultado.join(' e ');
}

/** Monta a transcrição da entrevista (perguntas do professor e respostas do aluno) para o avaliador. */
export function transcricaoEntrevista(falas: Mensagem[]): string {
  return falas
    .map((f) => `${f.papel === 'aluno' ? 'ALUNO' : 'EXAMINADOR'}: ${f.texto.replace(/\s+/g, ' ').trim().slice(0, 400)}`)
    .join('\n')
    .slice(0, 6000);
}
