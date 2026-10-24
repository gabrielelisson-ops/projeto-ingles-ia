/**
 * Gerador de conteúdo com IA (usado pelo script scripts/gerar-conteudo.ts, no computador).
 *
 * Fluxo para uma unidade:
 *   1. pede à IA um PLANO (título, objetivo e foco das 5 aulas);
 *   2. gera cada aula seguindo o plano;
 *   3. gera a prova da unidade com base nas 5 aulas.
 * Cada resposta passa pelo schema. Se vier errada, a IA recebe a lista de
 * erros e tenta de novo (até 3 vezes). O resultado vai para revisão humana.
 */
import { z } from 'zod';
import {
  AulaSchema,
  descreverErros,
  ProvaSchema,
  type Aula,
  type Curriculo,
  type Exercicio,
  type Nivel,
  type Prova,
} from '../conteudo/schema';
import { pedirJSON, type Mensagem } from '../ia/gemini';
import { corrigir, palavrasParaOrdenar } from '../logica/respostas';

export const TENTATIVAS = 3;

export const PlanoSchema = z.object({
  aulas: z
    .array(
      z.object({
        titulo: z.string().min(1).max(80),
        objetivo_pt: z.string().min(1).max(300),
        foco: z.string().min(1).max(300),
      }),
    )
    .length(5),
});
export type Plano = z.infer<typeof PlanoSchema>;

const ORIENTACAO_NIVEL: Record<Nivel, string> = {
  A1: 'Inglês muito simples, frases curtas, só presente. Explicações em português.',
  A2: 'Inglês simples do dia a dia, frases curtas. Explicações em português.',
  B1: 'Inglês natural e claro. Explicações em português.',
  B2: 'Inglês natural, contextos profissionais. Explicações em português, exemplos ricos.',
  C1: 'Inglês avançado, idiomático, corporativo e técnico (indústria, supply chain, planejamento de produção). Explicações em português.',
};

export type ContextoUnidade = {
  nivel: Nivel;
  numero: number;
  tema: string;
  tema_pt: string;
  gramatica_pt: string;
  /** Temas das unidades anteriores (para não repetir e para revisar). */
  anteriores: string[];
};

export function contextoDaUnidade(c: Curriculo, nivel: Nivel, numero: number): ContextoUnidade {
  const n = c.niveis.find((x) => x.nivel === nivel);
  const u = n?.unidades.find((x) => x.numero === numero);
  if (!n || !u) throw new Error(`Unidade ${nivel} ${numero} não existe no currículo.`);
  const anteriores = c.niveis
    .flatMap((x) => x.unidades.map((y) => ({ nivel: x.nivel, ...y })))
    .filter((x) => x.nivel < nivel || (x.nivel === nivel && x.numero < numero))
    .slice(-8)
    .map((x) => `${x.nivel}-${x.numero}: ${x.tema_pt} (${x.gramatica_pt})`);
  return { nivel, numero, tema: u.tema, tema_pt: u.tema_pt, gramatica_pt: u.gramatica_pt, anteriores };
}

const REGRAS_GERAIS = `Regras obrigatórias:
- Conteúdo 100% ORIGINAL: não copie diálogos, textos ou exercícios de livros ou cursos existentes.
- Público: casal brasileiro adulto; o aluno trabalha na indústria. Use situações reais (trabalho, fábrica, viagem, família, dia a dia).
- Nada de conteúdo ofensivo, político, religioso ou sobre dados pessoais sensíveis.
- Responda SOMENTE com JSON válido, sem comentários.`;

export function promptPlano(u: ContextoUnidade): string {
  return `Você é um autor de cursos de inglês (CEFR) para brasileiros.
Planeje a unidade ${u.numero} do nível ${u.nivel}: tema "${u.tema}" (${u.tema_pt}). Gramática da unidade: ${u.gramatica_pt}.
Unidades anteriores (já estudadas): ${u.anteriores.join('; ') || 'nenhuma'}.
${ORIENTACAO_NIVEL[u.nivel]}
Divida a unidade em 5 aulas progressivas; a aula 5 junta tudo numa situação real.
${REGRAS_GERAIS}
Formato: {"aulas": [{"titulo": "título curto em inglês", "objetivo_pt": "...", "foco": "vocabulário e gramática da aula"}, ...5 itens]}`;
}

