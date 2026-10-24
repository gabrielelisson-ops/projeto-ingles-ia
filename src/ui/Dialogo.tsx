/**
 * Diálogo em áudio (duas vozes), com transcrição que pode ser mostrada ou escondida.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Fala, Nivel } from '../conteudo/schema';
import { useApp } from '../estado/AppContext';
import { falar, pararFala } from '../voz/falar';
import { Botao, Cartao, Linha, Paragrafo } from './base';
import { cores } from './tema';

export function Dialogo({
  falas,
  nivel,
  permitirTranscricao = true,
  maxReproducoes,
}: {
  falas: Fala[];
  nivel: Nivel;
  permitirTranscricao?: boolean;
  maxReproducoes?: number;
}) {
  const { prefs } = useApp();
  const [tocando, setTocando] = useState(false);
  const [vezes, setVezes] = useState(0);
  const [transcricao, setTranscricao] = useState(false);
  const [traducao, setTraducao] = useState(false);
  const cancelado = useRef(false);

  useEffect(
    () => () => {
      cancelado.current = true;
      pararFala();
    },
    [],
  );

  async function tocar(devagar = false) {
    cancelado.current = false;
    setTocando(true);
    setVezes((v) => v + 1);
    for (const f of falas) {
      if (cancelado.current) break;
      await falar(f.en, { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade, devagar, voz: f.voz });
    }
    setTocando(false);
  }

  const esgotou = maxReproducoes != null && vezes >= maxReproducoes;

  return (
    <Cartao>
      <Linha>
        {tocando ? (
          <Botao
            titulo="⏹ Parar"
            onPress={() => {
              cancelado.current = true;
              pararFala();
            }}
          />
        ) : (
          <>
            <Botao titulo={vezes ? '🔁 Ouvir de novo' : '▶️ Ouvir o diálogo'} desativado={esgotou} onPress={() => tocar()} />
            {permitirTranscricao && <Botao tipo="secundario" titulo="🐢 Devagar" desativado={esgotou} onPress={() => tocar(true)} />}
          </>
        )}
      </Linha>
      {maxReproducoes != null && (
        <Paragrafo suave>
          Você pode ouvir {maxReproducoes} vezes ({Math.max(0, maxReproducoes - vezes)} restante{maxReproducoes - vezes === 1 ? '' : 's'}).
        </Paragrafo>
      )}
      {permitirTranscricao && (
        <Linha>
          <Botao tipo="texto" titulo={transcricao ? 'Esconder transcrição' : 'Mostrar transcrição'} onPress={() => setTranscricao(!transcricao)} />
          {transcricao && <Botao tipo="texto" titulo={traducao ? 'Esconder tradução' : 'Mostrar tradução'} onPress={() => setTraducao(!traducao)} />}
        </Linha>
      )}
      {transcricao &&
        falas.map((f, i) => (
          <View key={i}>
            <Text style={st.fala}>
              <Text style={st.nome}>{f.personagem}: </Text>
              {f.en}
            </Text>
            {traducao && <Text style={st.pt}>{f.pt}</Text>}
          </View>
        ))}
    </Cartao>
  );
}

const st = StyleSheet.create({
  fala: { fontSize: 16, lineHeight: 23, color: cores.texto },
  nome: { fontWeight: '700' },
  pt: { fontSize: 14, color: cores.suave, marginBottom: 4 },
});
