/**
 * Estudar juntos: um roleplay a três no mesmo celular — dois alunos e o professor de IA.
 * Cada um fala na sua vez; o professor responde aos dois e corrige cada um pelo nome.
 * Os erros vão para a memória do perfil de quem errou, e o tempo falado para o perfil de quem falou.
 * O nível da conversa é o MENOR entre os dois (para ninguém ficar perdido).
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NIVEIS, type Nivel, type Roleplay } from '../conteudo/schema';
import * as repo from '../dados/repositorio';
import { useApp } from '../estado/AppContext';
import { ErroIA, MENSAGENS_ERRO } from '../ia/gemini';
import { falarComDupla, type FalaDupla } from '../ia/professor';
import { nivelAtual } from '../logica/desbloqueio';
import { falar, falarPortugues, pararFala } from '../voz/falar';
import { Aviso, Botao, Cartao, Linha, Paragrafo, Subtitulo, Tela, Titulo } from '../ui/base';
import { BotaoFalar } from '../ui/BotaoFalar';
import { cores, espaco, raio } from '../ui/tema';

type Fala = FalaDupla & { correcoes?: repo.Correcao[]; traducao?: string; dica?: string };

export default function Juntos() {
  const { curso, perfis, db, estrutura, chave, prefs } = useApp();
  const [ids, setIds] = useState<number[]>(() => perfis.slice(0, 2).map((p) => p.id));
  const [cena, setCena] = useState<Roleplay | null>(null);
  const [nivel, setNivel] = useState<Nivel>('A1');
  const [falas, setFalas] = useState<Fala[]>([]);
  const [vez, setVez] = useState<string>('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState<'traducao' | 'dica' | null>(null);
  const [fim, setFim] = useState(false);

  const dupla = ids.map((id) => perfis.find((p) => p.id === id)).filter((p): p is repo.Perfil => !!p);
  const nomes = dupla.map((p) => p.nome) as [string, string];
  const nomesIguais = dupla.length === 2 && nomes[0].trim().toLowerCase() === nomes[1].trim().toLowerCase();

  // Nível da conversa: o menor nível atual entre os dois perfis.
  useEffect(() => {
    if (dupla.length !== 2) return;
    (async () => {
      const niveis = await Promise.all(
        dupla.map(async (p) => {
          const inicial = (NIVEIS as readonly string[]).includes(p.nivel_inicial) ? (p.nivel_inicial as Nivel) : 'A1';
          return nivelAtual(estrutura, await repo.carregarProgresso(db, p.id), inicial);
        }),
      );
      setNivel(niveis.reduce((m, n) => (NIVEIS.indexOf(n) < NIVEIS.indexOf(m) ? n : m)));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), db, estrutura]);

  useEffect(() => () => pararFala(), []);

  const opcoesFala = { nivel, sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade };
  const perfilDe = (nome: string) => dupla.find((p) => p.nome === nome);
  const ultimaDoProfessor = [...falas].reverse().find((f) => !f.quem);

  function comecar(r: Roleplay) {
    setCena(r);
    setFalas([{ quem: null, texto: r.abertura, traducao: r.abertura_pt }]);
    setVez(nomes[0]);
    setFim(false);
    void falar(r.abertura, opcoesFala);
  }

  async function enviar(texto: string, segundos: number, base: Fala[] = falas) {
    if (!cena) return;
    const quem = vez;
    const p = perfilDe(quem);
    if (p && segundos > 0) void repo.registrarAtividade(db, p.id, { segundosFala: segundos });
    const historico: Fala[] = [...base, { quem, texto }];
    setFalas(historico);
    setCarregando(true);
    setErro(null);
    setMostrar(null);
    try {
      const r = await falarComDupla(chave, prefs.modelos, { nomes, nivel, situacao: cena.situacao_pt, papel: cena.papel_professor }, historico);
      // Cada correção fica pendurada na última fala de quem errou.
      const comCorrecoes = historico.map((f) => ({ ...f }));
      for (const c of r.correcoes) {
        const alvo = [...comCorrecoes].reverse().find((f) => f.quem === c.aluno);
        if (alvo) alvo.correcoes = [...(alvo.correcoes ?? []), c];
        const pe = perfilDe(c.aluno);
        if (pe) await repo.registrarErros(db, pe.id, [c]);
      }
      setFalas([...comCorrecoes, { quem: null, texto: r.resposta, traducao: r.traducao_pt, dica: r.dica }]);
      setVez(r.proximo);
      void falar(r.resposta, opcoesFala);
    } catch (e) {
      setErro(e instanceof ErroIA ? e.message : MENSAGENS_ERRO.rede);
    } finally {
      setCarregando(false);
    }
  }

  // ---------- Escolha da dupla e da situação ----------
  if (!cena) {
    return (
      <Tela>
        <Titulo>👫 Estudar juntos</Titulo>
        <Paragrafo>
          Vocês dois conversam com o professor no mesmo aparelho, um de cada vez. O professor corrige cada um pelo nome, e os erros vão para o
          perfil de quem errou.
        </Paragrafo>
        <Subtitulo>Quem vai participar?</Subtitulo>
        <Linha>
          {perfis.map((p) => {
            const marcado = ids.includes(p.id);
            return (
              <Botao
                key={p.id}
                tipo={marcado ? 'primario' : 'secundario'}
                titulo={`${marcado ? '✓ ' : ''}${p.nome}`}
                onPress={() => setIds(marcado ? ids.filter((i) => i !== p.id) : [...ids, p.id].slice(-2))}
              />
            );
          })}
        </Linha>
        {dupla.length !== 2 && <Aviso tipo="aviso" texto="Escolha exatamente duas pessoas." />}
        {nomesIguais && <Aviso tipo="aviso" texto="Os dois perfis têm o mesmo nome. Mude um deles em Configurações para o professor saber quem é quem." />}
        {!chave && <Aviso tipo="aviso" texto="Cadastre a chave da IA em Configurações para conversar com o professor." />}
        {dupla.length === 2 && <Paragrafo suave>Nível da conversa: {nivel} (o menor entre os dois).</Paragrafo>}
        <Subtitulo>Escolham a situação</Subtitulo>
        <View style={st.grade}>
          {curso.juntos.map((r) => (
            <Pressable
              key={r.id}
              disabled={dupla.length !== 2 || nomesIguais || !chave}
              style={({ pressed }) => [st.item, (dupla.length !== 2 || nomesIguais || !chave) && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
              onPress={() => comecar(r)}
            >
              <Text style={st.emoji}>{r.emoji}</Text>
              <Text style={st.nome}>{r.titulo_pt}</Text>
            </Pressable>
          ))}
        </View>
      </Tela>
    );
  }

  // ---------- Resumo ----------
  if (fim) {
    return (
      <Tela>
        <Titulo>Resumo da conversa</Titulo>
        {nomes.map((n) => {
          const minhas = falas.filter((f) => f.quem === n);
          const corr = minhas.flatMap((f) => f.correcoes ?? []);
          return (
            <Cartao key={n}>
              <Subtitulo>{n}</Subtitulo>
              <Paragrafo>Falou {minhas.length} vez(es).</Paragrafo>
              {corr.length === 0 ? (
                <Paragrafo>Nenhuma correção. Muito bem! 🌟</Paragrafo>
              ) : (
                corr.map((c, i) => (
                  <Paragrafo key={i}>
                    • <Text style={{ color: cores.erro, textDecorationLine: 'line-through' }}>{c.errado}</Text> →{' '}
                    <Text style={{ color: cores.sucesso, fontWeight: '700' }}>{c.certo}</Text>
                  </Paragrafo>
                ))
              )}
            </Cartao>
          );
        })}
        <Botao titulo="Outra situação" onPress={() => setCena(null)} />
        <Botao tipo="texto" titulo="Voltar" onPress={() => router.back()} />
      </Tela>
    );
  }

  // ---------- Conversa ----------
  return (
    <Tela>
      <Subtitulo>
        {cena.emoji} {cena.titulo_pt} · {nivel}
      </Subtitulo>
      <Aviso tipo="info" texto={cena.situacao_pt} />
      {falas.map((f, i) => (
        <View key={i} style={[st.balao, f.quem ? (f.quem === nomes[0] ? st.alunoA : st.alunoB) : st.professor]}>
          <Text style={st.quem}>{f.quem ?? 'Professor'}</Text>
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
          {falas.at(-1)?.quem && (
            <Botao
              titulo="Tentar de novo"
              onPress={() => {
                const ultima = falas.at(-1)!;
                setVez(ultima.quem!);
                void enviar(ultima.texto, 0, falas.slice(0, -1));
              }}
            />
          )}
        </Cartao>
      )}
      {ultimaDoProfessor && !carregando && (
        <Linha>
          <Botao tipo="secundario" titulo="🐢 Mais devagar" onPress={() => falar(ultimaDoProfessor.texto, { ...opcoesFala, devagar: true })} />
          <Botao
            tipo="secundario"
            titulo="❓ Não entendi"
            onPress={() => {
              setMostrar('traducao');
              if (ultimaDoProfessor.traducao) void falarPortugues(ultimaDoProfessor.traducao);
            }}
          />
          {!!ultimaDoProfessor.dica && <Botao tipo="secundario" titulo="💡 Dica" onPress={() => setMostrar('dica')} />}
        </Linha>
      )}
      {mostrar === 'traducao' && <Aviso tipo="info" texto={`Em português: ${ultimaDoProfessor?.traducao || 'tradução indisponível'}`} />}
      {mostrar === 'dica' && <Aviso tipo="info" texto={`Dica: ${ultimaDoProfessor?.dica}`} />}

      <View style={st.vez}>
        <Text style={st.vezTexto}>🎤 Vez de: {vez}</Text>
        <Linha>
          {nomes.map((n) => (
            <Pressable key={n} onPress={() => setVez(n)} style={[st.troca, vez === n && st.trocaAtiva]}>
              <Text style={{ color: vez === n ? '#fff' : cores.primaria, fontWeight: '700' }}>{n}</Text>
            </Pressable>
          ))}
        </Linha>
      </View>
      <BotaoFalar onTexto={(t, s) => void enviar(t, s)} desativado={carregando} />
      <Botao tipo="texto" titulo="Encerrar e ver o resumo" desativado={carregando} onPress={() => { pararFala(); setFim(true); }} />
    </Tela>
  );
}

const st = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.m },
  item: { width: '47%', backgroundColor: cores.cartao, borderRadius: raio, padding: espaco.g, borderWidth: 1, borderColor: cores.borda, alignItems: 'center', gap: 6 },
  emoji: { fontSize: 36 },
  nome: { fontSize: 15, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  balao: { padding: espaco.m, borderRadius: raio, maxWidth: '92%', gap: 4 },
  professor: { backgroundColor: '#fff', borderWidth: 1, borderColor: cores.borda, alignSelf: 'flex-start' },
  alunoA: { backgroundColor: cores.primariaClara, alignSelf: 'flex-end' },
  alunoB: { backgroundColor: cores.avisoClaro, alignSelf: 'flex-end' },
  quem: { fontSize: 12, fontWeight: '700', color: cores.suave },
  texto: { fontSize: 17, lineHeight: 24, color: cores.texto },
  correcao: { marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: '#fff' },
  errado: { color: cores.erro, textDecorationLine: 'line-through', fontSize: 15 },
  certo: { color: cores.sucesso, fontWeight: '700', fontSize: 15 },
  explica: { color: cores.suave, fontSize: 14 },
  vez: { alignItems: 'center', gap: espaco.p },
  vezTexto: { fontSize: 18, fontWeight: '700', color: cores.texto },
  troca: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 2, borderColor: cores.primaria },
  trocaAtiva: { backgroundColor: cores.primaria },
});
