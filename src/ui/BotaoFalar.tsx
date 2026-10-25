/**
 * Botão de falar. No celular (app): segure, fale em inglês, solte.
 * No navegador: toque para começar e toque de novo para enviar, porque no iPhone
 * segurar o dedo seleciona o texto da página e corta a gravação.
 * Também tem a opção de digitar, para quando o microfone não funcionar.
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { reconhecimentoDisponivel, useReconhecimento } from '../voz/ouvir';
import { Aviso, Botao, Linha } from './base';
import { cores, espaco, raio } from './tema';

/** No navegador o botão funciona por toque (liga/desliga), não por segurar. */
export const FALAR_POR_TOQUE = Platform.OS === 'web';

/** Impede que o toque no botão selecione texto ou abra o menu do iPhone. */
const SEM_SELECAO = FALAR_POR_TOQUE
  ? ({ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as object)
  : {};

export function BotaoFalar({
  onTexto,
  desativado,
  permitirDigitar = true,
}: {
  onTexto: (texto: string, segundosFala: number) => void;
  desativado?: boolean;
  permitirDigitar?: boolean;
}) {
  const { ouvindo, parcial, erro, iniciar, parar } = useReconhecimento(onTexto);
  const [temVoz] = useState(reconhecimentoDisponivel);
  const [digitando, setDigitando] = useState(!temVoz);
  const [texto, setTexto] = useState('');

  if (digitando) {
    return (
      <View style={{ gap: espaco.m }}>
        {!temVoz && (
          <Aviso
            tipo="info"
            texto="Este navegador não reconhece a fala. Toque no 🎤 do teclado (ditado) e fale em inglês, ou digite. No computador, use o Chrome ou o Edge."
          />
        )}
        <TextInput
          style={st.entrada}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escreva em inglês"
          maxLength={600}
          multiline
          autoCorrect={false}
        />
        <Linha>
          <Botao
            titulo="Enviar"
            desativado={!texto.trim() || desativado}
            onPress={() => {
              onTexto(texto.trim(), 0);
              setTexto('');
            }}
          />
          {temVoz && <Botao tipo="texto" titulo="🎤 Voltar a falar" onPress={() => setDigitando(false)} />}
        </Linha>
      </View>
    );
  }

  return (
    <View style={{ gap: espaco.m, alignItems: 'stretch' }}>
      {!!parcial && <Text style={st.parcial}>“{parcial}”</Text>}
      {!!erro && <Aviso tipo="erro" texto={erro} />}
      {FALAR_POR_TOQUE ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ouvindo ? 'Parar e enviar' : 'Tocar para falar'}
          disabled={desativado}
          onPress={ouvindo ? parar : iniciar}
          style={[st.botao, SEM_SELECAO, ouvindo && st.ouvindo, desativado && { opacity: 0.5 }]}
        >
          <Text style={[st.botaoTexto, SEM_SELECAO]}>{ouvindo ? '🔴 Ouvindo… toque para enviar' : '🎤 Toque para falar'}</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Segure para falar"
          disabled={desativado}
          onPressIn={iniciar}
          onPressOut={parar}
          style={[st.botao, ouvindo && st.ouvindo, desativado && { opacity: 0.5 }]}
        >
          <Text style={st.botaoTexto}>{ouvindo ? '🔴 Ouvindo… solte para enviar' : '🎤 Segure para falar'}</Text>
        </Pressable>
      )}
      {permitirDigitar && <Botao tipo="texto" titulo="⌨️ Prefiro digitar" onPress={() => setDigitando(true)} />}
    </View>
  );
}

const st = StyleSheet.create({
  botao: { backgroundColor: cores.primaria, borderRadius: 40, paddingVertical: 22, alignItems: 'center' },
  ouvindo: { backgroundColor: cores.erro },
  botaoTexto: { color: '#fff', fontSize: 18, fontWeight: '700' },
  parcial: { fontSize: 17, fontStyle: 'italic', color: cores.suave, textAlign: 'center' },
  entrada: { borderWidth: 2, borderColor: cores.borda, borderRadius: raio, padding: espaco.m, fontSize: 17, minHeight: 80, backgroundColor: '#fff', textAlignVertical: 'top' },
});
