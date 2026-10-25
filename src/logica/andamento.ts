/**
 * Andamento de uma aula ainda não terminada: em que etapa o aluno está, os erros
 * até agora, as questões já respondidas e a conversa com o professor.
 * Fica gravado no aparelho para o aluno continuar de onde parou se sair da aula.
 * O texto gravado é validado ao ler: se estiver estragado, a aula recomeça do início.
 */
import { z } from 'zod';

const txt = (max: number) => z.string().max(max);

const CorrecaoSchema = z.object({ errado: txt(500), certo: txt(500), explicacao_pt: txt(1000) });

const FalaSchema = z.object({
  papel: z.enum(['aluno', 'professor']),
  texto: txt(3000),
  traducao: txt(3000).optional(),
  dica: txt(1000).optional(),
  correcoes: z.array(CorrecaoSchema).max(20).optional(),
});

/** Questões já respondidas numa sequência de exercícios (escuta, prática ou teste rápido). */
const SequenciaSchema = z.object({
  etapa: z.number().int().min(0).max(7),
  tentativa: z.number().int().min(0).max(1000),
  respostas: z
    .array(z.object({ id: txt(80), resposta: z.union([z.number().int().min(0).max(20), txt(600)]), acertou: z.boolean() }))
    .max(50),
});

const ConversaSchema = z.object({
  falas: z.array(FalaSchema).min(1).max(80),
  correcoes: z.array(CorrecaoSchema).max(200),
  segundos: z.number().min(0).max(100_000),
});

export const AndamentoSchema = z.object({
  v: z.literal(1),
  etapa: z.number().int().min(0).max(7),
  erros: z.array(z.object({ pergunta: txt(1000), certo: txt(1000) })).max(200),
  escutaFeita: z.boolean(),
  tentativa: z.number().int().min(0).max(1000),
  sequencia: SequenciaSchema.optional(),
  conversa: ConversaSchema.optional(),
});

export type Andamento = z.infer<typeof AndamentoSchema>;
export type AndamentoSequencia = z.infer<typeof SequenciaSchema>;
export type AndamentoConversa = z.infer<typeof ConversaSchema>;

/** Chave no banco (tabela config). Cada perfil tem o seu andamento em cada aula. */
export function chaveAndamento(perfilId: number, aulaId: string): string {
  return `andamento:${perfilId}:${aulaId}`;
}

/** Lê o andamento gravado; devolve null se não houver ou se estiver inválido. */
export function lerAndamento(texto: string | null | undefined): Andamento | null {
  if (!texto) return null;
  try {
    const r = AndamentoSchema.safeParse(JSON.parse(texto));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

const corta = (t: string, n: number) => (t.length > n ? t.slice(0, n) : t);

/** Corta o que passar dos limites (conversas muito longas, textos enormes), mantendo o mais recente. */
export function limitarAndamento(a: Andamento): Andamento {
  const c = (x: { errado: string; certo: string; explicacao_pt: string }) => ({
    errado: corta(x.errado, 500),
    certo: corta(x.certo, 500),
    explicacao_pt: corta(x.explicacao_pt, 1000),
  });
  return {
    ...a,
    erros: a.erros.slice(-200).map((e) => ({ pergunta: corta(e.pergunta, 1000), certo: corta(e.certo, 1000) })),
    sequencia: a.sequencia && {
      ...a.sequencia,
      respostas: a.sequencia.respostas.slice(0, 50).map((r) => ({ ...r, resposta: typeof r.resposta === 'string' ? corta(r.resposta, 600) : r.resposta })),
    },
    conversa: a.conversa && {
      segundos: Math.min(a.conversa.segundos, 100_000),
      correcoes: a.conversa.correcoes.slice(-200).map(c),
      falas: a.conversa.falas.slice(-80).map((f) => ({
        papel: f.papel,
        texto: corta(f.texto, 3000),
        ...(f.traducao !== undefined && { traducao: corta(f.traducao, 3000) }),
        ...(f.dica !== undefined && { dica: corta(f.dica, 1000) }),
        ...(f.correcoes && { correcoes: f.correcoes.slice(0, 20).map(c) }),
      })),
    },
  };
}

/** Texto para gravar, ou null se algo estiver fora do formato (aí não grava, em vez de gravar lixo). */
export function gravarAndamento(a: Andamento): string | null {
  const r = AndamentoSchema.safeParse(limitarAndamento(a));
  return r.success ? JSON.stringify(r.data) : null;
}

/**
 * Remonta as questões já respondidas a partir dos ids gravados.
 * Se alguma questão não existir mais (o conteúdo da aula mudou), recomeça a sequência.
 */
export function retomarSequencia<E extends { id: string }>(
  lista: E[],
  salvo: AndamentoSequencia | undefined,
  etapa: number,
  tentativa: number,
): { exercicio: E; resposta: number | string; acertou: boolean }[] {
  if (!salvo || salvo.etapa !== etapa || salvo.tentativa !== tentativa) return [];
  if (salvo.respostas.length >= lista.length) return [];
  const r = salvo.respostas.map((s, i) => (lista[i]?.id === s.id ? { exercicio: lista[i]!, resposta: s.resposta, acertou: s.acertou } : null));
  return r.every((x) => x !== null) ? (r as { exercicio: E; resposta: number | string; acertou: boolean }[]) : [];
}
