/**
 * Botão "segurar para falar". Segure, fale em inglês, solte.
 * Também tem a opção de digitar, para quando o microfone não funcionar.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useReconhecimento } from '../voz/ouvir';
import { Aviso, Botao, Linha } from './base';
import { cores, espaco, raio } from './tema';

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
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState('');

  if (digitando) {
    return (
      <View style={{ gap: espaco.m }}>
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
          <Botao tipo="texto" titulo="🎤 Voltar a falar" onPress={() => setDigitando(false)} />
        </Linha>
      </View>
    );
  }

  return (
    <View style={{ gap: espaco.m, alignItems: 'stretch' }}>
      {!!parcial && <Text style={st.parcial}>“{parcial}”</Text>}
      {!!erro && <Aviso tipo="erro" texto={erro} />}
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
