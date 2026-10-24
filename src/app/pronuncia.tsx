/**
 * Treino de pronúncia: o app mostra uma frase das aulas já feitas, você ouve o
 * modelo, lê em voz alta e vê quais palavras o reconhecimento de voz entendeu.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { aulasConcluidas } from '../conteudo/curso';
import * as repo from '../dados/repositorio';
import { useApp } from '../estado/AppContext';
import { embaralhar } from '../logica/estatisticas';
import { compararPronuncia, type ResultadoPronuncia } from '../logica/pronuncia';
import { falar } from '../voz/falar';
import { Aviso, Botao, Cartao, Linha, Paragrafo, Tela, Titulo } from '../ui/base';
import { BotaoFalar } from '../ui/BotaoFalar';
import { cores, espaco } from '../ui/tema';

type Frase = { en: string; pt: string };

export default function Pronuncia() {
  const { curso, progresso, prefs, nivel, db, perfil } = useApp();
  const [frases] = useState<Frase[]>(() => {
    const feitas = aulasConcluidas(curso, progresso.aulasConcluidas);
    // Sem aulas feitas ainda: usa as frases da primeira aula.
    const fonte = feitas.length ? feitas : curso.unidades[0]?.aulas.slice(0, 1) ?? [];
    const todas = fonte.flatMap((a) => [
      ...a.gramatica.exemplos,
      ...a.vocabulario.map((v) => ({ en: v.exemplo_en, pt: v.exemplo_pt })),
    ]);
    return embaralhar(todas, Date.now() % 100000).slice(0, 10);
  });
  const [i, setI] = useState(0);
  const [resultado, setResultado] = useState<ResultadoPronuncia | null>(null);
  const [ouvido, setOuvido] = useState('');
  const frase = frases[i];

  if (!frase) {
    return (
      <Tela>
        <Aviso tipo="info" texto="Ainda não há frases para treinar." />
      </Tela>
    );
  }

  const ouvir = (devagar = false) => falar(frase.en, { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade, devagar });

  return (
    <Tela>
      <Titulo>🎙️ Pronúncia</Titulo>
      <Paragrafo suave>
        Frase {i + 1} de {frases.length}. Ouça o modelo, depois segure o botão e leia em voz alta.
      </Paragrafo>
      <Cartao>
        {resultado ? (
          <View style={st.linha}>
            {resultado.palavras.map((p, k) => (
              <Text key={k} style={[st.palavra, { color: p.ok ? cores.sucesso : cores.erro, textDecorationLine: p.ok ? 'none' : 'underline' }]}>
                {p.texto}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={st.frase}>{frase.en}</Text>
        )}
        <Paragrafo suave>{frase.pt}</Paragrafo>
        <Linha>
          <Botao tipo="secundario" titulo="🔊 Ouvir" onPress={() => ouvir()} />
          <Botao tipo="secundario" titulo="🐢 Devagar" onPress={() => ouvir(true)} />
        </Linha>
      </Cartao>

      <BotaoFalar
        permitirDigitar={false}
        onTexto={(t, sg) => {
          setOuvido(t);
          setResultado(compararPronuncia(frase.en, t));
          if (perfil) void repo.registrarAtividade(db, perfil.id, { segundosFala: sg });
        }}
      />

      {resultado && (
        <Cartao>
          <Text style={[st.nota, { color: resultado.porcentagem >= 80 ? cores.sucesso : resultado.porcentagem >= 50 ? cores.aviso : cores.erro }]}>
            {resultado.porcentagem}%
          </Text>
          <Paragrafo>
            {resultado.porcentagem === 100
              ? 'Perfeito! Todas as palavras foram reconhecidas. 🌟'
              : `${resultado.acertos} de ${resultado.total} palavras reconhecidas. As sublinhadas em vermelho não foram entendidas: ouça o modelo e tente de novo.`}
          </Paragrafo>
          <Paragrafo suave>O celular entendeu: “{ouvido}”</Paragrafo>
          <Paragrafo suave>
            Lembrete: o reconhecimento de voz às vezes acerta mesmo com pronúncia imperfeita (ou erra por barulho). Use como um guia.
          </Paragrafo>
          <Linha>
            <Botao tipo="secundario" titulo="Tentar de novo" onPress={() => setResultado(null)} />
            <Botao
              titulo="Próxima frase ▶"
              onPress={() => {
                setResultado(null);
                setI((i + 1) % frases.length);
              }}
            />
          </Linha>
        </Cartao>
      )}
    </Tela>
  );
}

const st = StyleSheet.create({
  frase: { fontSize: 24, fontWeight: '700', color: cores.texto, lineHeight: 32 },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.p + 2 },
  palavra: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  nota: { fontSize: 44, fontWeight: '800' },
});
