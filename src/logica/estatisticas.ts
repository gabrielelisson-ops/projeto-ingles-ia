/**
 * Números do painel: sequência de dias e embaralhamento estável.
 */

/** Data local no formato AAAA-MM-DD (o "dia" do aluno, no fuso do celular). */
export function diaLocal(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function diaAnterior(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  // Meio-dia evita problemas com horário de verão.
  return diaLocal(new Date(a, m - 1, d, 12).getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Sequência de dias estudados até hoje.
 * Se ainda não estudou hoje, a sequência de ontem continua valendo.
 */
export function sequenciaDeDias(diasEstudados: Iterable<string>, hoje: string): number {
  const dias = new Set(diasEstudados);
  let dia = dias.has(hoje) ? hoje : diaAnterior(hoje);
  let n = 0;
  while (dias.has(dia)) {
    n++;
    dia = diaAnterior(dia);
  }
  return n;
}

/** Gerador pseudoaleatório com semente (mesma semente = mesma ordem). */
function gerador(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function sementeDeTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Embaralha sem alterar a lista original. Garante ordem diferente da original quando possível. */
export function embaralhar<T>(lista: readonly T[], semente: number): T[] {
  const r = gerador(semente);
  const out = [...lista];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  const mudou = out.some((v, i) => v !== lista[i]);
  if (!mudou && out.length > 1) out.push(out.shift()!);
  return out;
}
