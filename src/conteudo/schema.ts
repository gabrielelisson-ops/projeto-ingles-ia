/**
 * Formato oficial (schema) dos arquivos de conteúdo do curso.
 *
 * Todo arquivo JSON em `conteudo/` passa por aqui antes de ser usado.
 * Se algo estiver errado (campo faltando, resposta inexistente etc.),
 * a validação diz exatamente onde está o problema.
 */
import { z } from 'zod';

export const NIVEIS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type Nivel = (typeof NIVEIS)[number];

const texto = (max = 600) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[a-z0-9-]+$/, 'use só letras minúsculas, números e hífen');

// ---------- Exercícios ----------

const base = {
  id,
  /** Explicação mostrada depois que o aluno responde. */
  explicacao_pt: texto(400).optional(),
};

export const MultiplaSchema = z
  .object({
    ...base,
    tipo: z.literal('multipla'),
    enunciado: texto(300),
    /** Se presente, o app lê este texto em voz alta antes das opções. */
    audio: texto(300).optional(),
    opcoes: z.array(texto(150)).min(2).max(5),
    correta: z.number().int().min(0),
  })
  .refine((e) => e.correta < e.opcoes.length, { message: '"correta" aponta para uma opção que não existe' });

export const CompletarSchema = z.object({
  ...base,
  tipo: z.literal('completar'),
  /** Use ___ (três sublinhados) onde fica a lacuna. */
  frase: texto(200).refine((f) => f.includes('___'), 'a frase precisa ter ___'),
  respostas: z.array(texto(80)).min(1),
  dica_pt: texto(150).optional(),
});

export const OrdenarSchema = z.object({
  ...base,
  tipo: z.literal('ordenar'),
  /** Frase correta; o app embaralha as palavras. */
  frase: texto(200).refine((f) => f.split(/\s+/).length >= 2, 'precisa de pelo menos 2 palavras'),
  traducao_pt: texto(200).optional(),
});

export const OuvirEscreverSchema = z.object({
  ...base,
  tipo: z.literal('ouvir_escrever'),
  audio: texto(200),
  /** Outras formas aceitas além do próprio texto do áudio. */
  aceitas: z.array(texto(200)).optional(),
});

export const TraduzirSchema = z.object({
  ...base,
  tipo: z.literal('traduzir'),
  pt: texto(200),
  respostas: z.array(texto(200)).min(1),
});

export const ExercicioSchema = z.union([
  MultiplaSchema,
  CompletarSchema,
  OrdenarSchema,
  OuvirEscreverSchema,
  TraduzirSchema,
]);
export type Exercicio = z.infer<typeof ExercicioSchema>;

// ---------- Partes de uma aula ----------

export const PalavraSchema = z.object({
  id,
  en: texto(80),
  pt: texto(80),
  emoji: texto(16),
  exemplo_en: texto(200),
  exemplo_pt: texto(200),
});
export type Palavra = z.infer<typeof PalavraSchema>;

export const FalaSchema = z.object({
  personagem: texto(40),
  /** Duas vozes diferentes no diálogo: "a" ou "b". */
  voz: z.enum(['a', 'b']),
  en: texto(300),
  pt: texto(300),
});
export type Fala = z.infer<typeof FalaSchema>;

export const ConversaSchema = z.object({
  /** Situação explicada ao aluno, em português. */
  situacao_pt: texto(300),
  /** Instrução extra para o professor de IA (papel que ele faz). */
  papel_professor: texto(400),
  /** Primeira frase do professor (falada sem chamar a IA). */
  abertura: texto(300),
  /** Tradução da abertura (botão "Não entendi"). */
  abertura_pt: texto(300),
});
export type Conversa = z.infer<typeof ConversaSchema>;

export const GramaticaSchema = z.object({
  titulo: texto(100),
  explicacao_pt: texto(1200),
  tabela: z
    .object({
      colunas: z.array(texto(40)).min(2).max(4),
      linhas: z.array(z.array(texto(80))).min(1).max(12),
    })
    .refine((t) => t.linhas.every((l) => l.length === t.colunas.length), {
      message: 'toda linha da tabela precisa ter o mesmo número de colunas',
    }),
  exemplos: z.array(z.object({ en: texto(200), pt: texto(200) })).min(2).max(8),
});

export const AulaSchema = z
  .object({
    id,
    nivel: z.enum(NIVEIS),
    unidade: z.number().int().min(1).max(8),
    numero: z.number().int().min(1).max(5),
    titulo: texto(80),
    objetivo_pt: texto(300),
    aquecimento: ConversaSchema,
    vocabulario: z.array(PalavraSchema).min(8).max(12),
    gramatica: GramaticaSchema,
    escuta: z.object({
      titulo: texto(80),
      falas: z.array(FalaSchema).min(4).max(16),
      perguntas: z.array(ExercicioSchema).min(2).max(5),
    }),
    pratica: z.array(ExercicioSchema).min(5).max(12),
    conversa: ConversaSchema,
    teste: z.array(ExercicioSchema).length(5),
  })
  .superRefine((a, ctx) => idsUnicos(a, ctx));

export type Aula = z.infer<typeof AulaSchema>;

