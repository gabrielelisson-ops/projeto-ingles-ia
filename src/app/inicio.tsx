/** Trilha do curso: resumo do perfil, botão "Continuar" e lista de unidades. */
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../estado/AppContext';
import * as repo from '../dados/repositorio';
import { estadoDe, percentualDoNivel, proximoItem, type Status } from '../logica/desbloqueio';
import { diaLocal, sequenciaDeDias } from '../logica/estatisticas';
import { BarraProgresso, Botao, Cartao, Linha, Paragrafo, Subtitulo, Tela, Titulo } from '../ui/base';
import { quando } from '../ui/formato';
import { cores, espaco, raio } from '../ui/tema';

const ICONE: Record<Status['estado'], string> = {
  concluida: '✅',
  disponivel: '▶️',
  aguardando: '⏳',
  bloqueada: '🔒',
  em_breve: '🕓',
};

export default function Inicio() {
  const app = useApp();
  const { perfil, curso, estrutura, status, progresso, nivel, db, recarregar } = app;
  const [seq, setSeq] = useState(0);
  const [revisar, setRevisar] = useState(0);
  const [aberto, setAberto] = useState<string>(nivel);

  useFocusEffect(
    useCallback(() => {
      void recarregar();
      if (perfil) repo.resumoAtividade(db, perfil.id).then((r) => setSeq(sequenciaDeDias(r.dias, diaLocal(Date.now()))));
      if (perfil) repo.contarRevisao(db, perfil.id).then((r) => setRevisar(r.vencidos));
    }, [perfil?.id]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!perfil) {
    return (
      <Tela>
        <Paragrafo>Escolha um perfil primeiro.</Paragrafo>
        <Botao titulo="Escolher perfil" onPress={() => router.replace('/')} />
      </Tela>
    );
  }

  const proximo = proximoItem(estrutura, status);
  const nivelEstr = estrutura.find((n) => n.nivel === nivel)!;
  const abrir = (tipo: 'aula' | 'prova' | 'final', id: string) => router.push(tipo === 'aula' ? `/aula/${id}` : `/prova/${id}`);

  const tituloItem = (tipo: string, id: string) => {
    if (tipo !== 'aula') return tipo === 'final' ? 'Prova final do nível' : 'Prova da unidade';
    for (const u of curso.unidades) {
      const a = u.aulas.find((x) => x.id === id);
      if (a) return `Unidade ${u.numero} · Aula ${a.numero}: ${a.titulo}`;
    }
    return id;
  };

  return (
    <Tela>
      <Titulo>Olá, {perfil.nome}! 👋</Titulo>
      <Cartao>
        <Linha style={{ justifyContent: 'space-between' }}>
          <Subtitulo>Nível {nivel}</Subtitulo>
          <Text style={st.seq}>🔥 {seq} dia{seq === 1 ? '' : 's'} seguido{seq === 1 ? '' : 's'}</Text>
        </Linha>
        <BarraProgresso valor={percentualDoNivel(nivelEstr, progresso)} />
        <Paragrafo suave>{percentualDoNivel(nivelEstr, progresso)}% do nível concluído</Paragrafo>
        {proximo ? (
          <>
            <Paragrafo>Próximo: {tituloItem(proximo.tipo, proximo.id)}</Paragrafo>
            {estadoDe(status, proximo.id).estado === 'aguardando' ? (
              <Paragrafo suave>⏳ Nova tentativa liberada em {quando(estadoDe(status, proximo.id).liberaEm!)}</Paragrafo>
            ) : (
              <Botao titulo="Continuar ▶" onPress={() => abrir(proximo.tipo, proximo.id)} />
            )}
          </>
        ) : (
          <Paragrafo>Você concluiu todo o conteúdo disponível. Novas unidades chegam nas próximas fases! 🎉</Paragrafo>
        )}
      </Cartao>

      <Linha>
        <Botao tipo="secundario" titulo="🗣️ Praticar" onPress={() => router.push('/praticar')} style={{ flex: 1 }} />
        <Botao
          tipo={revisar > 0 ? 'primario' : 'secundario'}
          titulo={revisar > 0 ? `🔁 Revisão (${revisar})` : '🔁 Revisão'}
          onPress={() => router.push('/revisao')}
          style={{ flex: 1 }}
        />
      </Linha>
      <Linha>
        <Botao tipo="secundario" titulo="⚡ Teste do dia" onPress={() => router.push('/teste-do-dia')} style={{ flex: 1 }} />
        <Botao tipo="secundario" titulo="📊 Progresso" onPress={() => router.push('/painel')} style={{ flex: 1 }} />
      </Linha>

      {curso.curriculo.niveis.map((n) => {
        const est = estrutura.find((e) => e.nivel === n.nivel)!;
        return (
          <View key={n.nivel} style={{ gap: espaco.m }}>
            <Pressable onPress={() => setAberto(aberto === n.nivel ? '' : n.nivel)}>
              <Subtitulo>
                {aberto === n.nivel ? '▼' : '▶'} {n.nivel} — {n.nome_pt}
              </Subtitulo>
            </Pressable>
            {aberto === n.nivel &&
              n.unidades.map((cu) => {
                const u = curso.unidades.find((x) => x.nivel === n.nivel && x.numero === cu.numero);
                const eu = est.unidades.find((x) => x.numero === cu.numero)!;
                return (
                  <Cartao key={cu.numero}>
                    <Text style={st.unidade}>
                      Unidade {cu.numero}: {cu.tema_pt}
                    </Text>
                    <Paragrafo suave>{cu.gramatica_pt}</Paragrafo>
                    {!u && <Paragrafo suave>🕓 Em breve</Paragrafo>}
                    {u?.aulas.map((a) => {
                      const s = estadoDe(status, a.id);
                      const pode = s.estado === 'disponivel' || s.estado === 'concluida';
                      return (
                        <Pressable key={a.id} disabled={!pode} onPress={() => abrir('aula', a.id)} style={[st.item, !pode && st.itemOff]}>
                          <Text style={st.itemTexto}>
                            {ICONE[s.estado]} Aula {a.numero}: {a.titulo}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {u && eu.prova && (
                      <ItemProva status={estadoDe(status, eu.prova)} titulo="📝 Prova da unidade" onPress={() => abrir('prova', eu.prova!)} />
                    )}
                  </Cartao>
                );
              })}
            {aberto === n.nivel && est.provaFinal && (
              <ItemProva status={estadoDe(status, est.provaFinal)} titulo="🏆 Prova final do nível" onPress={() => abrir('final', est.provaFinal!)} />
            )}
          </View>
        );
      })}
      <Botao tipo="texto" titulo="Trocar de perfil" onPress={() => router.replace('/')} />
    </Tela>
  );
}

function ItemProva({ status, titulo, onPress }: { status: Status; titulo: string; onPress: () => void }) {
  const pode = status.estado === 'disponivel' || status.estado === 'concluida';
  return (
    <Pressable disabled={!pode} onPress={onPress} style={[st.item, st.prova, !pode && st.itemOff]}>
      <Text style={st.itemTexto}>
        {ICONE[status.estado]} {titulo}
        {status.estado === 'concluida' ? ' (aprovado)' : ''}
      </Text>
      {status.estado === 'aguardando' && <Text style={st.espera}>Nova tentativa em {quando(status.liberaEm!)}</Text>}
    </Pressable>
  );
}

const st = StyleSheet.create({
  seq: { fontSize: 16, fontWeight: '700', color: cores.aviso },
  unidade: { fontSize: 17, fontWeight: '700', color: cores.texto },
  item: { padding: espaco.m, borderRadius: raio - 4, backgroundColor: cores.fundo },
  itemOff: { opacity: 0.55 },
  prova: { backgroundColor: cores.avisoClaro },
  itemTexto: { fontSize: 16, color: cores.texto },
  espera: { fontSize: 14, color: cores.aviso, marginTop: 2 },
});
