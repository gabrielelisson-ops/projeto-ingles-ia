#!/usr/bin/env node
/**
 * Gera src/conteudo/indice.gerado.ts a partir das pastas em conteudo/.
 *
 * O celular não consegue "listar uma pasta" do app, então este script
 * escreve a lista de arquivos para o app carregar. Rode sempre que
 * adicionar ou remover uma unidade:   npm run conteudo:indice
 *
 * Estrutura esperada:
 *   conteudo/curriculo.json
 *   conteudo/a1/u01/unidade.json, aula1.json … aula5.json, prova.json
 *   conteudo/a1/final.json   (prova final do nível, opcional)
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CONTEUDO = path.join(RAIZ, 'conteudo');
const SAIDA = path.join(RAIZ, 'src', 'conteudo', 'indice.gerado.ts');
const NIVEIS = ['a1', 'a2', 'b1', 'b2', 'c1'];

const rel = (arquivo) => '../../' + path.relative(RAIZ, arquivo).split(path.sep).join('/');
const req = (arquivo) => `require('${rel(arquivo)}')`;

const unidades = [];
const finais = [];
const problemas = [];

for (const nivel of NIVEIS) {
  const pastaNivel = path.join(CONTEUDO, nivel);
  if (!fs.existsSync(pastaNivel)) continue;
  const final = path.join(pastaNivel, 'final.json');
  if (fs.existsSync(final)) finais.push(req(final));
  const pastas = fs
    .readdirSync(pastaNivel)
    .filter((p) => /^u0[1-8]$/.test(p))
    .sort();
  for (const u of pastas) {
    const dir = path.join(pastaNivel, u);
    const arquivos = ['unidade.json', 'aula1.json', 'aula2.json', 'aula3.json', 'aula4.json', 'aula5.json', 'prova.json'];
    const faltando = arquivos.filter((a) => !fs.existsSync(path.join(dir, a)));
    if (faltando.length) {
      problemas.push(`${nivel}/${u}: faltam ${faltando.join(', ')} (unidade ignorada)`);
      continue;
    }
    unidades.push(
      `  {\n    meta: ${req(path.join(dir, 'unidade.json'))},\n` +
        `    aulas: [\n${[1, 2, 3, 4, 5].map((n) => `      ${req(path.join(dir, `aula${n}.json`))},`).join('\n')}\n    ],\n` +
        `    prova: ${req(path.join(dir, 'prova.json'))},\n  },`,
    );
  }
}

const codigo = `// ARQUIVO GERADO por scripts/gerar-indice.js — não edite à mão.
/* eslint-disable */
export const CURRICULO_BRUTO: unknown = ${req(path.join(CONTEUDO, 'curriculo.json'))};

export const UNIDADES_BRUTAS: { meta: unknown; aulas: unknown[]; prova: unknown }[] = [
${unidades.join('\n')}
];

export const FINAIS_BRUTAS: unknown[] = [${finais.join(', ')}];
`;

fs.writeFileSync(SAIDA, codigo);
console.log(`Índice gerado: ${unidades.length} unidade(s), ${finais.length} prova(s) final(is).`);
problemas.forEach((p) => console.warn('Aviso: ' + p));
