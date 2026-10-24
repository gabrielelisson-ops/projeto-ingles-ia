/**
 * Configurações: chave da IA, voz (sotaque e velocidade), modelos da IA,
 * nomes dos perfis e erros nos arquivos de conteúdo.
 */
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, TextInput } from 'react-native';
import * as repo from '../dados/repositorio';
import { MODELO_VALIDO, useApp } from '../estado/AppContext';
import { apagarChave, mascararChave, salvarChave } from '../ia/chave';
import { ErroIA } from '../ia/gemini';
import { MODELOS_PADRAO, testarChave } from '../ia/professor';
import { falar } from '../voz/falar';
import { Aviso, Botao, Cartao, Linha, Paragrafo, Subtitulo, Tela } from '../ui/base';
import { cores, espaco, raio } from '../ui/tema';

export default function Configuracoes() {
  const { chave, recarregarChave, prefs, salvarPrefs, perfis, db, recarregar, curso } = useApp();
  const [novaChave, setNovaChave] = useState('');
  const [msgChave, setMsgChave] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [testando, setTestando] = useState(false);
  const [nomes, setNomes] = useState<Record<number, string>>({});
  const [msgPerfil, setMsgPerfil] = useState<string | null>(null);
  const [mc, setMc] = useState(prefs.modelos.conversa);
  const [ma, setMa] = useState(prefs.modelos.avaliacao);
  const [msgModelo, setMsgModelo] = useState<string | null>(null);

  useEffect(() => setNomes(Object.fromEntries(perfis.map((p) => [p.id, p.nome]))), [perfis]);

  async function guardar() {
    try {
      await salvarChave(novaChave);
      setNovaChave('');
      await recarregarChave();
      setMsgChave({ tipo: 'sucesso', texto: 'Chave salva com segurança neste celular. Toque em "Testar chave".' });
    } catch (e) {
      setMsgChave({ tipo: 'erro', texto: (e as Error).message });
    }
  }

  async function testar() {
    setTestando(true);
    setMsgChave(null);
    try {
      const ok = await testarChave(chave, prefs.modelos);
      setMsgChave({ tipo: 'sucesso', texto: `Tudo certo! Os modelos ${ok} responderam.` });
    } catch (e) {
      setMsgChave({ tipo: 'erro', texto: e instanceof ErroIA ? e.message : 'Não foi possível testar agora.' });
    } finally {
      setTestando(false);
    }
  }

  const ouvirExemplo = () => falar('Hello! Nice to meet you. How are you today?', { nivel: 'B1', sotaque: prefs.sotaque, ajuste: prefs.ajusteVelocidade });

  return (
    <Tela>
      <Cartao>
        <Subtitulo>🔑 Chave da IA (Google AI Studio)</Subtitulo>
        <Paragrafo>{chave ? `Chave cadastrada: ${mascararChave(chave)}` : 'Nenhuma chave cadastrada.'}</Paragrafo>
        <Paragrafo suave>
          A chave fica guardada no cofre criptografado do celular. Ela não vai para o backup e não aparece em nenhum outro lugar.
        </Paragrafo>
        <TextInput
          style={st.entrada}
          value={novaChave}
          onChangeText={setNovaChave}
          placeholder="Cole a chave aqui"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Linha>
          <Botao titulo="Salvar chave" onPress={guardar} desativado={!novaChave.trim()} />
          {!!chave && <Botao tipo="secundario" titulo="Testar chave" onPress={testar} carregando={testando} />}
        </Linha>
        {msgChave && <Aviso tipo={msgChave.tipo} texto={msgChave.texto} />}
        <Botao tipo="texto" titulo="Abrir o Google AI Studio para criar a chave" onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} />
        {!!chave && (
          <Botao
            tipo="texto"
            titulo="Apagar a chave deste celular"
            onPress={async () => {
              await apagarChave();
              await recarregarChave();
              setMsgChave({ tipo: 'sucesso', texto: 'Chave apagada.' });
            }}
          />
        )}
      </Cartao>

      <Cartao>
        <Subtitulo>🔊 Voz do professor</Subtitulo>
        <Linha>
          <Botao tipo={prefs.sotaque === 'en-US' ? 'primario' : 'secundario'} titulo="🇺🇸 Americano" onPress={() => salvarPrefs({ sotaque: 'en-US' })} />
          <Botao tipo={prefs.sotaque === 'en-GB' ? 'primario' : 'secundario'} titulo="🇬🇧 Britânico" onPress={() => salvarPrefs({ sotaque: 'en-GB' })} />
        </Linha>
        <Paragrafo>Velocidade: {Math.round(prefs.ajusteVelocidade * 100)}% (o nível já ajusta: A1 fala mais devagar)</Paragrafo>
        <Linha>
          <Botao tipo="secundario" titulo="− Mais devagar" desativado={prefs.ajusteVelocidade <= 0.6} onPress={() => salvarPrefs({ ajusteVelocidade: Math.round((prefs.ajusteVelocidade - 0.1) * 10) / 10 })} />
          <Botao tipo="secundario" titulo="+ Mais rápido" desativado={prefs.ajusteVelocidade >= 1.4} onPress={() => salvarPrefs({ ajusteVelocidade: Math.round((prefs.ajusteVelocidade + 0.1) * 10) / 10 })} />
        </Linha>
        <Botao tipo="texto" titulo="▶️ Ouvir exemplo" onPress={ouvirExemplo} />
        <Paragrafo suave>
          Se o sotaque britânico soar americano, instale a voz em: Configurações do Android › Sistema › Idiomas › Saída de texto para fala › Google › Instalar dados de voz › English (United Kingdom).
        </Paragrafo>
      </Cartao>

      <Cartao>
        <Subtitulo>👤 Perfis</Subtitulo>
        {perfis.map((p) => (
          <Linha key={p.id}>
            <TextInput
              style={[st.entrada, { flex: 1 }]}
              value={nomes[p.id] ?? ''}
              onChangeText={(t) => setNomes({ ...nomes, [p.id]: t })}
              maxLength={repo.NOME_MAX}
            />
            <Botao
              tipo="secundario"
              titulo="Salvar"
              desativado={(nomes[p.id] ?? '') === p.nome}
              onPress={async () => {
                try {
                  await repo.renomearPerfil(db, p.id, nomes[p.id] ?? '');
                  await recarregar();
                  setMsgPerfil('Nome salvo.');
                } catch (e) {
                  setMsgPerfil((e as Error).message);
                }
              }}
            />
          </Linha>
        ))}
        {msgPerfil && <Paragrafo suave>{msgPerfil}</Paragrafo>}
      </Cartao>

      <Cartao>
        <Subtitulo>🤖 Modelos da IA (avançado)</Subtitulo>
        <Paragrafo suave>
          Só mude se o Google trocar os nomes dos modelos. Conversa: muitas chamadas por dia (use o modelo com limite grátis maior). Avaliação: poucas chamadas, precisa ser mais caprichada.
        </Paragrafo>
        <Paragrafo>Conversa</Paragrafo>
        <TextInput style={st.entrada} value={mc} onChangeText={setMc} autoCapitalize="none" autoCorrect={false} />
        <Paragrafo>Avaliação das provas</Paragrafo>
        <TextInput style={st.entrada} value={ma} onChangeText={setMa} autoCapitalize="none" autoCorrect={false} />
        <Linha>
          <Botao
            tipo="secundario"
            titulo="Salvar modelos"
            onPress={async () => {
              if (!MODELO_VALIDO.test(mc.trim()) || !MODELO_VALIDO.test(ma.trim())) return setMsgModelo('Nome de modelo inválido.');
              await salvarPrefs({ modelos: { conversa: mc.trim(), avaliacao: ma.trim() } });
              setMsgModelo('Modelos salvos.');
            }}
          />
          <Botao
            tipo="texto"
            titulo="Restaurar padrão"
            onPress={async () => {
              setMc(MODELOS_PADRAO.conversa);
              setMa(MODELOS_PADRAO.avaliacao);
              await salvarPrefs({ modelos: MODELOS_PADRAO });
              setMsgModelo('Padrão restaurado.');
            }}
          />
        </Linha>
        {msgModelo && <Paragrafo suave>{msgModelo}</Paragrafo>}
      </Cartao>

      <Cartao>
        <Subtitulo>📚 Conteúdo</Subtitulo>
        <Paragrafo>
          {curso.unidades.length} unidade(s) carregada(s) de {curso.curriculo.niveis.length * 8} planejadas.
        </Paragrafo>
        {curso.erros.length === 0 ? (
          <Aviso tipo="sucesso" texto="Todos os arquivos de conteúdo estão no formato certo." />
        ) : (
          curso.erros.slice(0, 20).map((e, i) => <Aviso key={i} tipo="erro" texto={e} />)
        )}
      </Cartao>

      <Cartao>
        <Subtitulo>🔒 Privacidade</Subtitulo>
        <Paragrafo suave>
          Seu progresso fica só neste celular. Para a IA vão apenas: o nome do perfil, o nível, o tema da aula, o que você fala nas conversas e
          provas, e seus erros frequentes. No plano grátis, o Google pode usar essas conversas para melhorar os produtos dele: evite falar de
          assuntos pessoais sensíveis.
        </Paragrafo>
      </Cartao>
    </Tela>
  );
}

const st = StyleSheet.create({
  entrada: { borderWidth: 2, borderColor: cores.borda, borderRadius: raio, padding: espaco.m, fontSize: 16, backgroundColor: '#fff', color: cores.texto },
});
