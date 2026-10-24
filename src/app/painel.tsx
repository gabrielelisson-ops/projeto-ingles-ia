/**
 * Painel do perfil: nível, % concluído, sequência de dias, minutos falados,
 * palavras aprendidas, notas das provas e pontos fracos.
 * (O painel completo de pontos fracos e o histórico de certificados vêm na Fase 3.)
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { acharProva } from '../conteudo/curso';
import * as repo from '../dados/repositorio';
import { useApp } from '../estado/AppContext';
import { percentualDoNivel } from '../logica/desbloqueio';
import { diaLocal, sequenciaDeDias } from '../logica/estatisticas';
import { NOMES_PARTES, type Parte } from '../logica/notas';
import { Cartao, Paragrafo, Subtitulo, Tela, Titulo } from '../ui/base';
import { dataCurta } from '../ui/formato';
import { cores, espaco } from '../ui/tema';

type Dados = {
  seq: number;
  minutosFala: number;
  minutosEstudo: number;
  palavras: number;
  revisaoHoje: number;
  tentativas: repo.TentativaSalva[];
  erros: repo.Correcao[];
};

export default function Painel() {
  const { db, perfil, progresso, estrutura, nivel, curso } = useApp();
  const [d, setD] = useState<Dados | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!perfil) return;
      (async () => {
        const at = await repo.resumoAtividade(db, perfil.id);
        const rev = await repo.contarRevisao(db, perfil.id);
        setD({
          seq: sequenciaDeDias(at.dias, diaLocal(Date.now())),
          minutosFala: Math.round(at.segundosFala / 60),
          minutosEstudo: Math.round(at.segundosEstudo / 60),
          palavras: await repo.contarPalavras(db, perfil.id),
          revisaoHoje: rev.vencidos,
          tentativas: await repo.listarTentativas(db, perfil.id),
          erros: await repo.errosFrequentes(db, perfil.id, 5),
        });
      })();
    }, [db, perfil]),
  );

  if (!perfil || !d) return <Tela>{null}</Tela>;
  const nivelEstr = estrutura.find((n) => n.nivel === nivel)!;

  // Pontos fracos: partes da prova que ficaram abaixo de 70 mais vezes.
  const contagem: Partial<Record<Parte, number>> = {};
  for (const t of d.tentativas) {
    const pf = (t.detalhes as { pontosFracos?: unknown })?.pontosFracos;
    if (Array.isArray(pf)) for (const p of pf) if (p in NOMES_PARTES) contagem[p as Parte] = (contagem[p as Parte] ?? 0) + 1;
  }
  const fracos = (Object.keys(contagem) as Parte[]).sort((a, b) => contagem[b]! - contagem[a]!);

  return (
    <Tela>
      <Titulo>{perfil.nome}</Titulo>
      <View style={st.grade}>
        <Numero valor={nivel} rotulo="nível atual" />
        <Numero valor={`${percentualDoNivel(nivelEstr, progresso)}%`} rotulo="do nível" />
        <Numero valor={`🔥 ${d.seq}`} rotulo="dias seguidos" />
        <Numero valor={String(d.minutosFala)} rotulo="minutos falados" />
        <Numero valor={String(d.palavras)} rotulo="palavras aprendidas" />
        <Numero valor={String(d.minutosEstudo)} rotulo="minutos de estudo" />
      </View>

      <Cartao>
        <Subtitulo>📝 Notas das provas</Subtitulo>
        {d.tentativas.length === 0 && <Paragrafo suave>Nenhuma prova feita ainda.</Paragrafo>}
        {d.tentativas.map((t) => (
          <Paragrafo key={t.id}>
            {t.aprovado ? '✅' : '❌'} {acharProva(curso, t.prova_id)?.prova.titulo ?? t.prova_id}: {t.nota} ({dataCurta(t.data)})
          </Paragrafo>
        ))}
      </Cartao>

      <Cartao>
        <Subtitulo>🎯 Pontos fracos</Subtitulo>
        {fracos.length === 0 && d.erros.length === 0 && <Paragrafo suave>Ainda não há dados suficientes.</Paragrafo>}
        {fracos.map((p) => (
          <Paragrafo key={p}>
            • {NOMES_PARTES[p]} (abaixo de 70 em {contagem[p]} prova{contagem[p] === 1 ? '' : 's'})
          </Paragrafo>
        ))}
        {d.erros.length > 0 && <Paragrafo suave>Erros que mais se repetem:</Paragrafo>}
        {d.erros.map((e, i) => (
          <Paragrafo key={i}>
            • <Text style={{ color: cores.erro, textDecorationLine: 'line-through' }}>{e.errado}</Text> →{' '}
            <Text style={{ color: cores.sucesso, fontWeight: '700' }}>{e.certo}</Text>
          </Paragrafo>
        ))}
      </Cartao>

      <Cartao>
        <Subtitulo>🔁 Revisão</Subtitulo>
        <Paragrafo>{d.revisaoHoje} item(ns) para revisar hoje. A tela de revisão diária chega na Fase 3.</Paragrafo>
      </Cartao>
    </Tela>
  );
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <View style={st.numero}>
      <Text style={st.valor}>{valor}</Text>
      <Text style={st.rotulo}>{rotulo}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.m },
  numero: { width: '47%', backgroundColor: cores.cartao, borderRadius: 14, padding: espaco.g, borderWidth: 1, borderColor: cores.borda },
  valor: { fontSize: 26, fontWeight: '800', color: cores.texto },
  rotulo: { fontSize: 14, color: cores.suave },
});
