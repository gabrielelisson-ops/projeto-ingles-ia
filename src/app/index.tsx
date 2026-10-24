/** Tela inicial: quem vai estudar agora? */
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useApp } from '../estado/AppContext';
import { Aviso, Botao, Paragrafo, Tela, Titulo } from '../ui/base';
import { cores, espaco, raio } from '../ui/tema';

export default function EscolherPerfil() {
  const { perfis, escolherPerfil, pronto, chave, curso } = useApp();
  if (!pronto) return <ActivityIndicator style={{ marginTop: 80 }} size="large" />;
  return (
    <Tela>
      <Titulo>Quem vai estudar agora?</Titulo>
      <Paragrafo suave>Cada perfil tem seu próprio progresso, notas e revisões.</Paragrafo>
      {perfis.map((p) => (
        <Pressable
          key={p.id}
          style={({ pressed }) => [st.perfil, pressed && { opacity: 0.8 }]}
          onPress={async () => {
            await escolherPerfil(p.id);
            router.push('/inicio');
          }}
        >
          <Text style={st.emoji}>{p.id === 1 ? '🧑' : '👩'}</Text>
          <Text style={st.nome}>{p.nome}</Text>
        </Pressable>
      ))}
      {!chave && <Aviso tipo="aviso" texto="Primeiro passo: cadastre a chave da IA em Configurações para usar o professor por voz." />}
      {curso.erros.length > 0 && <Aviso tipo="erro" texto={`Há ${curso.erros.length} erro(s) nos arquivos de conteúdo. Veja em Configurações.`} />}
      <Botao tipo="secundario" titulo="⚙️ Configurações" onPress={() => router.push('/configuracoes')} />
    </Tela>
  );
}

const st = StyleSheet.create({
  perfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.g,
    backgroundColor: cores.cartao,
    borderRadius: raio,
    padding: espaco.g + 4,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  emoji: { fontSize: 40 },
  nome: { fontSize: 22, fontWeight: '700', color: cores.texto },
});
