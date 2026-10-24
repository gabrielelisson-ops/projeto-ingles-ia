/**
 * Revisão diária (repetição espaçada, SM-2).
 * Mostra os cartões vencidos: palavras das aulas, frases que você errou e erros
 * corrigidos pelo professor. Você diz o quanto lembrou e o app agenda a próxima revisão.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as repo from '../dados/repositorio';
import { useApp } from '../estado/AppContext';
import type { Qualidade } from '../logica/sm2';
import { falar, pararFala } from '../voz/falar';
import { Aviso, Botao, Cartao, Linha, Paragrafo, Tela, Titulo } from '../ui/base';
import { cores } from '../ui/tema';
import { segundosDesde, useInicio } from '../ui/useInicio';

const BOTOES: { q: Qualidade; titulo: string; tipo: 'perigo' | 'secundario' | 'primario' }[] = [
  { q: 1, titulo: '😣 Errei', tipo: 'perigo' },
  { q: 3, titulo: '😐 Difícil', tipo: 'secundario' },
  { q: 4, titulo: '🙂 Bom', tipo: 'secundario' },
  { q: 5, titulo: '😄 Fácil', tipo: 'primario' },
];

const ROTULO: Record<repo.ItemRevisao['tipo'], string> = {
  palavra: 'Palavra: lembra o significado?',
  frase: 'Frase que você errou: lembra o sentido?',
  erro: 'Erro corrigido: leia a forma certa em voz alta',
};

export default function Revisao() {
  const { db, perfil, prefs, nivel } = useApp();
  const [fila, setFila] = useState<repo.CartaoSalvo[] | null>(null);
  const [mostrar, setMostrar] = useState(false);
  const [feitos, setFeitos] = useState({ total: 0, lembrou: 0 });
  const inicio = useInicio();

  useEffect(() => {
    if (!perfil) return;
    repo.revisaoVencida(db, perfil.id).then(setFila);
    return () => pararFala();
  }, [db, perfil]);

  if (!perfil || !fila) return <Tela>{null}</Tela>;
  const cartao = fila[0];

  async function responder(q: Qualidade) {
    if (!perfil || !cartao) return;
    await repo.responderRevisao(db, perfil.id, cartao, q);
    const novoFeitos = { total: feitos.total + 1, lembrou: feitos.lembrou + (q >= 3 ? 1 : 0) };
    setFeitos(novoFeitos);
    setMostrar(false);
    // Errou: o cartão volta para o fim da fila de hoje.
    const resto = fila!.slice(1);
    const nova = q < 3 ? [...resto, cartao] : resto;
    setFila(nova);
    if (nova.length === 0) await repo.registrarAtividade(db, perfil.id, { segundosEstudo: segundosDesde(inicio) });
  }

  if (!cartao) {
    return (
      <Tela>
        <Titulo>🔁 Revisão do dia</Titulo>
        {feitos.total === 0 ? (
          <Aviso tipo="sucesso" texto="Nada para revisar agora. As palavras das aulas e os seus erros aparecem aqui nos dias certos." />
        ) : (
          <Aviso tipo="sucesso" texto={`Revisão concluída! ${feitos.total} cartão(ões) revisados. Volte amanhã.`} />
        )}
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo>🔁 Revisão do dia</Titulo>
      <Paragrafo suave>Faltam {fila.length} cartão(ões).</Paragrafo>
      <Cartao style={{ alignItems: 'center' }}>
        <Paragrafo suave>{ROTULO[cartao.tipo]}</Paragrafo>
        {!!cartao.emoji && <Text style={st.emoji}>{cartao.emoji}</Text>}
        <Text style={st.frente}>{cartao.frente}</Text>
        <Botao tipo="secundario" titulo="🔊 Ouvir" onPress={() => falar(cartao.frente, { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade })} />
        {mostrar ? (
          <Text style={st.verso}>{cartao.verso || '(sem explicação)'}</Text>
        ) : (
          <Botao titulo="Mostrar resposta" onPress={() => setMostrar(true)} />
        )}
      </Cartao>
      {mostrar && (
        <>
          <Paragrafo>Quanto você lembrou?</Paragrafo>
          <Linha>
            {BOTOES.map((b) => (
              <Botao key={b.q} tipo={b.tipo} titulo={b.titulo} onPress={() => responder(b.q)} style={{ flexGrow: 1 }} />
            ))}
          </Linha>
          <Paragrafo suave>“Errei” traz o cartão de novo hoje e amanhã. “Fácil” deixa ele mais tempo sem aparecer.</Paragrafo>
        </>
      )}
    </Tela>
  );
}

const st = StyleSheet.create({
  emoji: { fontSize: 56 },
  frente: { fontSize: 26, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  verso: { fontSize: 20, color: cores.primaria, textAlign: 'center' },
});
