/**
 * Mostra um exercício de qualquer tipo e corrige a resposta.
 * Com `semFeedback` (provas), não mostra se acertou: só avança.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Exercicio as Ex, Nivel } from '../conteudo/schema';
import { useApp } from '../estado/AppContext';
import { embaralhar, sementeDeTexto } from '../logica/estatisticas';
import { corrigir, palavrasParaOrdenar, respostaCerta, type Resposta } from '../logica/respostas';
import { falar } from '../voz/falar';
import { Aviso, Botao, Cartao, Linha, Paragrafo } from './base';
import { cores, espaco, raio } from './tema';

export type ResultadoExercicio = { exercicio: Ex; resposta: Resposta; acertou: boolean };

const ROTULO: Record<Ex['tipo'], string> = {
  multipla: 'Escolha a resposta',
  completar: 'Complete a frase',
  ordenar: 'Coloque as palavras na ordem',
  ouvir_escrever: 'Ouça e escreva',
  traduzir: 'Traduza para o inglês',
};

export function BotaoOuvir({ texto, nivel, rotulo = '🔊 Ouvir' }: { texto: string; nivel: Nivel; rotulo?: string }) {
  const { prefs } = useApp();
  return (
    <Linha>
      <Botao tipo="secundario" titulo={rotulo} onPress={() => falar(texto, { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade })} />
      <Botao
        tipo="secundario"
        titulo="🐢 Devagar"
        onPress={() => falar(texto, { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade, devagar: true })}
      />
    </Linha>
  );
}

export function Exercicio({
  ex,
  nivel,
  semFeedback,
  onResponder,
}: {
  ex: Ex;
  nivel: Nivel;
  semFeedback?: boolean;
  onResponder: (r: ResultadoExercicio) => void;
}) {
  const { prefs } = useApp();
  const [texto, setTexto] = useState('');
  const [ordem, setOrdem] = useState<number[]>([]);
  const [resultado, setResultado] = useState<ResultadoExercicio | null>(null);

  const palavras = useMemo(
    () => (ex.tipo === 'ordenar' ? embaralhar(palavrasParaOrdenar(ex.frase), sementeDeTexto(ex.id)) : []),
    [ex],
  );

  useEffect(() => {
    setTexto('');
    setOrdem([]);
    setResultado(null);
    const audio = ex.tipo === 'ouvir_escrever' || ex.tipo === 'multipla' ? ex.audio : undefined;
    if (audio) void falar(audio, { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id]);

  const responder = (resposta: Resposta) => {
    const r = { exercicio: ex, resposta, acertou: corrigir(ex, resposta) };
    if (semFeedback) onResponder(r);
    else setResultado(r);
  };

  const respondido = !!resultado;

  return (
    <Cartao>
      <Text style={st.rotulo}>{ROTULO[ex.tipo]}</Text>

      {ex.tipo === 'multipla' && (
        <>
          <Text style={st.enunciado}>{ex.enunciado}</Text>
          {ex.audio && <BotaoOuvir texto={ex.audio} nivel={nivel} />}
          {ex.opcoes.map((op, i) => {
            const marcada = resultado?.resposta === i;
            const certa = respondido && i === ex.correta;
            return (
              <Pressable
                key={i}
                onPress={respondido ? undefined : () => responder(i)}
                style={[st.opcao, certa && st.opcaoCerta, marcada && !resultado?.acertou && st.opcaoErrada]}
              >
                <Text style={st.opcaoTexto}>{op}</Text>
              </Pressable>
            );
          })}
        </>
      )}

      {ex.tipo === 'completar' && <Text style={st.enunciado}>{ex.frase}</Text>}
      {ex.tipo === 'completar' && ex.dica_pt && <Paragrafo suave>Dica: {ex.dica_pt}</Paragrafo>}
      {ex.tipo === 'traduzir' && <Text style={st.enunciado}>{ex.pt}</Text>}
      {ex.tipo === 'ouvir_escrever' && <BotaoOuvir texto={ex.audio} nivel={nivel} rotulo="🔊 Ouvir de novo" />}

      {(ex.tipo === 'completar' || ex.tipo === 'traduzir' || ex.tipo === 'ouvir_escrever') && (
        <>
          <TextInput
            style={st.entrada}
            value={texto}
            onChangeText={setTexto}
            editable={!respondido}
            placeholder={ex.tipo === 'completar' ? 'Palavra que falta' : 'Escreva em inglês'}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            maxLength={200}
            onSubmitEditing={() => texto.trim() && !respondido && responder(texto)}
          />
          {!respondido && <Botao titulo="Verificar" onPress={() => responder(texto)} desativado={!texto.trim()} />}
        </>
      )}

      {ex.tipo === 'ordenar' && (
        <>
          {ex.traducao_pt && <Paragrafo suave>"{ex.traducao_pt}"</Paragrafo>}
          <View style={[st.linhaPalavras, st.resposta]}>
            {ordem.map((idx, pos) => (
              <Pressable key={pos} onPress={respondido ? undefined : () => setOrdem(ordem.filter((_, i) => i !== pos))} style={st.ficha}>
                <Text style={st.fichaTexto}>{palavras[idx]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={st.linhaPalavras}>
            {palavras.map((p, idx) =>
              ordem.includes(idx) ? null : (
                <Pressable key={idx} onPress={respondido ? undefined : () => setOrdem([...ordem, idx])} style={st.ficha}>
                  <Text style={st.fichaTexto}>{p}</Text>
                </Pressable>
              ),
            )}
          </View>
          {!respondido && (
            <Botao
              titulo="Verificar"
              desativado={ordem.length !== palavras.length}
              onPress={() => responder(ordem.map((i) => palavras[i]).join(' '))}
            />
          )}
        </>
      )}

      {resultado && (
        <>
          <Aviso
            tipo={resultado.acertou ? 'sucesso' : 'erro'}
            texto={
              (resultado.acertou ? '✅ Muito bem!' : `❌ Resposta certa: ${respostaCerta(ex)}`) +
              (ex.explicacao_pt ? `\n${ex.explicacao_pt}` : '')
            }
          />
          <Botao titulo="Continuar" onPress={() => onResponder(resultado)} />
        </>
      )}
    </Cartao>
  );
}

/** Roda uma lista de exercícios em sequência e devolve os resultados no fim. */
export function SequenciaExercicios({
  lista,
  nivel,
  semFeedback,
  onFim,
}: {
  lista: Ex[];
  nivel: Nivel;
  semFeedback?: boolean;
  onFim: (r: ResultadoExercicio[]) => void;
}) {
  const [i, setI] = useState(0);
  const [resultados, setResultados] = useState<ResultadoExercicio[]>([]);
  const ex = lista[i];
  if (!ex) return null;
  return (
    <View style={{ gap: espaco.m }}>
      <Paragrafo suave>
        Questão {i + 1} de {lista.length}
      </Paragrafo>
      <Exercicio
        key={`${ex.id}-${i}`}
        ex={ex}
        nivel={nivel}
        semFeedback={semFeedback}
        onResponder={(r) => {
          const todos = [...resultados, r];
          setResultados(todos);
          if (i + 1 < lista.length) setI(i + 1);
          else onFim(todos);
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  rotulo: { fontSize: 13, fontWeight: '700', color: cores.suave, textTransform: 'uppercase' },
  enunciado: { fontSize: 20, fontWeight: '600', color: cores.texto, lineHeight: 28 },
  opcao: { borderWidth: 2, borderColor: cores.borda, borderRadius: raio, padding: espaco.m + 2, backgroundColor: '#fff' },
  opcaoCerta: { borderColor: cores.sucesso, backgroundColor: cores.sucessoClaro },
  opcaoErrada: { borderColor: cores.erro, backgroundColor: cores.erroClaro },
  opcaoTexto: { fontSize: 17, color: cores.texto },
  entrada: { borderWidth: 2, borderColor: cores.borda, borderRadius: raio, padding: espaco.m, fontSize: 18, backgroundColor: '#fff', color: cores.texto },
  linhaPalavras: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.p + 2 },
  resposta: { minHeight: 56, borderBottomWidth: 2, borderColor: cores.borda, paddingBottom: espaco.p },
  ficha: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: cores.primariaClara, borderWidth: 1, borderColor: cores.primaria },
  fichaTexto: { fontSize: 17, color: cores.texto },
});
