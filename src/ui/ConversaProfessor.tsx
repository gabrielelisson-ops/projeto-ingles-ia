/**
 * Conversa por voz com o professor de IA.
 * Mostra a transcrição, destaca os erros com a forma correta e tem os
 * botões "Repetir mais devagar", "Não entendi" e "Me dá uma dica".
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Conversa, Nivel } from '../conteudo/schema';
import * as repo from '../dados/repositorio';
import { useApp } from '../estado/AppContext';
import { ErroIA, MENSAGENS_ERRO, type Mensagem } from '../ia/gemini';
import { falarComProfessor } from '../ia/professor';
import { falar, falarPortugues, pararFala } from '../voz/falar';
import { Aviso, Botao, Cartao, Linha, Paragrafo } from './base';
import { BotaoFalar } from './BotaoFalar';
import { cores, espaco, raio } from './tema';

type Fala = Mensagem & {
  traducao?: string;
  dica?: string;
  correcoes?: repo.Correcao[];
};

export type FimConversa = { segundosFala: number; correcoes: repo.Correcao[]; turnos: number };

export function ConversaProfessor({
  conversa,
  nivel,
  atividade,
  tema,
  vocabulario,
  gramatica,
  minTurnos,
  onConcluir,
}: {
  conversa: Conversa;
  nivel: Nivel;
  atividade: string;
  tema: string;
  vocabulario: string[];
  gramatica: string;
  minTurnos: number;
  onConcluir: (r: FimConversa) => void;
}) {
  const { db, perfil, chave, prefs } = useApp();
  const [falas, setFalas] = useState<Fala[]>([{ papel: 'professor', texto: conversa.abertura, traducao: conversa.abertura_pt }]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState<'traducao' | 'dica' | null>(null);
  const segundos = useRef(0);
  const correcoes = useRef<repo.Correcao[]>([]);
  const ultimoTexto = useRef<string | null>(null);

  const opcoes = { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade };
  const turnos = falas.filter((f) => f.papel === 'aluno').length;
  const ultimaDoProfessor = [...falas].reverse().find((f) => f.papel === 'professor');

  useEffect(() => {
    void falar(conversa.abertura, opcoes);
    return () => pararFala();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(texto: string, segFala: number, historicoBase: Fala[] = falas) {
    if (!perfil) return;
    segundos.current += segFala;
    if (segFala > 0) void repo.registrarAtividade(db, perfil.id, { segundosFala: segFala });
    const historico: Fala[] = [...historicoBase, { papel: 'aluno', texto }];
    setFalas(historico);
    setErro(null);
    setMostrar(null);
    setCarregando(true);
    ultimoTexto.current = texto;
    try {
      const erros = await repo.errosFrequentes(db, perfil.id);
      const r = await falarComProfessor(
        chave,
        prefs.modelos,
        { nome: perfil.nome, nivel, atividade, tema, vocabulario, gramatica, papel: conversa.papel_professor, errosAnteriores: erros },
        historico.map(({ papel, texto: t }) => ({ papel, texto: t })),
      );
      ultimoTexto.current = null;
      // A correção fica "pendurada" na fala do aluno que tinha o erro.
      const comCorrecao = historico.map((f, i) => (i === historico.length - 1 ? { ...f, correcoes: r.correcoes } : f));
      setFalas([...comCorrecao, { papel: 'professor', texto: r.resposta, traducao: r.traducao_pt, dica: r.dica }]);
      correcoes.current.push(...r.correcoes);
      await repo.registrarErros(db, perfil.id, r.correcoes);
      void falar(r.resposta, opcoes);
    } catch (e) {
      setErro(e instanceof ErroIA ? e.message : MENSAGENS_ERRO.rede);
    } finally {
      setCarregando(false);
    }
  }

  const tentarDeNovo = () => {
    const t = ultimoTexto.current;
    if (!t) return;
    const semUltima = falas.slice(0, -1);
    void enviar(t, 0, semUltima);
  };

  return (
    <View style={{ gap: espaco.m }}>
      <Aviso tipo="info" texto={conversa.situacao_pt} />
      {!chave && (
        <Cartao>
          <Aviso tipo="aviso" texto="Para conversar com o professor de IA, cadastre a chave da IA em Configurações." />
          <Linha>
            <Botao titulo="Abrir Configurações" onPress={() => router.push('/configuracoes')} />
            <Botao tipo="texto" titulo="Pular esta etapa" onPress={() => onConcluir({ segundosFala: 0, correcoes: [], turnos: 0 })} />
          </Linha>
        </Cartao>
      )}

      {falas.map((f, i) => (
        <View key={i} style={[st.balao, f.papel === 'aluno' ? st.aluno : st.professor]}>
          <Text style={st.quem}>{f.papel === 'aluno' ? 'Você' : 'Professor'}</Text>
          <Text style={st.texto}>{f.texto}</Text>
          {f.correcoes?.map((c, j) => (
            <View key={j} style={st.correcao}>
              <Text style={st.errado}>✗ {c.errado}</Text>
              <Text style={st.certo}>✓ {c.certo}</Text>
              {!!c.explicacao_pt && <Text style={st.explica}>{c.explicacao_pt}</Text>}
            </View>
          ))}
        </View>
      ))}

      {carregando && <Paragrafo suave>O professor está pensando…</Paragrafo>}
      {erro && (
        <Cartao>
          <Aviso tipo="erro" texto={erro} />
          <Linha>
            {ultimoTexto.current && <Botao titulo="Tentar de novo" onPress={tentarDeNovo} />}
            <Botao tipo="texto" titulo="Pular esta etapa" onPress={() => onConcluir({ segundosFala: segundos.current, correcoes: correcoes.current, turnos })} />
          </Linha>
        </Cartao>
      )}

      {ultimaDoProfessor && !carregando && (
        <Linha>
          <Botao tipo="secundario" titulo="🐢 Repetir mais devagar" onPress={() => falar(ultimaDoProfessor.texto, { ...opcoes, devagar: true })} />
          <Botao
            tipo="secundario"
            titulo="❓ Não entendi"
            onPress={() => {
              setMostrar('traducao');
              if (ultimaDoProfessor.traducao) void falarPortugues(ultimaDoProfessor.traducao);
            }}
          />
          {!!ultimaDoProfessor.dica && <Botao tipo="secundario" titulo="💡 Me dá uma dica" onPress={() => setMostrar('dica')} />}
        </Linha>
      )}
      {mostrar === 'traducao' && <Aviso tipo="info" texto={`Em português: ${ultimaDoProfessor?.traducao || 'tradução indisponível'}`} />}
      {mostrar === 'dica' && <Aviso tipo="info" texto={`Dica: ${ultimaDoProfessor?.dica}`} />}

      {!!chave && <BotaoFalar onTexto={(t, s) => void enviar(t, s)} desativado={carregando} />}

      <Botao
        tipo={turnos >= minTurnos ? 'primario' : 'texto'}
        titulo={turnos >= minTurnos ? 'Concluir conversa ✓' : `Fale pelo menos ${minTurnos - turnos} vez(es) para concluir`}
        desativado={turnos < minTurnos || carregando}
        onPress={() => {
          pararFala();
          onConcluir({ segundosFala: segundos.current, correcoes: correcoes.current, turnos });
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  balao: { padding: espaco.m, borderRadius: raio, maxWidth: '92%', gap: 4 },
  professor: { backgroundColor: '#fff', borderWidth: 1, borderColor: cores.borda, alignSelf: 'flex-start' },
  aluno: { backgroundColor: cores.primariaClara, alignSelf: 'flex-end' },
  quem: { fontSize: 12, fontWeight: '700', color: cores.suave },
  texto: { fontSize: 17, lineHeight: 24, color: cores.texto },
  correcao: { marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: '#fff' },
  errado: { color: cores.erro, textDecorationLine: 'line-through', fontSize: 15 },
  certo: { color: cores.sucesso, fontWeight: '700', fontSize: 15 },
  explica: { color: cores.suave, fontSize: 14 },
});
