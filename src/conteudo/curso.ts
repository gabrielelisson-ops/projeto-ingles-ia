/**
 * Carrega e valida todo o conteúdo do curso uma única vez.
 *
 * Arquivos com erro não derrubam o app: a unidade fica de fora e o erro
 * aparece em Configurações › "Conteúdo", para você corrigir o JSON.
 */
import type { EstruturaNivel } from '../logica/desbloqueio';
import { CURRICULO_BRUTO, FINAIS_BRUTAS, NIVELAMENTO_BRUTO, ROLEPLAYS_BRUTOS, UNIDADES_BRUTAS } from './indice.gerado';
import {
  CurriculoSchema,
  descreverErros,
  NIVEIS,
  NivelamentoSchema,
  ProvaSchema,
  RoleplaysSchema,
  UnidadeMetaSchema,
  UnidadeSchema,
  type Aula,
  type Curriculo,
  type Nivel,
  type Nivelamento,
  type Prova,
  type Roleplay,
  type Unidade,
} from './schema';

export type Curso = {
  curriculo: Curriculo;
  unidades: Unidade[];
  /** Provas finais por nível (Fase 2). */
  finais: Partial<Record<Nivel, Prova>>;
  roleplays: Roleplay[];
  juntos: Roleplay[];
  nivelamento: Nivelamento | null;
  erros: string[];
};

export function montarCurso(
  curriculoBruto: unknown,
  unidadesBrutas: readonly { meta: unknown; aulas: unknown[]; prova: unknown }[],
  finaisBrutas: readonly unknown[] = [],
  roleplaysBrutos: unknown = { roleplays: [] },
  nivelamentoBruto: unknown = null,
): Curso {
  const erros: string[] = [];
  const curr = CurriculoSchema.safeParse(curriculoBruto);
  if (!curr.success) throw new Error('curriculo.json inválido:\n' + descreverErros(curr.error).join('\n'));

  const unidades: Unidade[] = [];
  for (const u of unidadesBrutas) {
    const meta = UnidadeMetaSchema.safeParse(u.meta);
    const nome = meta.success ? meta.data.id : '(unidade sem id)';
    const r = UnidadeSchema.safeParse({ ...(u.meta as object), aulas: u.aulas, prova: u.prova });
    if (r.success) unidades.push(r.data);
    else erros.push(...descreverErros(r.error).map((e) => `${nome}: ${e}`));
  }

  const finais: Partial<Record<Nivel, Prova>> = {};
  for (const f of finaisBrutas) {
    const r = ProvaSchema.safeParse(f);
    if (r.success) finais[r.data.nivel] = r.data;
    else erros.push(...descreverErros(r.error).map((e) => `prova final: ${e}`));
  }
  const rp = RoleplaysSchema.safeParse(roleplaysBrutos);
  if (!rp.success) erros.push(...descreverErros(rp.error).map((e) => `roleplays.json: ${e}`));
  let nivelamento: Nivelamento | null = null;
  if (nivelamentoBruto != null) {
    const nv = NivelamentoSchema.safeParse(nivelamentoBruto);
    if (nv.success) nivelamento = nv.data;
    else erros.push(...descreverErros(nv.error).map((e) => `nivelamento.json: ${e}`));
  }
  return { curriculo: curr.data, unidades, finais, roleplays: rp.success ? rp.data.roleplays : [], juntos: rp.success ? rp.data.juntos : [], nivelamento, erros };
}

let cache: Curso | null = null;
export function curso(): Curso {
  if (!cache) cache = montarCurso(CURRICULO_BRUTO, UNIDADES_BRUTAS, FINAIS_BRUTAS, ROLEPLAYS_BRUTOS, NIVELAMENTO_BRUTO);
  return cache;
}

/** Estrutura usada pelas regras de desbloqueio (inclui unidades ainda sem conteúdo). */
export function estruturaDoCurso(c: Curso): EstruturaNivel[] {
  return c.curriculo.niveis.map((n) => ({
    nivel: n.nivel,
    unidades: n.unidades.map((cu) => {
      const u = c.unidades.find((x) => x.nivel === n.nivel && x.numero === cu.numero);
      return { nivel: n.nivel, numero: cu.numero, aulas: u ? u.aulas.map((a) => a.id) : [], prova: u ? u.prova.id : null };
    }),
    provaFinal: c.finais[n.nivel]?.id ?? null,
  }));
}

export function acharAula(c: Curso, id: string): { aula: Aula; unidade: Unidade } | null {
  for (const u of c.unidades) {
    const aula = u.aulas.find((a) => a.id === id);
    if (aula) return { aula, unidade: u };
  }
  return null;
}

export function acharProva(c: Curso, id: string): { prova: Prova; final: boolean } | null {
  const u = c.unidades.find((x) => x.prova.id === id);
  if (u) return { prova: u.prova, final: false };
  for (const n of NIVEIS) if (c.finais[n]?.id === id) return { prova: c.finais[n]!, final: true };
  return null;
}

/** Aulas já concluídas, usadas no "Teste rápido do dia". */
export function aulasConcluidas(c: Curso, ids: ReadonlySet<string>): Aula[] {
  return c.unidades.flatMap((u) => u.aulas).filter((a) => ids.has(a.id));
}
