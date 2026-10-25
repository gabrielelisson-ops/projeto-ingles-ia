import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrar, type Banco } from '../dados/banco';
import { ProvedorBanco } from '../dados/ProvedorBanco';
import { garantirPerfisIniciais } from '../dados/repositorio';
import { AppProvider } from '../estado/AppContext';
import { configurarExibicaoDeNotificacoes } from '../ui/lembrete';
import { cores } from '../ui/tema';

configurarExibicaoDeNotificacoes();

async function iniciarBanco(db: Banco) {
  await migrar(db);
  await garantirPerfisIniciais(db);
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <ProvedorBanco aoIniciar={iniciarBanco}>
        <AppProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: cores.cartao },
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: cores.fundo },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Inglês com IA' }} />
            <Stack.Screen name="inicio" options={{ title: 'Meu curso' }} />
            <Stack.Screen name="aula/[id]" options={{ title: 'Aula' }} />
            <Stack.Screen name="prova/[id]" options={{ title: 'Prova' }} />
            <Stack.Screen name="teste-do-dia" options={{ title: 'Teste rápido do dia' }} />
            <Stack.Screen name="painel" options={{ title: 'Meu progresso' }} />
            <Stack.Screen name="praticar" options={{ title: 'Praticar' }} />
            <Stack.Screen name="revisao" options={{ title: 'Revisão do dia' }} />
            <Stack.Screen name="pronuncia" options={{ title: 'Pronúncia' }} />
            <Stack.Screen name="conversa/[id]" options={{ title: 'Conversa' }} />
            <Stack.Screen name="nivelamento" options={{ title: 'Nivelamento' }} />
            <Stack.Screen name="juntos" options={{ title: 'Estudar juntos' }} />
            <Stack.Screen name="configuracoes" options={{ title: 'Configurações' }} />
          </Stack>
        </AppProvider>
      </ProvedorBanco>
    </SafeAreaProvider>
  );
}
