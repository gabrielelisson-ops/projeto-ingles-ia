/**
 * Conversa livre (id "livre") ou roleplay (id do roleplays.json), no nível atual do aluno.
 * O professor lembra os erros frequentes do perfil e os retoma na conversa.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import type { Conversa } from '../../conteudo/schema';
import { useApp } from '../../estado/AppContext';
import { Aviso, Botao, Cartao, Paragrafo, Subtitulo, Tela } from '../../ui/base';
import { ConversaProfessor, type FimConversa } from '../../ui/ConversaProfessor';
import { cores } from '../../ui/tema';

const LIVRE: Conversa = {
  situacao_pt:
    'Converse sobre o que quiser: trabalho, família, viagens, filmes, futebol, planos… Se travar, use “Me dá uma dica” ou fale em português que o professor ajuda.',
  papel_professor:
    'Conversa livre e natural. Deixe o aluno escolher o assunto; se ele não escolher, sugira um tema do dia a dia ou do trabalho dele. Faça perguntas abertas e mostre interesse.',
  abertura: 'Hi! It’s good to see you. What would you like to talk about today?',
  abertura_pt: 'Oi! Que bom te ver. Sobre o que você gostaria de conversar hoje?',
};

export default function TelaConversa() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { curso, nivel } = useApp();
  const [fim, setFim] = useState<FimConversa | null>(null);
  const roleplay = curso.roleplays.find((r) => r.id === id);
  const conversa = id === 'livre' ? LIVRE : roleplay;

  if (!conversa) {
    return (
      <Tela>
        <Aviso tipo="erro" texto="Conversa não encontrada." />
      </Tela>
    );
  }
  const titulo = roleplay ? `${roleplay.emoji} ${roleplay.titulo_pt}` : '💬 Conversa livre';

  return (
    <Tela>
      <Stack.Screen options={{ title: titulo }} />
      {!fim ? (
        <ConversaProfessor
          conversa={conversa}
          nivel={nivel}
          atividade={roleplay ? `roleplay: ${roleplay.titulo_pt}` : 'conversa livre'}
          tema={roleplay ? roleplay.titulo_pt : 'assunto livre escolhido pelo aluno'}
          vocabulario={[]}
          gramatica={`gramática esperada para o nível ${nivel}`}
          minTurnos={1}
          onConcluir={setFim}
        />
      ) : (
        <>
          <Subtitulo>Resumo da conversa</Subtitulo>
          <Cartao>
            <Paragrafo>
              Você falou {fim.turnos} vez(es){fim.segundosFala > 0 ? `, por cerca de ${Math.max(1, Math.round(fim.segundosFala / 60))} minuto(s)` : ''}.
            </Paragrafo>
            {fim.correcoes.length === 0 ? (
              <Paragrafo>Nenhuma correção. Muito bem! 🌟</Paragrafo>
            ) : (
              <>
                <Paragrafo>Correções para lembrar (já foram para a memória do professor):</Paragrafo>
                {fim.correcoes.map((c, i) => (
                  <Paragrafo key={i}>
                    • <Text style={{ color: cores.erro, textDecorationLine: 'line-through' }}>{c.errado}</Text> →{' '}
                    <Text style={{ color: cores.sucesso, fontWeight: '700' }}>{c.certo}</Text>
                  </Paragrafo>
                ))}
              </>
            )}
          </Cartao>
          <Botao titulo="Conversar de novo" onPress={() => setFim(null)} />
          <Botao tipo="texto" titulo="Voltar" onPress={() => router.back()} />
        </>
      )}
    </Tela>
  );
}

