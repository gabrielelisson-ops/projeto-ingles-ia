/**
 * Pontos fracos do aluno, calculados a partir do histórico:
 * - habilidades (leitura, escuta, escrita, fala): média das partes nas provas;
 * - gramática: unidades em que reprovou na prova e aulas que passaram "raspando" no teste rápido.
 */
import type { Curso } from '../conteudo/curso';
import { NOTA_APROVACAO } from './desbloqueio';
import { NOMES_PARTES, type Parte } from './notas';

export type TentativaComDetalhes = { prova_id: string; nota: number; aprovado: boolean; data: number; detalhes: unknown };
export type AulaFeita = { aula_id: string; acertos: number };

export type Habilidade = { parte: Parte; nome: string; media: number; provas: number; fraca: boolean };
export type TemaFraco = { tema: string; motivo: string };
export type PontosFracos = { habilidades: Habilidade[]; gramatica: TemaFraco[] };

const PARTES = Object.keys(NOMES_PARTES) as Parte[];

function partesDe(detalhes: unknown): Partial<Record<Parte, number>> {
  const p = (detalhes as { partes?: unknown } | null)?.partes;
  if (!p || typeof p !== 'object') return {};
  const out: Partial<Record<Parte, number>> = {};
  for (const k of PARTES) {
    const v = (p as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(100, Math.max(0, v));
  }
  return out;
}

export function calcularPontosFracos(curso: Curso, tentativas: TentativaComDetalhes[], aulas: AulaFeita[], maxTemas = 6): PontosFracos {
  const soma: Record<Parte, { total: number; n: number }> = {
    leitura: { total: 0, n: 0 },
    escuta: { total: 0, n: 0 },
    escrita: { total: 0, n: 0 },
    fala: { total: 0, n: 0 },
  };
  for (const t of tentativas) {
    const partes = partesDe(t.detalhes);
    for (const k of PARTES) {
      const v = partes[k];
      if (v != null) {
        soma[k].total += v;
        soma[k].n++;
      }
    }
  }
  const habilidades = PARTES.filter((k) => soma[k].n > 0)
    .map((k) => {
      const media = Math.round(soma[k].total / soma[k].n);
      return { parte: k, nome: NOMES_PARTES[k], media, provas: soma[k].n, fraca: media < NOTA_APROVACAO };
    })
    .sort((a, b) => a.media - b.media);

  const gramatica: TemaFraco[] = [];
  const vistos = new Set<string>();
  const add = (tema: string, motivo: string) => {
    if (vistos.has(tema)) return;
    vistos.add(tema);
    gramatica.push({ tema, motivo });
  };
  // 1) Unidades com reprovação (mais recentes primeiro).
  for (const t of [...tentativas].sort((a, b) => b.data - a.data)) {
    if (t.aprovado) continue;
    const u = curso.unidades.find((x) => x.prova.id === t.prova_id);
    if (u) add(u.gramatica_pt, `reprovou na prova da Unidade ${u.numero} do ${u.nivel} (nota ${t.nota})`);
  }
  // 2) Aulas que passaram com o mínimo no teste rápido.
  for (const a of aulas) {
    if (a.acertos >= 5) continue;
    for (const u of curso.unidades) {
      const aula = u.aulas.find((x) => x.id === a.aula_id);
      if (aula) add(aula.gramatica.titulo, `${a.acertos} de 5 no teste rápido da aula "${aula.titulo}"`);
    }
  }
  return { habilidades, gramatica: gramatica.slice(0, maxTemas) };
}
