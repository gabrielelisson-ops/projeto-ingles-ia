/**
 * Valida TODOS os arquivos de conteúdo. Se você editar um JSON e errar,
 * este teste mostra o arquivo e o campo com problema.
 */
import fs from 'fs';
import path from 'path';
import { montarCurso, estruturaDoCurso } from '../src/conteudo/curso';
import { AulaSchema, ProvaSchema, descreverErros } from '../src/conteudo/schema';
import { corrigir, palavrasParaOrdenar } from '../src/logica/respostas';
import { nivelAtual, proximoItem, statusCurso } from '../src/logica/desbloqueio';
import { exerciciosInconsistentes } from '../src/gerador/gerador';

const RAIZ = path.join(__dirname, '..', 'conteudo');
const ler = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

const pastasDeUnidade = fs
  .readdirSync(RAIZ)
  .filter((n) => /^(a1|a2|b1|b2|c1)$/.test(n))
  .flatMap((n) =>
    fs
      .readdirSync(path.join(RAIZ, n))
      .filter((u) => /^u0[1-8]$/.test(u))
      .map((u) => path.join(RAIZ, n, u)),
  );

const unidadesBrutas = pastasDeUnidade.map((dir) => ({
  dir,
  meta: ler(path.join(dir, 'unidade.json')),
  aulas: [1, 2, 3, 4, 5].map((n) => ler(path.join(dir, `aula${n}.json`))),
  prova: ler(path.join(dir, 'prova.json')),
}));

const finais = fs
  .readdirSync(RAIZ)
  .filter((n) => /^(a1|a2|b1|b2|c1)$/.test(n) && fs.existsSync(path.join(RAIZ, n, 'final.json')))
  .map((n) => ({ nivel: n, prova: ler(path.join(RAIZ, n, 'final.json')) }));

