/**
 * Uma aula completa, em 8 etapas:
 * aquecimento → vocabulário → gramática → escuta → prática → conversa → teste rápido → resumo.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { acharAula } from '../../conteudo/curso';
import * as repo from '../../dados/repositorio';
import { useApp } from '../../estado/AppContext';
import { estadoDe } from '../../logica/desbloqueio';
import { testeRapidoAprovado } from '../../logica/notas';
import { respostaCerta } from '../../logica/respostas';
import { falar, pararFala } from '../../voz/falar';
import { Aviso, BarraProgresso, Botao, Cartao, Linha, Paragrafo, Subtitulo, Tela, Titulo } from '../../ui/base';
import { ConversaProfessor } from '../../ui/ConversaProfessor';
import { Dialogo } from '../../ui/Dialogo';
import { SequenciaExercicios, type ResultadoExercicio } from '../../ui/Exercicio';
import { cores, espaco } from '../../ui/tema';
import { segundosDesde, useInicio } from '../../ui/useInicio';

const ETAPAS = ['Aquecimento', 'Vocabulário', 'Gramática', 'Escuta', 'Prática', 'Conversa', 'Teste rápido', 'Resumo'] as const;

type Erro = { pergunta: string; certo: string };

export default function TelaAula() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { curso, status, db, perfil, prefs, recarregar } = useApp();
  const achado = acharAula(curso, String(id));
  const [etapa, setEtapa] = useState(0);
  const [erros, setErros] = useState<Erro[]>([]);
  const [teste, setTeste] = useState<{ acertos: number; tentativa: number } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [escutaFeita, setEscutaFeita] = useState(false);
  const inicio = useInicio();

  useEffect(() => () => pararFala(), []);

  if (!achado || !perfil) {
    return (
      <Tela>
        <Aviso tipo="erro" texto="Aula não encontrada." />
      </Tela>
    );
  }
  const { aula, unidade } = achado;
  const nivel = aula.nivel;
  const est = estadoDe(status, aula.id).estado;
  if (est === 'bloqueada' || est === 'em_breve') {
    return (
      <Tela>
        <Aviso tipo="aviso" texto="🔒 Esta aula ainda está bloqueada. Conclua a aula anterior primeiro." />
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </Tela>
    );
  }

  const ctx = {
    nivel,
    tema: `${unidade.tema_pt} — ${aula.titulo}`,
    vocabulario: aula.vocabulario.map((v) => v.en),
    gramatica: aula.gramatica.titulo,
  };
  const opcoesFala = { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade };
  const avancar = () => {
    pararFala();
    setEtapa((e) => Math.min(ETAPAS.length - 1, e + 1));
  };
  const guardarErros = (rs: ResultadoExercicio[]) =>
    setErros((atual) => [
      ...atual,
      ...rs
        .filter((r) => !r.acertou)
        .map((r) => ({
          pergunta: r.exercicio.tipo === 'traduzir' ? r.exercicio.pt : r.exercicio.tipo === 'multipla' ? r.exercicio.enunciado : respostaCerta(r.exercicio),
          certo: respostaCerta(r.exercicio),
        })),
    ]);

  async function terminarTeste(rs: ResultadoExercicio[]) {
    guardarErros(rs);
    const acertos = rs.filter((r) => r.acertou).length;
    setTeste({ acertos, tentativa });
    if (testeRapidoAprovado(acertos, rs.length) && perfil) {
      await repo.concluirAula(db, perfil.id, aula.id, acertos);
      await repo.registrarAtividade(db, perfil.id, { segundosEstudo: segundosDesde(inicio) });
      // Vocabulário e erros da aula entram na fila de revisão espaçada.
      await repo.adicionarRevisao(db, perfil.id, [
        ...aula.vocabulario.map((v) => ({ item_id: `w:${v.id}`, tipo: 'palavra' as const, frente: v.en, verso: v.pt, emoji: v.emoji })),
        ...rs
          .filter((r) => !r.acertou)
          .map((r) => ({ item_id: `x:${r.exercicio.id}`, tipo: 'frase' as const, frente: respostaCerta(r.exercicio), verso: r.exercicio.explicacao_pt ?? '' })),
      ]);
      await recarregar();
    }
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: `Aula ${aula.numero}: ${aula.titulo}` }} />
      <BarraProgresso valor={(etapa / (ETAPAS.length - 1)) * 100} />
      <Paragrafo suave>
        Etapa {etapa + 1} de {ETAPAS.length}: {ETAPAS[etapa]}
      </Paragrafo>

      {etapa === 0 && (
        <>
          <Titulo>{aula.titulo}</Titulo>
          <Paragrafo>🎯 {aula.objetivo_pt}</Paragrafo>
          <ConversaProfessor
            conversa={aula.aquecimento}
            atividade="aquecimento (conversa curta para começar a aula)"
            minTurnos={1}
            onConcluir={avancar}
            {...ctx}
          />
        </>
      )}

      {etapa === 1 && (
        <>
          <Subtitulo>Vocabulário</Subtitulo>
          <Paragrafo suave>Toque numa palavra para ouvir. Toque no exemplo para ouvir a frase.</Paragrafo>
          {aula.vocabulario.map((v) => (
            <Cartao key={v.id}>
              <Pressable onPress={() => falar(v.en, opcoesFala)}>
                <Linha>
                  <Text style={{ fontSize: 40 }}>{v.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.palavra}>{v.en} 🔊</Text>
                    <Text style={st.traducao}>{v.pt}</Text>
                  </View>
                </Linha>
              </Pressable>
              <Pressable onPress={() => falar(v.exemplo_en, opcoesFala)}>
                <Text style={st.exemplo}>“{v.exemplo_en}”</Text>
                <Text style={st.traducao}>{v.exemplo_pt}</Text>
              </Pressable>
            </Cartao>
          ))}
          <Botao titulo="Continuar" onPress={avancar} />
        </>
      )}

      {etapa === 2 && (
        <>
          <Subtitulo>{aula.gramatica.titulo}</Subtitulo>
          <Cartao>
            <Paragrafo>{aula.gramatica.explicacao_pt}</Paragrafo>
          </Cartao>
          <Cartao style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            <View style={[st.linhaTabela, { backgroundColor: cores.primariaClara }]}>
              {aula.gramatica.tabela.colunas.map((c, i) => (
                <Text key={i} style={[st.celula, { fontWeight: '700' }]}>
                  {c}
                </Text>
              ))}
            </View>
            {aula.gramatica.tabela.linhas.map((l, i) => (
              <View key={i} style={st.linhaTabela}>
                {l.map((c, j) => (
                  <Text key={j} style={st.celula}>
                    {c}
                  </Text>
                ))}
              </View>
            ))}
          </Cartao>
          <Subtitulo>Exemplos</Subtitulo>
          {aula.gramatica.exemplos.map((e, i) => (
            <Pressable key={i} onPress={() => falar(e.en, opcoesFala)}>
              <Cartao>
                <Text style={st.exemplo}>🔊 {e.en}</Text>
                <Text style={st.traducao}>{e.pt}</Text>
              </Cartao>
            </Pressable>
          ))}
          <Botao titulo="Continuar" onPress={avancar} />
        </>
      )}

      {etapa === 3 && (
        <>
          <Subtitulo>🎧 {aula.escuta.titulo}</Subtitulo>
          <Paragrafo suave>Ouça o diálogo. Tente entender sem a transcrição; se precisar, mostre o texto.</Paragrafo>
          <Dialogo falas={aula.escuta.falas} nivel={nivel} />
          {!escutaFeita ? (
            <SequenciaExercicios
              lista={aula.escuta.perguntas}
              nivel={nivel}
              onFim={(rs) => {
                guardarErros(rs);
                setEscutaFeita(true);
              }}
            />
          ) : (
            <Botao titulo="Continuar" onPress={avancar} />
          )}
        </>
      )}

      {etapa === 4 && (
        <>
          <Subtitulo>Prática guiada</Subtitulo>
          <SequenciaExercicios
            lista={aula.pratica}
            nivel={nivel}
            onFim={(rs) => {
              guardarErros(rs);
              avancar();
            }}
          />
        </>
      )}

      {etapa === 5 && (
        <>
          <Subtitulo>🗣️ Conversa com o professor</Subtitulo>
          <ConversaProfessor
            conversa={aula.conversa}
            atividade="conversa da aula (situação real usando o vocabulário e a gramática)"
            minTurnos={3}
            onConcluir={(r) => {
              setErros((a) => [...a, ...r.correcoes.map((c) => ({ pergunta: c.errado, certo: c.certo }))]);
              avancar();
            }}
            {...ctx}
          />
        </>
      )}

      {etapa === 6 && (
        <>
          <Subtitulo>✏️ Teste rápido</Subtitulo>
          <Paragrafo suave>5 perguntas. Acerte pelo menos 4 para concluir a aula.</Paragrafo>
          {teste?.tentativa !== tentativa ? (
            <SequenciaExercicios key={tentativa} lista={aula.teste} nivel={nivel} onFim={terminarTeste} />
          ) : testeRapidoAprovado(teste.acertos) ? (
            <>
              <Aviso tipo="sucesso" texto={`🎉 Você acertou ${teste.acertos} de 5. Aula concluída!`} />
              <Botao titulo="Ver resumo" onPress={avancar} />
            </>
          ) : (
            <>
              <Aviso tipo="erro" texto={`Você acertou ${teste.acertos} de 5. Precisa de 4. Revise e tente de novo!`} />
              <Linha>
                <Botao titulo="Tentar de novo" onPress={() => setTentativa(tentativa + 1)} />
                <Botao tipo="secundario" titulo="Rever a gramática" onPress={() => setEtapa(2)} />
              </Linha>
            </>
          )}
        </>
      )}

      {etapa === 7 && (
        <>
          <Titulo>Resumo da aula</Titulo>
          <Cartao>
            <Subtitulo>✅ O que você aprendeu</Subtitulo>
            <Paragrafo>{aula.objetivo_pt}</Paragrafo>
            <Paragrafo>
              Palavras: {aula.vocabulario.map((v) => `${v.emoji} ${v.en}`).join(' · ')}
            </Paragrafo>
            <Paragrafo>Gramática: {aula.gramatica.titulo}</Paragrafo>
          </Cartao>
          <Cartao>
            <Subtitulo>📌 Erros desta aula</Subtitulo>
            {erros.length === 0 ? (
              <Paragrafo>Nenhum erro. Excelente! 🌟</Paragrafo>
            ) : (
              erros.slice(0, 15).map((e, i) => (
                <Paragrafo key={i}>
                  • {e.pergunta !== e.certo ? `${e.pergunta} → ` : ''}
                  <Text style={{ fontWeight: '700', color: cores.sucesso }}>{e.certo}</Text>
                </Paragrafo>
              ))
            )}
          </Cartao>
          <Cartao>
            <Subtitulo>🔁 Para a revisão</Subtitulo>
            <Paragrafo>
              {aula.vocabulario.length} palavras desta aula entraram na sua fila de revisão espaçada. Os erros que o professor corrigiu vão
              aparecer de novo nas próximas conversas.
            </Paragrafo>
          </Cartao>
          <Botao titulo="Voltar à trilha" onPress={() => router.back()} />
        </>
      )}

      {etapa > 0 && etapa < 6 && (
        <Botao tipo="texto" titulo="← Etapa anterior" onPress={() => setEtapa(etapa - 1)} style={{ marginTop: espaco.g }} />
      )}
    </Tela>
  );
}

const st = StyleSheet.create({
  palavra: { fontSize: 22, fontWeight: '700', color: cores.texto },
  traducao: { fontSize: 15, color: cores.suave },
  exemplo: { fontSize: 17, color: cores.texto, fontStyle: 'italic' },
  linhaTabela: { flexDirection: 'row', borderBottomWidth: 1, borderColor: cores.borda },
  celula: { flex: 1, padding: 10, fontSize: 15, color: cores.texto },
});
