/**
 * Praticar: conversa livre com o professor, roleplays, pronúncia e revisão.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../estado/AppContext';
import { Botao, Paragrafo, Subtitulo, Tela, Titulo } from '../ui/base';
import { cores, espaco, raio } from '../ui/tema';

export default function Praticar() {
  const { curso, nivel } = useApp();
  return (
    <Tela>
      <Titulo>🗣️ Praticar</Titulo>
      <Paragrafo suave>O professor ajusta a conversa ao seu nível atual ({nivel}).</Paragrafo>
      <Botao titulo="💬 Conversa livre" onPress={() => router.push('/conversa/livre')} />
      <Linha2>
        <Botao tipo="secundario" titulo="🎙️ Pronúncia" onPress={() => router.push('/pronuncia')} style={{ flex: 1 }} />
        <Botao tipo="secundario" titulo="🔁 Revisão" onPress={() => router.push('/revisao')} style={{ flex: 1 }} />
      </Linha2>
      <Subtitulo>🎭 Roleplays (situações reais)</Subtitulo>
      <View style={st.grade}>
        {curso.roleplays.map((r) => (
          <Pressable key={r.id} style={({ pressed }) => [st.item, pressed && { opacity: 0.8 }]} onPress={() => router.push(`/conversa/${r.id}`)}>
            <Text style={st.emoji}>{r.emoji}</Text>
            <Text style={st.nome}>{r.titulo_pt}</Text>
          </Pressable>
        ))}
      </View>
    </Tela>
  );
}

function Linha2({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: espaco.m }}>{children}</View>;
}

const st = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.m },
  item: { width: '47%', backgroundColor: cores.cartao, borderRadius: raio, padding: espaco.g, borderWidth: 1, borderColor: cores.borda, alignItems: 'center', gap: 6 },
  emoji: { fontSize: 36 },
  nome: { fontSize: 15, fontWeight: '700', color: cores.texto, textAlign: 'center' },
});
