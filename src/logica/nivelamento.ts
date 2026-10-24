/**
 * Teste de nivelamento: sugere em que nível começar.
 *
 * O teste sobe de nível em nível (A1 → C1). Para "passar" num nível é preciso
 * acertar 75% das questões dele; o teste para no primeiro nível em que a pessoa
 * não passar, e esse é o nível sugerido. A fala, avaliada pela IA, só pode puxar
 * a sugestão um nível para baixo (nunca para cima), para ninguém começar alto demais.
 */
import { NIVEIS, type Nivel } from '../conteudo/schema';

export const ACERTO_MINIMO_NIVEL = 0.75;

export type ResultadoNivel = { nivel: Nivel; acertos: number; total: number };

export function passouNoNivel(r: ResultadoNivel): boolean {
  return r.total > 0 && r.acertos / r.total >= ACERTO_MINIMO_NIVEL;
}

/** Depois de responder um nível, o teste continua? */
export function continuarTeste(r: ResultadoNivel): boolean {
  return passouNoNivel(r) && r.nivel !== 'C1';
}

export function sugerirNivel(resultados: ResultadoNivel[], nivelFala?: Nivel | null): Nivel {
  let idx = 0;
  for (const nivel of NIVEIS) {
    const r = resultados.find((x) => x.nivel === nivel);
    if (!r || !passouNoNivel(r)) break;
    idx = Math.min(NIVEIS.indexOf(nivel) + 1, NIVEIS.length - 1);
  }
  if (nivelFala) {
    const iFala = NIVEIS.indexOf(nivelFala);
    if (iFala < idx - 1) idx -= 1;
  }
  return NIVEIS[idx]!;
}