// ---------- Prova da unidade ----------

export const TarefaEscritaSchema = z.object({
  id,
  instrucao_pt: texto(300),
  min_frases: z.number().int().min(1).max(10),
  max_frases: z.number().int().min(1).max(10),
});
export type TarefaEscrita = z.infer<typeof TarefaEscritaSchema>;

export const TarefaFalaSchema = z.object({
  id,
  pergunta_en: texto(200),
  instrucao_pt: texto(300),
});
export type TarefaFala = z.infer<typeof TarefaFalaSchema>;

/** Entrevista oral da prova final: conversa livre com o professor, avaliada no fim. */
export const EntrevistaSchema = z.object({
  minutos: z.number().int().min(1).max(10),
  papel_professor: texto(600),
  abertura: texto(300),
  abertura_pt: texto(300),
});
export type Entrevista = z.infer<typeof EntrevistaSchema>;

export const ProvaSchema = z
  .object({
    id,
    nivel: z.enum(NIVEIS),
    /** Número da unidade; 0 = prova final do nível. */
    unidade: z.number().int().min(0).max(8),
    titulo: texto(80),
    leitura: z.object({
      texto: texto(3000),
      perguntas: z.array(ExercicioSchema).min(3).max(20),
    }),
    escuta: z.object({
      falas: z.array(FalaSchema).min(4).max(24),
      perguntas: z.array(ExercicioSchema).min(3).max(20),
    }),
    escrita: z.array(TarefaEscritaSchema).min(1).max(5),
    fala: z.array(TarefaFalaSchema).min(1).max(5),
    /** Tema e gramática que o avaliador deve considerar. */
    foco_avaliacao: texto(600),
    /** Só na prova final. */
    entrevista: EntrevistaSchema.optional(),
  })
  .superRefine((p, ctx) => {
    idsUnicos(p, ctx);
    if (p.unidade === 0 && !p.entrevista) ctx.addIssue({ code: 'custom', path: ['entrevista'], message: 'a prova final precisa da entrevista oral' });
    if (p.unidade !== 0 && p.entrevista) ctx.addIssue({ code: 'custom', path: ['entrevista'], message: 'só a prova final tem entrevista' });
  });

export type Prova = z.infer<typeof ProvaSchema>;

// ---------- Unidade e currículo ----------

export const UnidadeMetaSchema = z.object({
  id,
  nivel: z.enum(NIVEIS),
  numero: z.number().int().min(1).max(8),
  tema: texto(80),
  tema_pt: texto(80),
  gramatica_pt: texto(200),
});

export const UnidadeSchema = UnidadeMetaSchema.extend({
  aulas: z.array(AulaSchema).length(5),
  prova: ProvaSchema,
}).superRefine((u, ctx) => {
  u.aulas.forEach((a, i) => {
    if (a.numero !== i + 1 || a.unidade !== u.numero || a.nivel !== u.nivel) {
      ctx.addIssue({ code: 'custom', path: ['aulas', i], message: 'nível/unidade/número da aula não combinam com a pasta' });
    }
  });
  if (u.prova.unidade !== u.numero || u.prova.nivel !== u.nivel) {
    ctx.addIssue({ code: 'custom', path: ['prova'], message: 'nível/unidade da prova não combinam com a pasta' });
  }
});
export type Unidade = z.infer<typeof UnidadeSchema>;

export const CurriculoSchema = z.object({
  niveis: z
    .array(
      z.object({
        nivel: z.enum(NIVEIS),
        nome_pt: texto(40),
        unidades: z
          .array(
            z.object({
              numero: z.number().int().min(1).max(8),
              tema: texto(80),
              tema_pt: texto(80),
              gramatica_pt: texto(200),
            }),
          )
          .length(8),
      }),
    )
    .length(5),
});
export type Curriculo = z.infer<typeof CurriculoSchema>;

// ---------- Roleplays ----------

export const RoleplaySchema = ConversaSchema.extend({
  id,
  emoji: texto(16),
  titulo_pt: texto(60),
});
export type Roleplay = z.infer<typeof RoleplaySchema>;

export const RoleplaysSchema = z
  .object({ roleplays: z.array(RoleplaySchema).max(40) })
  .refine((r) => new Set(r.roleplays.map((x) => x.id)).size === r.roleplays.length, { message: 'roleplays com id repetido' });

// ---------- Auxiliares ----------

/** Garante que nenhum exercício repete o mesmo id dentro do arquivo. */
function idsUnicos(obj: unknown, ctx: z.RefinementCtx) {
  const vistos = new Set<string>();
  const percorrer = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(percorrer);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.tipo === 'string' && typeof o.id === 'string') {
        if (vistos.has(o.id)) {
          ctx.addIssue({ code: 'custom', message: `id de exercício repetido: ${o.id}` });
        }
        vistos.add(o.id);
      }
      Object.values(o).forEach(percorrer);
    }
  };
  percorrer(obj);
}

/** Transforma os erros do Zod em mensagens legíveis em português. */
export function descreverErros(erro: z.ZodError): string[] {
  return erro.issues.map((i) => `${i.path.join(' › ') || '(raiz)'}: ${i.message}`);
}
