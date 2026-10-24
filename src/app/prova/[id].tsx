/**
 * Prova da unidade e prova final do nível: leitura, escuta, escrita e fala.
 * A prova final tem ainda uma entrevista oral com o professor de IA.
 * Escrita, fala e entrevista são corrigidas pelo avaliador de IA. Aprova com 70.
 * Aprovado na prova final: libera o próximo nível e gera o certificado em PDF.
 * Se sair no meio, nada é salvo (não conta como tentativa).
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput, StyleSheet, Text } from 'react-native';
import { acharProva } from '../../conteudo/curso';
import type { TarefaEscrita } from '../../conteudo/schema';
import * as repo from '../../dados/repositorio';
import { useApp } from '../../estado/AppContext';
import { ErroIA, MENSAGENS_ERRO } from '../../ia/gemini';
import { avaliarResposta, transcricaoEntrevista, type ResultadoAvaliacao } from '../../ia/professor';
import { estadoDe, ESPERA_REPROVACAO_MS } from '../../logica/desbloqueio';
import { calcularProva, contarFrases, NOMES_PARTES, type ResultadoProva } from '../../logica/notas';
import { falar, pararFala } from '../../voz/falar';
import { Aviso, Botao, Cartao, Linha, Paragrafo, Subtitulo, Tela, Titulo } from '../../ui/base';
import { BotaoFalar } from '../../ui/BotaoFalar';
import { compartilharCertificado } from '../../ui/certificado';
import { ConversaProfessor } from '../../ui/ConversaProfessor';
import { Dialogo } from '../../ui/Dialogo';
import { SequenciaExercicios, type ResultadoExercicio } from '../../ui/Exercicio';
import { quando } from '../../ui/formato';
import { cores, espaco, raio } from '../../ui/tema';
import { segundosDesde, useInicio } from '../../ui/useInicio';

type Etapa = 'intro' | 'leitura' | 'escuta' | 'escrita' | 'fala' | 'entrevista' | 'resultado';

export default function TelaProva() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { curso, status, db, perfil, chave, prefs, recarregar } = useApp();
  const achado = acharProva(curso, String(id));
  const [etapa, setEtapa] = useState<Etapa>('intro');
  const [leitura, setLeitura] = useState<ResultadoExercicio[]>([]);
  const [escuta, setEscuta] = useState<ResultadoExercicio[]>([]);
  const [escrita, setEscrita] = useState<ResultadoAvaliacao[]>([]);
  const [fala, setFala] = useState<ResultadoAvaliacao[]>([]);
  const [resultado, setResultado] = useState<ResultadoProva | null>(null);
  const [entrevista, setEntrevista] = useState<ResultadoAvaliacao | null>(null);
  const [avaliandoEntrevista, setAvaliandoEntrevista] = useState(false);
  const [erroEntrevista, setErroEntrevista] = useState<string | null>(null);
  const [transcricao, setTranscricao] = useState('');
  const [msgCertificado, setMsgCertificado] = useState<string | null>(null);
  const [liberaEm, setLiberaEm] = useState(0);
  const segundosFala = useRef(0);
  const inicio = useInicio();

  useEffect(() => () => pararFala(), []);

  if (!achado || !perfil) {
    return (
      <Tela>
        <Aviso tipo="erro" texto="Prova não encontrada." />
      </Tela>
    );
  }
  const { prova, final } = achado;
  const nivel = prova.nivel;
  const s = estadoDe(status, prova.id);

  if (etapa === 'intro' && s.estado !== 'disponivel' && s.estado !== 'concluida') {
    return (
      <Tela>
        <Aviso
          tipo="aviso"
          texto={
            s.estado === 'aguardando'
              ? `⏳ Nova tentativa liberada em ${quando(s.liberaEm!)}.`
              : achado.final
                ? '🔒 Passe nas provas das 8 unidades para liberar a prova final.'
                : '🔒 Conclua todas as aulas da unidade para liberar a prova.'
          }
        />
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </Tela>
    );
  }

  async function finalizar(falaFinal: ResultadoAvaliacao[], ent: ResultadoAvaliacao | null = null) {
    if (!perfil || !achado) return;
    const r = calcularProva({
      leitura: { acertos: leitura.filter((x) => x.acertou).length, total: leitura.length },
      escuta: { acertos: escuta.filter((x) => x.acertou).length, total: escuta.length },
      escrita: escrita.map((e) => e.nota),
      fala: falaFinal.map((e) => e.nota),
      entrevista: ent?.nota,
    });
    const agora = Date.now();
    setResultado(r);
    setLiberaEm(agora + ESPERA_REPROVACAO_MS);
    setEtapa('resultado');
    await repo.registrarTentativa(db, perfil.id, prova.id, { nota: r.nota, aprovado: r.aprovado, data: agora }, {
      partes: r.partes,
      pontosFracos: r.pontosFracos,
      feedback: [...escrita, ...falaFinal].map((e) => e.feedback_pt),
      entrevista: ent ? { nota: ent.nota, feedback: ent.feedback_pt } : undefined,
      final,
    });
    const erros = [...escrita, ...falaFinal, ...(ent ? [ent] : [])].flatMap((e) => e.erros);
    await repo.registrarErros(db, perfil.id, erros);
    await repo.adicionarRevisao(
      db,
      perfil.id,
      erros.map((e) => ({ item_id: `e:${e.certo.toLowerCase().slice(0, 100)}`, tipo: 'erro' as const, frente: e.certo, verso: e.explicacao_pt })),
    );
    await repo.registrarAtividade(db, perfil.id, { segundosFala: segundosFala.current, segundosEstudo: segundosDesde(inicio) });
    await recarregar();
  }

  const totalQuestoes = prova.leitura.perguntas.length + prova.escuta.perguntas.length + prova.escrita.length + prova.fala.length;
  const nomeNivel = curso.curriculo.niveis.find((n) => n.nivel === nivel)?.nome_pt ?? nivel;

  async function avaliarEntrevista(texto: string) {
    setAvaliandoEntrevista(true);
    setErroEntrevista(null);
    try {
      const av = await avaliarResposta(
        chave,
        prefs.modelos,
        {
          nivel,
          parte: 'fala',
          foco: prova.foco_avaliacao,
          tarefa: `Entrevista oral de ${prova.entrevista?.minutos ?? 5} minutos. Avalie SOMENTE as falas marcadas como ALUNO; as do EXAMINADOR são contexto.`,
        },
        texto,
        undefined,
        6000,
      );
      setEntrevista(av);
      await finalizar(fala, av);
    } catch (e) {
      setErroEntrevista(e instanceof ErroIA ? e.message : MENSAGENS_ERRO.rede);
    } finally {
      setAvaliandoEntrevista(false);
    }
  }

  async function gerarCertificado() {
    if (!perfil || !resultado) return;
    setMsgCertificado(null);
    try {
      await compartilharCertificado({ nome: perfil.nome, nivel, nomeNivel, nota: resultado.nota, data: Date.now() });
    } catch (e) {
      setMsgCertificado((e as Error).message || 'Não foi possível gerar o PDF.');
    }
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: prova.titulo }} />

      {etapa === 'intro' && (
        <>
          <Titulo>{prova.titulo}</Titulo>
          <Cartao>
            <Paragrafo>
              {totalQuestoes} questões em 4 partes: 📖 leitura, 🎧 escuta, ✍️ escrita e 🗣️ fala. Cada parte vale 25% da nota.
            </Paragrafo>
            {prova.entrevista && (
              <Paragrafo>
                🎤 No fim há uma entrevista oral de {prova.entrevista.minutos} minutos com o professor. Ela vale metade da nota de fala.
              </Paragrafo>
            )}
            <Paragrafo>Para passar: 70 ou mais. Se não passar, você vê o que revisar e pode tentar de novo em 24 horas.</Paragrafo>
            <Paragrafo suave>Na prova não aparece se você acertou cada questão: o resultado vem no fim. Se sair no meio, a tentativa não conta.</Paragrafo>
          </Cartao>
          {!chave ? (
            <Aviso tipo="aviso" texto="A escrita e a fala são corrigidas pela IA. Cadastre a chave em Configurações antes de começar." />
          ) : (
            <Botao titulo="Começar a prova" onPress={() => setEtapa('leitura')} />
          )}
        </>
      )}

      {etapa === 'leitura' && (
        <>
          <Subtitulo>📖 Parte 1 — Leitura</Subtitulo>
          <Cartao>
            <Text style={st.texto}>{prova.leitura.texto}</Text>
          </Cartao>
          <SequenciaExercicios
            lista={prova.leitura.perguntas}
            nivel={nivel}
            semFeedback
            onFim={(r) => {
              setLeitura(r);
              setEtapa('escuta');
            }}
          />
        </>
      )}

      {etapa === 'escuta' && (
        <>
          <Subtitulo>🎧 Parte 2 — Escuta</Subtitulo>
          <Paragrafo suave>Ouça o diálogo (sem transcrição) e responda.</Paragrafo>
          <Dialogo falas={prova.escuta.falas} nivel={nivel} permitirTranscricao={false} maxReproducoes={3} />
          <SequenciaExercicios
            lista={prova.escuta.perguntas}
            nivel={nivel}
            semFeedback
            onFim={(r) => {
              setEscuta(r);
              setEtapa('escrita');
            }}
          />
        </>
      )}

      {etapa === 'escrita' && (
        <ParteEscrita
          tarefa={prova.escrita[escrita.length]!}
          numero={escrita.length + 1}
          total={prova.escrita.length}
          avaliar={(texto, t) =>
            avaliarResposta(chave, prefs.modelos, { nivel, parte: 'escrita', foco: prova.foco_avaliacao, tarefa: t.instrucao_pt }, texto)
          }
          onPronto={(av) => {
            const todas = [...escrita, av];
            setEscrita(todas);
            if (todas.length >= prova.escrita.length) setEtapa('fala');
          }}
        />
      )}

      {etapa === 'fala' && (
        <ParteFala
          key={fala.length}
          pergunta={prova.fala[fala.length]!.pergunta_en}
          instrucao={prova.fala[fala.length]!.instrucao_pt}
          numero={fala.length + 1}
          total={prova.fala.length}
          ouvir={(t) => falar(t, { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade })}
          avaliar={(texto) =>
            avaliarResposta(
              chave,
              prefs.modelos,
              { nivel, parte: 'fala', foco: prova.foco_avaliacao, tarefa: `${prova.fala[fala.length]!.pergunta_en} (${prova.fala[fala.length]!.instrucao_pt})` },
              texto,
            )
          }
          onSegundos={(sg) => (segundosFala.current += sg)}
          onPronto={(av) => {
            const todas = [...fala, av];
            setFala(todas);
            if (todas.length < prova.fala.length) return;
            if (prova.entrevista) setEtapa('entrevista');
            else void finalizar(todas);
          }}
        />
      )}

      {etapa === 'entrevista' && prova.entrevista && (
        <>
          <Subtitulo>🎤 Parte 5 — Entrevista oral</Subtitulo>
          {!transcricao ? (
            <ConversaProfessor
              conversa={{
                situacao_pt: `Converse com o examinador por cerca de ${prova.entrevista.minutos} minutos. Responda com frases completas. Ele não corrige durante a entrevista.`,
                papel_professor: prova.entrevista.papel_professor,
                abertura: prova.entrevista.abertura,
                abertura_pt: prova.entrevista.abertura_pt,
              }}
              nivel={nivel}
              atividade="entrevista oral da prova final (não corrigir, só conversar)"
              tema={`revisão do nível ${nivel}`}
              vocabulario={[]}
              gramatica={prova.foco_avaliacao.slice(0, 280)}
              minTurnos={5}
              entrevistaMin={prova.entrevista.minutos}
              onConcluir={(r) => {
                // O tempo falado na entrevista já é registrado pela própria conversa.
                const t = transcricaoEntrevista(r.falas);
                setTranscricao(t);
                void avaliarEntrevista(t);
              }}
            />
          ) : (
            <Cartao>
              {avaliandoEntrevista && <Paragrafo>O avaliador está analisando a entrevista…</Paragrafo>}
              {erroEntrevista && (
                <>
                  <Aviso tipo="erro" texto={erroEntrevista} />
                  <Botao titulo="Tentar avaliar de novo" onPress={() => avaliarEntrevista(transcricao)} carregando={avaliandoEntrevista} />
                </>
              )}
            </Cartao>
          )}
        </>
      )}

      {etapa === 'resultado' && resultado && (
        <>
          <Titulo>{resultado.aprovado ? (final ? `🎓 Nível ${nivel} concluído!` : '🎉 Aprovado!') : 'Quase lá!'}</Titulo>
          <Cartao style={{ alignItems: 'center' }}>
            <Text style={[st.nota, { color: resultado.aprovado ? cores.sucesso : cores.erro }]}>{resultado.nota}</Text>
            <Paragrafo suave>nota de 0 a 100 (mínimo 70)</Paragrafo>
          </Cartao>
          <Cartao>
            {(Object.keys(resultado.partes) as (keyof typeof resultado.partes)[]).map((p) => (
              <Linha key={p} style={{ justifyContent: 'space-between' }}>
                <Paragrafo>{NOMES_PARTES[p]}</Paragrafo>
                <Text style={[st.parte, { color: resultado.partes[p] >= 70 ? cores.sucesso : cores.erro }]}>{resultado.partes[p]}</Text>
              </Linha>
            ))}
          </Cartao>
          <Cartao>
            <Subtitulo>Comentários do avaliador</Subtitulo>
            {[...escrita, ...fala].map((e, i) => (
              <Paragrafo key={i}>
                {i < escrita.length ? '✍️' : '🗣️'} ({e.nota.toFixed(1)}/10) {e.feedback_pt}
              </Paragrafo>
            ))}
            {entrevista && (
              <Paragrafo>
                🎤 Entrevista ({entrevista.nota.toFixed(1)}/10) {entrevista.feedback_pt}
              </Paragrafo>
            )}
            {fala.length > 0 && <Paragrafo suave>A nota de pronúncia é aproximada: ela se baseia no que o reconhecimento de voz entendeu.</Paragrafo>}
          </Cartao>
          {resultado.aprovado && final && (
            <Cartao>
              <Paragrafo>Parabéns, {perfil.nome}! O próximo nível já está liberado na trilha.</Paragrafo>
              <Botao titulo="📄 Gerar certificado em PDF" onPress={gerarCertificado} />
              {msgCertificado && <Aviso tipo="erro" texto={msgCertificado} />}
              <Paragrafo suave>Você também encontra seus certificados em “Meu progresso”.</Paragrafo>
            </Cartao>
          )}
          {!resultado.aprovado && (
            <Cartao>
              <Subtitulo>O que revisar</Subtitulo>
              {resultado.pontosFracos.map((p) => (
                <Paragrafo key={p}>• {NOMES_PARTES[p]}: refaça as etapas de {p === 'leitura' || p === 'escuta' ? 'escuta e prática' : 'conversa'} das aulas.</Paragrafo>
              ))}
              {[...leitura, ...escuta]
                .filter((r) => !r.acertou)
                .slice(0, 6)
                .map((r) => (
                  <Paragrafo key={r.exercicio.id} suave>
                    • Errou: {r.exercicio.tipo === 'multipla' ? r.exercicio.enunciado : 'ditado'}
                  </Paragrafo>
                ))}
              <Aviso tipo="info" texto={`Nova tentativa liberada em ${quando(liberaEm)}.`} />
            </Cartao>
          )}
          <Botao titulo="Voltar à trilha" onPress={() => router.back()} />
        </>
      )}
    </Tela>
  );
}

function useAvaliacao() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function rodar(fn: () => Promise<ResultadoAvaliacao>, ok: (r: ResultadoAvaliacao) => void) {
    setCarregando(true);
    setErro(null);
    try {
      ok(await fn());
    } catch (e) {
      setErro(e instanceof ErroIA ? e.message : MENSAGENS_ERRO.rede);
    } finally {
      setCarregando(false);
    }
  }
  return { carregando, erro, rodar };
}

function ParteEscrita({
  tarefa,
  numero,
  total,
  avaliar,
  onPronto,
}: {
  tarefa: TarefaEscrita;
  numero: number;
  total: number;
  avaliar: (texto: string, t: TarefaEscrita) => Promise<ResultadoAvaliacao>;
  onPronto: (r: ResultadoAvaliacao) => void;
}) {
  const [texto, setTexto] = useState('');
  const { carregando, erro, rodar } = useAvaliacao();
  const n = contarFrases(texto);
  const ok = n >= tarefa.min_frases && n <= tarefa.max_frases;
  return (
    <>
      <Subtitulo>
        ✍️ Parte 3 — Escrita ({numero} de {total})
      </Subtitulo>
      <Cartao>
        <Paragrafo>{tarefa.instrucao_pt}</Paragrafo>
        <Paragrafo suave>
          Escreva de {tarefa.min_frases} a {tarefa.max_frases} frases. Você escreveu {n}.
        </Paragrafo>
        <TextInput
          style={st.entrada}
          value={texto}
          onChangeText={setTexto}
          multiline
          maxLength={1500}
          placeholder="Escreva em inglês…"
          autoCorrect={false}
          spellCheck={false}
          editable={!carregando}
        />
        {erro && <Aviso tipo="erro" texto={erro} />}
        <Botao
          titulo={erro ? 'Tentar enviar de novo' : 'Enviar resposta'}
          desativado={!ok}
          carregando={carregando}
          onPress={() =>
            rodar(
              () => avaliar(texto, tarefa),
              (r) => {
                setTexto('');
                onPronto(r);
              },
            )
          }
        />
      </Cartao>
    </>
  );
}

function ParteFala({
  pergunta,
  instrucao,
  numero,
  total,
  ouvir,
  avaliar,
  onSegundos,
  onPronto,
}: {
  pergunta: string;
  instrucao: string;
  numero: number;
  total: number;
  ouvir: (t: string) => void;
  avaliar: (texto: string) => Promise<ResultadoAvaliacao>;
  onSegundos: (s: number) => void;
  onPronto: (r: ResultadoAvaliacao) => void;
}) {
  const [resposta, setResposta] = useState('');
  const [gravacoes, setGravacoes] = useState(0);
  const { carregando, erro, rodar } = useAvaliacao();
  // Chaves: o efeito não pode devolver a Promise da fala (o React a trataria como limpeza).
  useEffect(() => {
    ouvir(pergunta);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Subtitulo>
        🗣️ Parte 4 — Fala ({numero} de {total})
      </Subtitulo>
      <Cartao>
        <Text style={st.texto}>{pergunta}</Text>
        <Botao tipo="secundario" titulo="🔊 Ouvir a pergunta" onPress={() => ouvir(pergunta)} />
        <Paragrafo suave>{instrucao}</Paragrafo>
        {!!resposta && (
          <Aviso tipo="info" texto={`O que o celular entendeu: “${resposta}”`} />
        )}
        {gravacoes < 3 && (
          <BotaoFalar
            permitirDigitar={false}
            desativado={carregando}
            onTexto={(t, sg) => {
              setResposta(t);
              setGravacoes((g) => g + 1);
              onSegundos(sg);
            }}
          />
        )}
        {gravacoes > 0 && gravacoes < 3 && <Paragrafo suave>Não gostou? Grave de novo ({3 - gravacoes} restante{3 - gravacoes === 1 ? '' : 's'}).</Paragrafo>}
        {erro && <Aviso tipo="erro" texto={erro} />}
        <Botao
          titulo={erro ? 'Tentar enviar de novo' : 'Enviar resposta'}
          desativado={!resposta}
          carregando={carregando}
          onPress={() => rodar(() => avaliar(resposta), onPronto)}
        />
      </Cartao>
    </>
  );
}

const st = StyleSheet.create({
  texto: { fontSize: 18, lineHeight: 27, color: cores.texto },
  nota: { fontSize: 64, fontWeight: '800' },
  parte: { fontSize: 18, fontWeight: '700' },
  entrada: { borderWidth: 2, borderColor: cores.borda, borderRadius: raio, padding: espaco.m, fontSize: 17, minHeight: 140, backgroundColor: '#fff', textAlignVertical: 'top' },
});
