/**
 * Peças visuais reutilizadas em todas as telas.
 * Todo texto aparece com <Text>, que nunca interpreta HTML: texto do aluno
 * ou da IA é sempre mostrado como texto puro.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cores, espaco, raio } from './tema';

export function Tela({ children, rolar = true }: { children: ReactNode; rolar?: boolean }) {
  return (
    <SafeAreaView style={s.tela} edges={['bottom', 'left', 'right']}>
      {rolar ? (
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.conteudo, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Cartao({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.cartao, style]}>{children}</View>;
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={s.titulo}>{children}</Text>;
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return <Text style={s.subtitulo}>{children}</Text>;
}

export function Paragrafo({ children, suave }: { children: ReactNode; suave?: boolean }) {
  return <Text style={[s.paragrafo, suave && { color: cores.suave }]}>{children}</Text>;
}

type BotaoProps = {
  titulo: string;
  onPress: () => void;
  tipo?: 'primario' | 'secundario' | 'perigo' | 'texto';
  desativado?: boolean;
  carregando?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Botao({ titulo, onPress, tipo = 'primario', desativado, carregando, style }: BotaoProps) {
  const fundo =
    tipo === 'primario' ? cores.primaria : tipo === 'perigo' ? cores.erro : tipo === 'secundario' ? cores.primariaClara : 'transparent';
  const corTexto = tipo === 'primario' || tipo === 'perigo' ? '#fff' : cores.primaria;
  const off = desativado || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [s.botao, { backgroundColor: fundo, opacity: off ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      {carregando ? <ActivityIndicator color={corTexto} /> : <Text style={[s.botaoTexto, { color: corTexto }]}>{titulo}</Text>}
    </Pressable>
  );
}

export function Aviso({ texto, tipo = 'aviso' }: { texto: string; tipo?: 'aviso' | 'erro' | 'sucesso' | 'info' }) {
  const mapa = {
    aviso: [cores.avisoClaro, cores.aviso],
    erro: [cores.erroClaro, cores.erro],
    sucesso: [cores.sucessoClaro, cores.sucesso],
    info: [cores.primariaClara, cores.primaria],
  } as const;
  const [fundo, borda] = mapa[tipo];
  return (
    <View style={[s.aviso, { backgroundColor: fundo, borderLeftColor: borda }]}>
      <Text style={s.paragrafo}>{texto}</Text>
    </View>
  );
}

export function Linha({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: espaco.m, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function BarraProgresso({ valor }: { valor: number }) {
  return (
    <View style={s.barra}>
      <View style={[s.barraCheia, { width: `${Math.max(0, Math.min(100, valor))}%` }]} />
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.g, gap: espaco.m, paddingBottom: espaco.gg * 2 },
  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: raio,
    padding: espaco.g,
    gap: espaco.m,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  titulo: { fontSize: 24, fontWeight: '700', color: cores.texto },
  subtitulo: { fontSize: 18, fontWeight: '700', color: cores.texto },
  paragrafo: { fontSize: 16, lineHeight: 23, color: cores.texto },
  botao: { minHeight: 50, borderRadius: raio, paddingHorizontal: espaco.g, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontSize: 16, fontWeight: '700' },
  aviso: { padding: espaco.m, borderRadius: 10, borderLeftWidth: 5 },
  barra: { height: 10, backgroundColor: cores.borda, borderRadius: 5, overflow: 'hidden' },
  barraCheia: { height: 10, backgroundColor: cores.sucesso },
});