export function promptAula(u: ContextoUnidade, plano: Plano, numero: number, exemplo: Aula): string {
  const a = plano.aulas[numero - 1]!;
  const prefixo = `${u.nivel.toLowerCase()}u${String(u.numero).padStart(2, '0')}l${numero}`;
  return `Você é um autor de cursos de inglês (CEFR) para brasileiros.
Escreva a AULA ${numero} da unidade ${u.numero} do nível ${u.nivel} (tema da unidade: ${u.tema_pt}; gramática: ${u.gramatica_pt}).
Plano da unidade: ${plano.aulas.map((x, i) => `${i + 1}. ${x.titulo} — ${x.foco}`).join(' | ')}
Esta aula: "${a.titulo}" — objetivo: ${a.objetivo_pt} — foco: ${a.foco}
${ORIENTACAO_NIVEL[u.nivel]}

Estrutura (siga EXATAMENTE o formato do exemplo abaixo, que é de outra aula):
- id: "${u.nivel.toLowerCase()}-u${String(u.numero).padStart(2, '0')}-l${numero}", nivel "${u.nivel}", unidade ${u.numero}, numero ${numero}.
- vocabulario: 8 a 12 itens, cada um com emoji, tradução e exemplo.
- gramatica: explicação curta em português, tabela (todas as linhas com o mesmo número de colunas) e 2 a 8 exemplos.
- escuta: diálogo ORIGINAL de 6 a 10 falas entre duas pessoas (voz "a" e "b"), com tradução, e 3 perguntas.
- pratica: 8 exercícios variados (multipla, completar, ordenar, ouvir_escrever, traduzir).
- conversa: situação real para o aluno conversar com o professor de IA (papel_professor descreve o papel).
- teste: EXATAMENTE 5 exercícios, misturando os tipos.
- ids de exercícios: "${prefixo}-e1".. (escuta), "${prefixo}-p1".. (prática), "${prefixo}-t1".. (teste).
- "completar": a frase tem ___ e "respostas" lista todas as formas aceitas.
- "ordenar": a frase correta, de 3 a 8 palavras, sem vírgulas.
- "multipla": "correta" é o índice (começando em 0) da opção certa.
- "traduzir": "respostas" lista as traduções aceitas mais comuns.
${REGRAS_GERAIS}

Exemplo de formato (NÃO copie o conteúdo):
${JSON.stringify(exemplo)}`;
}

export function promptProva(u: ContextoUnidade, aulas: Aula[], exemplo: Prova): string {
  const id = `${u.nivel.toLowerCase()}-u${String(u.numero).padStart(2, '0')}-prova`;
  const prefixo = `${u.nivel.toLowerCase()}u${String(u.numero).padStart(2, '0')}pv`;
  return `Você é um autor de provas de inglês (CEFR) para brasileiros.
Escreva a PROVA da unidade ${u.numero} do nível ${u.nivel} (tema: ${u.tema_pt}; gramática: ${u.gramatica_pt}).
Ela avalia estas 5 aulas: ${aulas.map((a) => `"${a.titulo}" (vocabulário: ${a.vocabulario.map((v) => v.en).join(', ')}; gramática: ${a.gramatica.titulo})`).join(' | ')}
${ORIENTACAO_NIVEL[u.nivel]}

Estrutura (EXATAMENTE 20 questões no total):
- id "${id}", nivel "${u.nivel}", unidade ${u.numero}.
- leitura: texto ORIGINAL de 80 a 200 palavras + 8 perguntas (ids "${prefixo}-l1".."${prefixo}-l8").
- escuta: diálogo ORIGINAL de 6 a 10 falas + 8 perguntas (ids "${prefixo}-e1".."${prefixo}-e8"), podendo incluir 2 de "ouvir_escrever".
- escrita: 2 tarefas (ids "${prefixo}-w1", "${prefixo}-w2"), cada uma pedindo de 2 a 5 frases.
- fala: 2 perguntas em inglês para responder por voz (ids "${prefixo}-s1", "${prefixo}-s2").
- foco_avaliacao: o que o avaliador deve considerar (nível, gramática e vocabulário da unidade).
- Não inclua "entrevista".
${REGRAS_GERAIS}

Exemplo de formato (NÃO copie o conteúdo):
${JSON.stringify(exemplo)}`;
}

/** Confere se a resposta registrada de cada exercício é aceita pela correção automática. */
export function exerciciosInconsistentes(lista: Exercicio[]): string[] {
  const problemas: string[] = [];
  for (const ex of lista) {
    const r =
      ex.tipo === 'multipla'
        ? ex.correta
        : ex.tipo === 'completar' || ex.tipo === 'traduzir'
          ? ex.respostas[0]!
          : ex.tipo === 'ordenar'
            ? palavrasParaOrdenar(ex.frase).join(' ')
            : ex.audio;
    if (!corrigir(ex, r)) problemas.push(`${ex.id}: a resposta registrada não é aceita pela correção`);
    if (ex.tipo === 'ordenar' && palavrasParaOrdenar(ex.frase).length > 10) problemas.push(`${ex.id}: frase longa demais para ordenar`);
  }
  return problemas;
}

