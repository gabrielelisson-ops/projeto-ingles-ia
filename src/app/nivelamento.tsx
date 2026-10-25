/**
 * Teste de nivelamento (opcional): leitura/gramática, escuta e fala.
 * Sobe de nível enquanto você acertar 75%; no fim sugere o nível para começar.
 * Aplicar a sugestão só muda o nível em que a trilha começa: nenhum progresso é apagado.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { NIVEIS, type Nivel } from '../conteudo/schema';
import * as repo from '../dados/repositorio';
import { useApp } from '../estado/AppContext';
import { ErroIA, MENSAGENS_ERRO } from '../ia/gemini';
import { estimarNivelFala, type NivelFala } from '../ia/professor';
import { continuarTeste, sugerirNivel, type ResultadoNivel } from '../logica/nivelamento';
import { falar } from '../voz/falar';
import { Aviso, Botao, Cartao, Paragrafo, Subtitulo, Tela, Titulo } from '../ui/base';
import { BotaoFalar } from '../ui/BotaoFalar';
import { SequenciaExercicios } from '../ui/Exercicio';

type Etapa = 'intro' | 'questoes' | 'fala' | 'resultado';

export default function Nivelamento() {
  const { curso, perfil, chave, prefs, db, recarregarTudo } = useApp();
  const teste = curso.nivelamento;
  const [etapa, setEtapa] = useState<Etapa>('intro');
  const [indice, setIndice] = useState(0);
  const [resultados, setResultados] = useState<ResultadoNivel[]>([]);
  const [fala, setFala] = useState('');
  const [nivelFala, setNivelFala] = useState<NivelFala | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState(false);

  if (!teste || !perfil) {
    return (
      <Tela>
        <Aviso tipo="erro" texto="O teste de nivelamento não está disponível." />
      </Tela>
    );
  }

  const sugestao: Nivel = sugerirNivel(resultados, nivelFala?.nivel);
  const nomeNivel = (n: Nivel) => curso.curriculo.niveis.find((x) => x.nivel === n)?.nome_pt ?? n;
  const temConteudo = (n: Nivel) => curso.unidades.some((u) => u.nivel === n);

  async function avaliarFala() {
    setCarregando(true);
    setErro(null);
    try {
      setNivelFala(await estimarNivelFala(chave, prefs.modelos, fala));
      setEtapa('resultado');
    } catch (e) {
      setErro(e instanceof ErroIA ? e.message : MENSAGENS_ERRO.rede);
    } finally {
      setCarregando(false);
    }
  }

  async function aplicar(n: Nivel) {
    if (!perfil) return;
    await repo.definirNivelInicial(db, perfil.id, n);
    await recarregarTudo();
    setAplicado(true);
  }

  const nivelAtual = teste.niveis[indice];

  return (
    <Tela>
      <Titulo>📏 Teste de nivelamento</Titulo>

      {etapa === 'intro' && (
        <>
          <Cartao>
            <Paragrafo>
              Para quem já sabe um pouco de inglês. O teste começa no A1 e vai subindo: 6 questões por nível (gramática, leitura e escuta). Ele para no
              primeiro nível em que você acertar menos de 75%.
            </Paragrafo>
            <Paragrafo>No fim, você fala por 1 minuto e a IA confere o seu nível de conversa.</Paragrafo>
            <Paragrafo suave>
              Leva de 5 a 15 minutos. Aplicar o resultado só muda onde a sua trilha começa; nada do que você já fez é apagado.
            </Paragrafo>
          </Cartao>
          <Botao titulo="Começar o teste" onPress={() => setEtapa('questoes')} />
        </>
      )}

      {etapa === 'questoes' && nivelAtual && (
        <>
          <Subtitulo>
            Nível {nivelAtual.nivel} — {nomeNivel(nivelAtual.nivel)}
          </Subtitulo>
          <SequenciaExercicios
            key={nivelAtual.nivel}
            lista={nivelAtual.perguntas}
            nivel={nivelAtual.nivel}
            semFeedback
            onFim={(rs) => {
              const r: ResultadoNivel = { nivel: nivelAtual.nivel, acertos: rs.filter((x) => x.acertou).length, total: rs.length };
              setResultados((a) => [...a, r]);
              if (continuarTeste(r) && indice + 1 < teste.niveis.length) setIndice(indice + 1);
              else setEtapa('fala');
            }}
          />
        </>
      )}

      {etapa === 'fala' && (
        <>
          <Subtitulo>🗣️ Última parte: fala</Subtitulo>
          <Cartao>
            <Paragrafo>{teste.fala.pergunta_en}</Paragrafo>
            <Botao tipo="secundario" titulo="🔊 Ouvir a pergunta" onPress={() => falar(teste.fala.pergunta_en, { nivel: 'B1', sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade })} />
            <Paragrafo suave>{teste.fala.instrucao_pt}</Paragrafo>
            {!!fala && <Aviso tipo="info" texto={`O que o app entendeu: “${fala}”`} />}
            {chave ? (
              <>
                <BotaoFalar permitirDigitar={false} desativado={carregando} onTexto={(t) => setFala(t)} />
                {erro && <Aviso tipo="erro" texto={erro} />}
                <Botao titulo="Enviar e ver o resultado" desativado={!fala} carregando={carregando} onPress={avaliarFala} />
              </>
            ) : (
              <Aviso tipo="aviso" texto="Sem a chave da IA, a parte de fala fica de fora. O resultado usa só as questões." />
            )}
            <Botao tipo="texto" titulo="Pular a fala" onPress={() => setEtapa('resultado')} />
          </Cartao>
        </>
      )}

      {etapa === 'resultado' && (
        <>
          <Cartao style={{ alignItems: 'center' }}>
            <Paragrafo>Sugestão: comece no</Paragrafo>
            <Titulo>
              {sugestao} — {nomeNivel(sugestao)}
            </Titulo>
          </Cartao>
          <Cartao>
            <Subtitulo>Como você foi</Subtitulo>
            {resultados.map((r) => (
              <Paragrafo key={r.nivel}>
                {r.acertos / r.total >= 0.75 ? '✅' : '❌'} {r.nivel}: {r.acertos} de {r.total}
              </Paragrafo>
            ))}
            {NIVEIS.filter((n) => !resultados.some((r) => r.nivel === n)).length > 0 && (
              <Paragrafo suave>Os níveis acima não foram testados porque o teste parou antes.</Paragrafo>
            )}
            {nivelFala && (
              <Paragrafo>
                🗣️ Fala: {nivelFala.nivel}. {nivelFala.justificativa_pt}
              </Paragrafo>
            )}
          </Cartao>
          {aplicado ? (
            <>
              <Aviso tipo="sucesso" texto={`Pronto! A trilha de ${perfil.nome} agora começa no ${sugestao}.`} />
              <Botao titulo="Ir para a trilha" onPress={() => router.replace('/inicio')} />
            </>
          ) : (
            <>
              {!temConteudo(sugestao) && <Aviso tipo="aviso" texto={`O conteúdo do ${sugestao} ainda não está no app.`} />}
              <Botao titulo={`Começar no ${sugestao}`} desativado={!temConteudo(sugestao)} onPress={() => aplicar(sugestao)} />
              <Botao tipo="secundario" titulo="Prefiro começar no A1" onPress={() => aplicar('A1')} />
            </>
          )}
        </>
      )}
    </Tela>
  );
}
