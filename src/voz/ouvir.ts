/**
 * O celular ouvindo (voz → texto) com o reconhecimento de voz do Android, em inglês.
 * Uso: segurar o botão chama iniciar(); soltar chama parar(). O texto final
 * chega em onFinal, junto com quantos segundos o aluno falou.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { pararFala } from './falar';

const ERROS: Record<string, string> = {
  'not-allowed': 'O app precisa de permissão para usar o microfone. Libere em Configurações do Android › Apps › Inglês IA › Permissões.',
  'no-speech': 'Não ouvi nada. Segure o botão enquanto fala.',
  'speech-timeout': 'Não ouvi nada. Segure o botão enquanto fala.',
  network: 'O reconhecimento de voz precisa de internet neste celular.',
  'language-not-supported': 'Este celular não reconhece inglês. Instale o "Google" e o pacote de idioma inglês.',
  'service-not-allowed': 'O reconhecimento de voz está desligado. Instale ou ative o app "Google".',
  busy: 'O microfone está ocupado. Tente de novo.',
};

export function useReconhecimento(onFinal: (texto: string, segundos: number) => void) {
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const texto = useRef('');
  const inicio = useRef(0);
  const ativo = useRef(false);
  const soltou = useRef(false);
  const callback = useRef(onFinal);
  useEffect(() => {
    callback.current = onFinal;
  });

  useSpeechRecognitionEvent('result', (ev) => {
    const t = ev.results[0]?.transcript ?? '';
    texto.current = t;
    setParcial(t);
  });

  useSpeechRecognitionEvent('error', (ev) => {
    if (ev.error === 'aborted') return;
    setErro(ERROS[ev.error] ?? 'O reconhecimento de voz falhou. Tente de novo ou digite a resposta.');
  });

  useSpeechRecognitionEvent('end', () => {
    setOuvindo(false);
    if (!ativo.current) return;
    ativo.current = false;
    const final = texto.current.trim();
    const segundos = (Date.now() - inicio.current) / 1000;
    texto.current = '';
    setParcial('');
    if (final) callback.current(final, segundos);
  });

  const iniciar = useCallback(async () => {
    setErro(null);
    soltou.current = false;
    pararFala();
    const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!p.granted) {
      setErro(ERROS['not-allowed']!);
      return;
    }
    // O aluno soltou o botão antes de o microfone abrir.
    if (soltou.current) return;
    texto.current = '';
    inicio.current = Date.now();
    ativo.current = true;
    setOuvindo(true);
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      // Não para sozinho em pausas curtas: quem decide é o aluno, soltando o botão.
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 10000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 10000,
      },
    });
  }, []);

  const parar = useCallback(() => {
    soltou.current = true;
    if (ativo.current) ExpoSpeechRecognitionModule.stop();
  }, []);

  return { ouvindo, parcial, erro, iniciar, parar };
}
