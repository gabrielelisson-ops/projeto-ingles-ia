/**
 * Gera com IA as aulas e a prova de uma unidade, para você REVISAR antes de usar.
 *
 * Uso (no PowerShell, dentro da pasta do projeto):
 *   $env:GEMINI_API_KEY = "sua-chave"         # só nesta janela; não fica salvo em arquivo
 *   npm run gerar -- A2 3                     # gera a unidade 3 do A2
 *   npm run gerar -- A2 3 --modelo gemini-flash-latest
 *
 * O resultado vai para conteudo-gerado/a2/u03/ (essa pasta não vai para o GitHub).
 * Revise os textos; quando estiver bom, mova a pasta para conteudo/a2/u03/ e rode:
 *   npm run conteudo:indice
 *   npm test
 */
import fs from 'fs';
import path from 'path';
import { AulaSchema, CurriculoSchema, NIVEIS, ProvaSchema, type Nivel } from '../src/conteudo/schema';
import { MODELO_AVALIACAO_PADRAO } from '../src/ia/gemini';
import { contextoDaUnidade, gerarUnidade } from '../src/gerador/gerador';

const RAIZ = path.join(__dirname, '..');
const ler = (p: string) => JSON.parse(fs.readFileSync(path.join(RAIZ, p), 'utf8'));

async function main() {
  const args = process.argv.slice(2);
  const nivel = (args[0] ?? '').toUpperCase() as Nivel;
  const numero = Number(args[1]);
  const iModelo = args.indexOf('--modelo');
  const modelo = iModelo >= 0 ? args[iModelo + 1] ?? '' : MODELO_AVALIACAO_PADRAO;

  if (!NIVEIS.includes(nivel) || !(numero >= 1 && numero <= 8)) {
    console.error('Uso: npm run gerar -- <A1|A2|B1|B2|C1> <1-8> [--modelo nome]');
    process.exit(1);
  }
  const chave = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!chave) {
    console.error('Defina a chave só nesta janela do PowerShell:  $env:GEMINI_API_KEY = "sua-chave"');
    process.exit(1);
  }

  const curriculo = CurriculoSchema.parse(ler('conteudo/curriculo.json'));
  const exemplos = {
    aula: AulaSchema.parse(ler('conteudo/a1/u01/aula2.json')),
    prova: ProvaSchema.parse(ler('conteudo/a1/u01/prova.json')),
  };
  const destino = path.join(RAIZ, 'conteudo-gerado', nivel.toLowerCase(), `u${String(numero).padStart(2, '0')}`);
  if (fs.existsSync(path.join(RAIZ, 'conteudo', nivel.toLowerCase(), `u${String(numero).padStart(2, '0')}`))) {
    console.warn('Atenção: essa unidade já existe em conteudo/. O resultado vai só para conteudo-gerado/, nada é sobrescrito.');
  }

  const r = await gerarUnidade({ chave, modelo, log: (m) => console.log(m) }, contextoDaUnidade(curriculo, nivel, numero), exemplos);

  fs.mkdirSync(destino, { recursive: true });
  const salvar = (nome: string, v: unknown) => fs.writeFileSync(path.join(destino, nome), JSON.stringify(v, null, 2) + '\n');
  salvar('unidade.json', r.unidade);
  r.aulas.forEach((a, i) => salvar(`aula${i + 1}.json`, a));
  salvar('prova.json', r.prova);
  console.log(`\nPronto! Arquivos em ${path.relative(RAIZ, destino)}. Revise antes de mover para conteudo/.`);
}

main().catch((e) => {
  // Mostra só a mensagem: nunca imprime a chave nem a requisição.
  console.error('Erro:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
