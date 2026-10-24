import { formatarHora, interpretarHora } from '../src/logica/hora';

test('horário do lembrete', () => {
  expect(interpretarHora('07:30')).toEqual({ hora: 7, minuto: 30 });
  expect(interpretarHora('7:05')).toEqual({ hora: 7, minuto: 5 });
  expect(interpretarHora('20h15')).toEqual({ hora: 20, minuto: 15 });
  expect(interpretarHora('24:00')).toBeNull();
  expect(interpretarHora('12:60')).toBeNull();
  expect(interpretarHora('meio-dia')).toBeNull();
  expect(formatarHora(7, 5)).toBe('07:05');
});