export function problemasDaAula(a: Aula, nivel: Nivel, unidade: number, numero: number): string[] {
  const p = exerciciosInconsistentes([...a.escuta.perguntas, ...a.pratica, ...a.teste]);
  if (a.nivel !== nivel || a.unidade !== unidade || a.numero !== numero) p.push('nivel/unidade/numero errados');
  return p;
}

export function problemasDaProva(pv: Prova, nivel: Nivel, unidade: number, totalEsperado: number): string[] {
  const p = exerciciosInconsistentes([...pv.leitura.perguntas, ...pv.escuta.perguntas]);
  const total = pv.leitura.perguntas.length + pv.escuta.perguntas.length + pv.escrita.length + pv.fala.length;
  if (total !== totalEsperado) p.push(`a prova tem ${total} questões; precisa de ${totalEsperado}`);
  if (pv.nivel !== nivel || pv.unidade !== unidade) p.push('nivel/unidade errados');
  return p;
}

export type ConfigIA = { chave: string; modelo: string; fetchFn?: typeof fetch; log?: (m: string) => void };

/**
 * Pede um JSON à IA e valida. Se falhar, devolve os erros para a IA corrigir.
 */
export async function gerarValidado<T>(
  ia: ConfigIA,
  prompt: string,
  schema: z.ZodType<T>,
  extras: (v: T) => string[] = () => [],
  rotulo = 'item',
): Promise<T> {
  const mensagens: Mensagem[] = [{ papel: 'aluno', texto: 'Gere o JSON agora.' }];
  let ultimosErros: string[] = [];
  for (let t = 1; t <= TENTATIVAS; t++) {
    const bruto = await pedirJSON({
      chave: ia.chave,
      modelos: [ia.modelo],
      sistema: prompt,
      mensagens,
      schema: z.unknown(),
      temperatura: 0.8,
      fetchFn: ia.fetchFn,
    });
    const r = schema.safeParse(bruto);
    ultimosErros = r.success ? extras(r.data) : descreverErros(r.error);
    if (r.success && ultimosErros.length === 0) return r.data;
    ia.log?.(`  ${rotulo}: tentativa ${t} com ${ultimosErros.length} problema(s); pedindo correção…`);
    mensagens.push(
      { papel: 'professor', texto: JSON.stringify(bruto).slice(0, 30000) },
      { papel: 'aluno', texto: `O JSON tem estes problemas. Corrija TODOS e devolva o JSON completo:\n- ${ultimosErros.slice(0, 30).join('\n- ')}` },
    );
  }
  throw new Error(`${rotulo}: não ficou válido após ${TENTATIVAS} tentativas:\n- ${ultimosErros.join('\n- ')}`);
}

export type UnidadeGerada = {
  unidade: { id: string; nivel: Nivel; numero: number; tema: string; tema_pt: string; gramatica_pt: string };
  aulas: Aula[];
  prova: Prova;
};

export async function gerarUnidade(
  ia: ConfigIA,
  u: ContextoUnidade,
  exemplos: { aula: Aula; prova: Prova },
): Promise<UnidadeGerada> {
  ia.log?.(`Planejando ${u.nivel} unidade ${u.numero} (${u.tema_pt})…`);
  const plano = await gerarValidado(ia, promptPlano(u), PlanoSchema, () => [], 'plano');
  const aulas: Aula[] = [];
  for (let n = 1; n <= 5; n++) {
    ia.log?.(`Gerando aula ${n}: ${plano.aulas[n - 1]!.titulo}…`);
    aulas.push(
      await gerarValidado(ia, promptAula(u, plano, n, exemplos.aula), AulaSchema, (a) => problemasDaAula(a, u.nivel, u.numero, n), `aula ${n}`),
    );
  }
  ia.log?.('Gerando a prova da unidade…');
  const prova = await gerarValidado(
    ia,
    promptProva(u, aulas, exemplos.prova),
    ProvaSchema,
    (p) => problemasDaProva(p, u.nivel, u.numero, 20),
    'prova',
  );
  const id = `${u.nivel.toLowerCase()}-u${String(u.numero).padStart(2, '0')}`;
  return {
    unidade: { id, nivel: u.nivel, numero: u.numero, tema: u.tema, tema_pt: u.tema_pt, gramatica_pt: u.gramatica_pt },
    aulas,
    prova,
  };
}
