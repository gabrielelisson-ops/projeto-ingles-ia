/**
 * Conversa com a API do Google Gemini (Google AI Studio).
 *
 * - A chave vai só no cabeçalho da requisição, nunca na URL nem em logs.
 * - A resposta é sempre JSON e passa por validação (Zod) antes de ser usada.
 * - Se o limite grátis do modelo principal acabar (erro 429), tenta o reserva.
 */
import type { z } from 'zod';

export const MODELO_CONVERSA_PADRAO = 'gemini-flash-lite-latest';
export const MODELO_AVALIACAO_PADRAO = 'gemini-flash-latest';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const TEMPO_LIMITE_MS = 30_000;

export type TipoErroIA = 'sem_chave' | 'chave_invalida' | 'limite' | 'modelo' | 'indisponivel' | 'rede' | 'resposta_invalida' | 'bloqueado';

export class ErroIA extends Error {
  constructor(
    public tipo: TipoErroIA,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const MENSAGENS_ERRO: Record<TipoErroIA, string> = {
  sem_chave: 'Falta a chave da IA. Vá em Configurações e cole sua chave do Google AI Studio.',
  chave_invalida: 'A chave da IA não foi aceita. Confira em Configurações se ela foi colada inteira.',
  limite: 'O limite grátis de hoje da IA acabou. Ele volta amanhã (por volta das 4h–5h da manhã no Brasil).',
  modelo: 'O modelo da IA não foi encontrado (o Google pode ter mudado o nome). Em Configurações › Modelos, toque em "Restaurar padrão" ou informe o nome novo.',
  indisponivel: 'A IA do Google está sobrecarregada agora. Espere um minuto e tente de novo.',
  rede: 'Sem conexão com a IA. Confira a internet e tente de novo.',
  resposta_invalida: 'A IA respondeu de um jeito inesperado. Tente de novo.',
  bloqueado: 'A IA recusou responder a esta mensagem. Tente falar de outro jeito.',
};

export type Mensagem = { papel: 'aluno' | 'professor'; texto: string };

export type PedidoIA<T> = {
  chave: string;
  modelos: string[];
  sistema: string;
  mensagens: Mensagem[];
  schema: z.ZodType<T>;
  temperatura?: number;
  /** Permite trocar o fetch nos testes. */
  fetchFn?: typeof fetch;
};

/** Remove ``` do começo/fim caso o modelo devolva o JSON dentro de bloco de código. */
export function extrairJSON(texto: string): unknown {
  const limpo = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(limpo);
}

async function chamar<T>(p: PedidoIA<T>, modelo: string): Promise<T> {
  const f = p.fetchFn ?? fetch;
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  let resp: Response;
  try {
    resp = await f(URL_BASE + encodeURIComponent(modelo) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.chave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.sistema }] },
        contents: p.mensagens.map((m) => ({
          role: m.papel === 'aluno' ? 'user' : 'model',
          parts: [{ text: m.texto }],
        })),
        generationConfig: { responseMimeType: 'application/json', temperature: p.temperatura ?? 0.7 },
      }),
      signal: controle.signal,
    });
  } catch {
    throw new ErroIA('rede', MENSAGENS_ERRO.rede);
  } finally {
    clearTimeout(timer);
  }

  if (resp.status === 429) throw new ErroIA('limite', MENSAGENS_ERRO.limite);
  if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
    // 400 também acontece com chave errada no Gemini; o corpo diz qual é.
    const corpo = await resp.text().catch(() => '');
    if (resp.status !== 400 || /api[_ ]?key/i.test(corpo)) throw new ErroIA('chave_invalida', MENSAGENS_ERRO.chave_invalida);
    throw new ErroIA('resposta_invalida', MENSAGENS_ERRO.resposta_invalida);
  }
  if (resp.status === 404) throw new ErroIA('modelo', MENSAGENS_ERRO.modelo);
  if (resp.status >= 500) throw new ErroIA('indisponivel', MENSAGENS_ERRO.indisponivel);
  if (!resp.ok) throw new ErroIA('rede', MENSAGENS_ERRO.rede);

  const dados = (await resp.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  } | null;
  if (dados?.promptFeedback?.blockReason) throw new ErroIA('bloqueado', MENSAGENS_ERRO.bloqueado);
  const texto = dados?.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('') ?? '';
  if (!texto) throw new ErroIA('resposta_invalida', MENSAGENS_ERRO.resposta_invalida);

  let json: unknown;
  try {
    json = extrairJSON(texto);
  } catch {
    throw new ErroIA('resposta_invalida', MENSAGENS_ERRO.resposta_invalida);
  }
  const r = p.schema.safeParse(json);
  if (!r.success) throw new ErroIA('resposta_invalida', MENSAGENS_ERRO.resposta_invalida);
  return r.data;
}

/**
 * Faz o pedido: tenta cada modelo da lista se o anterior estiver sem limite,
 * e repete uma vez se a resposta vier fora do formato.
 */
export async function pedirJSON<T>(p: PedidoIA<T>): Promise<T> {
  if (!p.chave) throw new ErroIA('sem_chave', MENSAGENS_ERRO.sem_chave);
  let ultimo: unknown = null;
  for (const modelo of p.modelos) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        return await chamar(p, modelo);
      } catch (e) {
        ultimo = e;
        if (!(e instanceof ErroIA)) throw e;
        if (e.tipo === 'resposta_invalida' && tentativa === 0) continue;
        // Sem limite, modelo inexistente ou sobrecarregado: tenta o próximo modelo.
        if (e.tipo === 'limite' || e.tipo === 'modelo' || e.tipo === 'indisponivel') break;
        throw e;
      }
    }
  }
  throw ultimo instanceof ErroIA ? ultimo : new ErroIA('rede', MENSAGENS_ERRO.rede);
}
