/**
 * Painel do perfil: nível, % concluído, sequência de dias, minutos falados,
 * palavras aprendidas, notas das provas e pontos fracos.
 * Também lista os certificados de nível e gera o PDF de cada um.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { acharProva } from '../conteudo/curso';
import * as repo from '../dados/repositorio';
import { useApp } from '../estado/AppContext';
import { percentualDoNivel } from '../logica/desbloqueio';
import { diaLocal, sequenciaDeDias } from '../logica/estatisticas';
import { calcularPontosFracos, type PontosFracos } from '../logica/pontosFracos';
import { Aviso, Botao, Cartao, Paragrafo, Subtitulo, Tela, Titulo } from '../ui/base';
import { compartilharCertificado } from '../ui/certificado';
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
  aulas: { aula_id: string; acertos: number }[];
};

export default function Painel() {
  const { db, perfil, progresso, estrutura, nivel, curso } = useApp();
  const [d, setD] = useState<Dados | null>(null);
  const [msgPdf, setMsgPdf] = useState<string | null>(null);

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
          aulas: await repo.listarAulasFeitas(db, perfil.id),
        });
      })();
    }, [db, perfil]),
  );

  if (!perfil || !d) return <Tela>{null}</Tela>;
  const nivelEstr = estrutura.find((n) => n.nivel === nivel)!;

  const fracos: PontosFracos = calcularPontosFracos(curso, d.tentativas, d.aulas);

  // Certificados: a primeira aprovação em cada prova final (a lista vem da mais nova para a mais antiga).
  const certificados = new Map<string, repo.TentativaSalva>();
  for (const t of d.tentativas) {
    const p = acharProva(curso, t.prova_id);
    if (t.aprovado && p?.final) certificados.set(p.prova.nivel, t);
  }

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
        {fracos.habilidades.length === 0 && fracos.gramatica.length === 0 && d.erros.length === 0 && (
          <Paragrafo suave>Ainda não há dados suficientes. Faça aulas e provas para ver seus pontos fracos aqui.</Paragrafo>
        )}
        {fracos.habilidades.length > 0 && <Paragrafo suave>Habilidades (média nas provas):</Paragrafo>}
        {fracos.habilidades.map((h) => (
          <View key={h.parte} style={st.barraLinha}>
            <Text style={st.barraNome}>
              {h.fraca ? '⚠️' : '✅'} {h.nome}
            </Text>
            <View style={st.barraFundo}>
              <View style={[st.barraCheia, { width: `${h.media}%`, backgroundColor: h.fraca ? cores.erro : cores.sucesso }]} />
            </View>
            <Text style={st.barraValor}>{h.media}</Text>
          </View>
        ))}
        {fracos.gramatica.length > 0 && <Paragrafo suave>Gramática para revisar:</Paragrafo>}
        {fracos.gramatica.map((g) => (
          <Paragrafo key={g.tema}>
            • <Text style={{ fontWeight: '700' }}>{g.tema}</Text> — {g.motivo}
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
        <Subtitulo>🎓 Certificados</Subtitulo>
        {certificados.size === 0 && <Paragrafo suave>Passe na prova final de um nível para ganhar o certificado.</Paragrafo>}
        {[...certificados.entries()].map(([nv, t]) => (
          <Botao
            key={nv}
            tipo="secundario"
            titulo={`📄 ${nv} — nota ${t.nota} (${dataCurta(t.data)})`}
            onPress={async () => {
              setMsgPdf(null);
              try {
                const nomeNivel = curso.curriculo.niveis.find((n) => n.nivel === nv)?.nome_pt ?? nv;
                await compartilharCertificado({ nome: perfil.nome, nivel: nv as typeof nivel, nomeNivel, nota: t.nota, data: t.data });
              } catch (e) {
                setMsgPdf((e as Error).message || 'Não foi possível gerar o PDF.');
              }
            }}
          />
        ))}
        {msgPdf && <Aviso tipo="erro" texto={msgPdf} />}
      </Cartao>

      <Cartao>
        <Subtitulo>🔁 Revisão</Subtitulo>
        <Paragrafo>{d.revisaoHoje} item(ns) para revisar hoje.</Paragrafo>
        <Botao tipo="secundario" titulo="Revisar agora" onPress={() => router.push('/revisao')} />
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
  barraLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  barraNome: { width: 150, fontSize: 15, color: cores.texto },
  barraFundo: { flex: 1, height: 10, borderRadius: 5, backgroundColor: cores.borda, overflow: 'hidden' },
  barraCheia: { height: 10 },
  barraValor: { width: 32, textAlign: 'right', fontWeight: '700', color: cores.texto },
});