describe('conteúdo do curso', () => {
  test('existe pelo menos a unidade 1 do A1', () => {
    expect(pastasDeUnidade.some((d) => d.endsWith(path.join('a1', 'u01')))).toBe(true);
  });

  for (const u of unidadesBrutas) {
    const nome = path.relative(RAIZ, u.dir);
    test(`${nome}: todas as aulas e a prova seguem o formato`, () => {
      const erros: string[] = [];
      u.aulas.forEach((a, i) => {
        const r = AulaSchema.safeParse(a);
        if (!r.success) erros.push(...descreverErros(r.error).map((e) => `aula${i + 1}: ${e}`));
      });
      const p = ProvaSchema.safeParse(u.prova);
      if (!p.success) erros.push(...descreverErros(p.error).map((e) => `prova: ${e}`));
      expect(erros).toEqual([]);
    });

    test(`${nome}: a resposta registrada de cada exercício é aceita pela correção`, () => {
      const aulas = u.aulas.map((a) => AulaSchema.parse(a));
      const exercicios = [
        ...aulas.flatMap((a) => [...a.escuta.perguntas, ...a.pratica, ...a.teste]),
        ...ProvaSchema.parse(u.prova).leitura.perguntas,
        ...ProvaSchema.parse(u.prova).escuta.perguntas,
      ];
      for (const ex of exercicios) {
        const resposta =
          ex.tipo === 'multipla'
            ? ex.correta
            : ex.tipo === 'completar' || ex.tipo === 'traduzir'
              ? ex.respostas[0]!
              : ex.tipo === 'ordenar'
                ? palavrasParaOrdenar(ex.frase).join(' ')
                : ex.audio;
        expect([ex.id, corrigir(ex, resposta)]).toEqual([ex.id, true]);
      }
    });

    test(`${nome}: ids de exercícios são únicos no curso todo`, () => {
      const ids = JSON.stringify(u).match(/"id":\s*"[a-z0-9]+-[a-z0-9-]+"/g) ?? [];
      const exIds = ids.map((s) => s.split('"')[3]!).filter((s) => /-(p|t|e|l|w|s)\d+$/.test(s));
      expect(new Set(exIds).size).toBe(exIds.length);
    });

    test(`${nome}: prova tem 20 questões no total`, () => {
      const p = ProvaSchema.parse(u.prova);
      const total = p.leitura.perguntas.length + p.escuta.perguntas.length + p.escrita.length + p.fala.length;
      expect(total).toBe(20);
    });
  }

  for (const f of finais) {
    test(`${f.nivel}/final.json: prova final com 40 questões, entrevista e respostas aceitas`, () => {
      const r = ProvaSchema.safeParse(f.prova);
      expect(r.success ? [] : descreverErros(r.error)).toEqual([]);
      const p = ProvaSchema.parse(f.prova);
      expect(p.unidade).toBe(0);
      expect(p.entrevista).toBeDefined();
      expect(p.leitura.perguntas.length + p.escuta.perguntas.length + p.escrita.length + p.fala.length).toBe(40);
      expect(exerciciosInconsistentes([...p.leitura.perguntas, ...p.escuta.perguntas])).toEqual([]);
    });
  }

  test('o A1 está completo: 8 unidades e prova final', () => {
    expect(unidadesBrutas.filter((u) => u.meta.nivel === 'A1')).toHaveLength(8);
    expect(finais.some((f) => f.nivel === 'a1')).toBe(true);
  });

  test('o curso monta sem erros e a primeira aula fica liberada', () => {
    const c = montarCurso(
      ler(path.join(RAIZ, 'curriculo.json')),
      unidadesBrutas.map(({ meta, aulas, prova }) => ({ meta, aulas, prova })),
      finais.map((f) => f.prova),
    );
    expect(c.finais.A1?.id).toBe('a1-final');
    expect(c.erros).toEqual([]);
    const s = statusCurso(estruturaDoCurso(c), { aulasConcluidas: new Set(), provas: {} }, Date.now());
    expect(s.get('a1-u01-l1')?.estado).toBe('disponivel');
  });

  test('percorrendo o A1 inteiro: a prova final só libera depois das 8 provas de unidade', () => {
    const c = montarCurso(
      ler(path.join(RAIZ, 'curriculo.json')),
      unidadesBrutas.map(({ meta, aulas, prova }) => ({ meta, aulas, prova })),
      finais.map((f) => f.prova),
    );
    const est = estruturaDoCurso(c);
    const aulas = new Set<string>();
    const provas: Record<string, { nota: number; aprovado: boolean; data: number }[]> = {};
    const ok = [{ nota: 80, aprovado: true, data: 1 }];
    const a1 = est.find((n) => n.nivel === 'A1')!;
    for (const u of a1.unidades) {
      for (const a of u.aulas) {
        expect(proximoItem(est, statusCurso(est, { aulasConcluidas: aulas, provas }, 2))?.id).toBe(a);
        aulas.add(a);
      }
      expect(statusCurso(est, { aulasConcluidas: aulas, provas }, 2).get('a1-final')?.estado).toBe('bloqueada');
      provas[u.prova!] = ok;
    }
    const s = statusCurso(est, { aulasConcluidas: aulas, provas }, 2);
    expect(s.get('a1-final')?.estado).toBe('disponivel');
    expect(nivelAtual(est, { aulasConcluidas: aulas, provas })).toBe('A1');
    provas['a1-final'] = ok;
    expect(nivelAtual(est, { aulasConcluidas: aulas, provas })).toBe('A2');
  });

  test('um JSON com erro vira mensagem legível e não derruba o curso', () => {
    const quebrada = JSON.parse(JSON.stringify(unidadesBrutas[0]));
    quebrada.aulas[0].teste.pop(); // teste com 4 perguntas em vez de 5
    const c = montarCurso(ler(path.join(RAIZ, 'curriculo.json')), [quebrada]);
    expect(c.unidades).toHaveLength(0);
    expect(c.erros.join('\n')).toMatch(/a1-u01: aulas › 0 › teste/);
  });
});
