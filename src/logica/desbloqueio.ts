/**
 * Regras de desbloqueio do curso.
 *
 * O curso é uma fila: aula 1 → aula 2 → … → aula 5 → prova da unidade →
 * próxima unidade … → prova final do nível → próximo nível.
 * Cada item só abre quando o anterior foi concluído (prova = aprovado).
 * Reprovou numa prova? Nova tentativa só 24 horas depois.
 */
import { NIVEIS, type Nivel } from '../conteudo/schema';

export const ESPERA_REPROVACAO_MS = 24 * 60 * 60 * 1000;
export const NOTA_APROVACAO = 70;
export const UNIDADES_POR_NIVEL = 8;
export const AULAS_POR_UNIDADE = 5;
/** 8 unidades × (5 aulas + 1 prova) + 1 prova final. */
export const ITENS_POR_NIVEL = UNIDADES_POR_NIVEL * (AULAS_POR_UNIDADE + 1) + 1;

export type EstruturaUnidade = {
  nivel: Nivel;
  numero: number;
  /** Vazio quando a unidade ainda não tem conteúdo. */
  aulas: string[];
  prova: string | null;
};

export type EstruturaNivel = {
  nivel: Nivel;
  unidades: EstruturaUnidade[];
  provaFinal: string | null;
};

export type Tentativa = { nota: number; aprovado: boolean; data: number };

export type Progresso = {
  aulasConcluidas: ReadonlySet<string>;
  /** Tentativas de cada prova (de unidade ou final), em qualquer ordem. */
  provas: Readonly<Record<string, readonly Tentativa[]>>;
};

export type Estado = 'bloqueada' | 'disponivel' | 'concluida' | 'aguardando' | 'em_breve';
export type Status = { estado: Estado; liberaEm?: number };
export type Tipo = 'aula' | 'prova' | 'final';
export type ItemOrdem = { id: string; tipo: Tipo; nivel: Nivel; unidade?: number };

export function provaAprovada(tentativas: readonly Tentativa[] | undefined): boolean {
  return !!tentativas?.some((t) => t.aprovado);
}

/** Momento em que a próxima tentativa fica liberada (0 = já pode). */
export function liberacaoDaProva(tentativas: readonly Tentativa[] | undefined): number {
  if (!tentativas?.length || provaAprovada(tentativas)) return 0;
  const ultima = Math.max(...tentativas.map((t) => t.data));
  return ultima + ESPERA_REPROVACAO_MS;
}

/**
 * Calcula o estado de cada aula e prova.
 * `nivelInicial` vem do teste de nivelamento: o curso começa liberado nesse nível.
 */
export function statusCurso(
  estrutura: readonly EstruturaNivel[],
  progresso: Progresso,
  agora: number,
  nivelInicial: Nivel = 'A1',
): Map<string, Status> {
  const status = new Map<string, Status>();
  let anteriorOk = false;

  const prova = (id: string) => {
    const tent = progresso.provas[id];
    if (provaAprovada(tent)) {
      status.set(id, { estado: 'concluida' });
      anteriorOk = true;
      return;
    }
    if (!anteriorOk) status.set(id, { estado: 'bloqueada' });
    else {
      const libera = liberacaoDaProva(tent);
      status.set(id, libera > agora ? { estado: 'aguardando', liberaEm: libera } : { estado: 'disponivel' });
    }
    anteriorOk = false;
  };

  for (const nivel of estrutura) {
    if (nivel.nivel === nivelInicial) anteriorOk = true;
    for (const u of nivel.unidades) {
      if (u.aulas.length === 0 || !u.prova) {
        anteriorOk = false;
        continue;
      }
      for (const aula of u.aulas) {
        const feita = progresso.aulasConcluidas.has(aula);
        status.set(aula, { estado: feita ? 'concluida' : anteriorOk ? 'disponivel' : 'bloqueada' });
        anteriorOk = feita;
      }
      prova(u.prova);
    }
    if (nivel.provaFinal) prova(nivel.provaFinal);
    else anteriorOk = false;
  }
  return status;
}

export function estadoDe(status: Map<string, Status>, id: string | null): Status {
  return (id && status.get(id)) || { estado: 'em_breve' };
}

/** Todos os itens do curso na ordem em que devem ser feitos. */
export function ordemDoCurso(estrutura: readonly EstruturaNivel[]): ItemOrdem[] {
  const itens: ItemOrdem[] = [];
  for (const n of estrutura) {
    for (const u of n.unidades) {
      u.aulas.forEach((id) => itens.push({ id, tipo: 'aula', nivel: n.nivel, unidade: u.numero }));
      if (u.prova) itens.push({ id: u.prova, tipo: 'prova', nivel: n.nivel, unidade: u.numero });
    }
    if (n.provaFinal) itens.push({ id: n.provaFinal, tipo: 'final', nivel: n.nivel });
  }
  return itens;
}

/** O que o aluno deve fazer agora (botão "Continuar"). */
export function proximoItem(
  estrutura: readonly EstruturaNivel[],
  status: Map<string, Status>,
): ItemOrdem | null {
  return (
    ordemDoCurso(estrutura).find((i) => {
      const e = status.get(i.id)?.estado;
      return e === 'disponivel' || e === 'aguardando';
    }) ?? null
  );
}

/** Nível atual: o primeiro (a partir do inicial) cuja prova final ainda não foi aprovada. */
export function nivelAtual(
  estrutura: readonly EstruturaNivel[],
  progresso: Progresso,
  nivelInicial: Nivel = 'A1',
): Nivel {
  const inicio = NIVEIS.indexOf(nivelInicial);
  for (const n of estrutura) {
    if (NIVEIS.indexOf(n.nivel) < inicio) continue;
    if (!n.provaFinal || !provaAprovada(progresso.provas[n.provaFinal])) return n.nivel;
  }
  return 'C1';
}

/** Percentual do nível concluído (conta também unidades que ainda não têm conteúdo). */
export function percentualDoNivel(nivel: EstruturaNivel, progresso: Progresso): number {
  let feitos = 0;
  for (const u of nivel.unidades) {
    feitos += u.aulas.filter((a) => progresso.aulasConcluidas.has(a)).length;
    if (u.prova && provaAprovada(progresso.provas[u.prova])) feitos++;
  }
  if (nivel.provaFinal && provaAprovada(progresso.provas[nivel.provaFinal])) feitos++;
  return Math.round((feitos / ITENS_POR_NIVEL) * 100);
}
