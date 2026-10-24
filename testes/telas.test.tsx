/**
 * Testes de tela: renderiza os componentes de exercício e simula toques,
 * como um aluno faria. A voz e o estado do app são substituídos por versões falsas.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Exercicio as Ex } from '../src/conteudo/schema';
import { Exercicio, SequenciaExercicios } from '../src/ui/Exercicio';
import { embaralhar, sementeDeTexto } from '../src/logica/estatisticas';
import { palavrasParaOrdenar } from '../src/logica/respostas';

jest.mock('../src/voz/falar', () => ({ falar: jest.fn(async () => {}), pararFala: jest.fn() }));
jest.mock('../src/estado/AppContext', () => ({
  useApp: () => ({ prefs: { sotaque: 'en-US', ajusteVelocidade: 1 } }),
}));

const completar: Ex = { id: 'c1', tipo: 'completar', frase: 'I ___ Ana.', respostas: ['am'], explicacao_pt: 'I + am' };
const multipla: Ex = { id: 'm1', tipo: 'multipla', enunciado: 'Bom dia?', opcoes: ['Good night', 'Good morning'], correta: 1 };
const ordenar: Ex = { id: 'o1', tipo: 'ordenar', frase: 'Where are you from?' };

test('completar: resposta certa mostra "Muito bem" e a explicação', async () => {
  const onResponder = jest.fn();
  await render(<Exercicio ex={completar} nivel="A1" onResponder={onResponder} />);
  await fireEvent.changeText(screen.getByPlaceholderText('Palavra que falta'), ' AM ');
  await fireEvent.press(screen.getByText('Verificar'));
  expect(await screen.findByText(/Muito bem!/)).toBeTruthy();
  expect(screen.getByText(/I \+ am/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Continuar'));
  expect(onResponder).toHaveBeenCalledWith(expect.objectContaining({ acertou: true }));
});

test('múltipla escolha errada mostra a resposta certa', async () => {
  await render(<Exercicio ex={multipla} nivel="A1" onResponder={jest.fn()} />);
  await fireEvent.press(screen.getByText('Good night'));
  expect(await screen.findByText(/Resposta certa: Good morning/)).toBeTruthy();
});

test('ordenar: tocar as palavras na ordem certa acerta', async () => {
  const onResponder = jest.fn();
  await render(<Exercicio ex={ordenar} nivel="A1" onResponder={onResponder} />);
  // Confere que as palavras aparecem embaralhadas (ordem diferente da frase)
  const embaralhadas = embaralhar(palavrasParaOrdenar('Where are you from?'), sementeDeTexto('o1'));
  expect(embaralhadas.join(' ')).not.toBe('Where are you from');
  for (const p of ['Where', 'are', 'you', 'from']) await fireEvent.press(screen.getByText(p));
  await fireEvent.press(screen.getByText('Verificar'));
  await fireEvent.press(await screen.findByText('Continuar'));
  expect(onResponder).toHaveBeenCalledWith(expect.objectContaining({ acertou: true, resposta: 'Where are you from' }));
});

test('prova (sem feedback): avança direto e devolve todos os resultados no fim', async () => {
  const onFim = jest.fn();
  await render(<SequenciaExercicios lista={[multipla, completar]} nivel="A1" semFeedback onFim={onFim} />);
  expect(screen.getByText('Questão 1 de 2')).toBeTruthy();
  await fireEvent.press(screen.getByText('Good morning'));
  expect(screen.queryByText(/Muito bem/)).toBeNull();
  expect(await screen.findByText('Questão 2 de 2')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('Palavra que falta'), 'is');
  await fireEvent.press(screen.getByText('Verificar'));
  expect(onFim).toHaveBeenCalledTimes(1);
  const resultados = onFim.mock.calls[0][0];
  expect(resultados.map((r: { acertou: boolean }) => r.acertou)).toEqual([true, false]);
});
