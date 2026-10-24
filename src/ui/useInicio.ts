import { useEffect, useRef } from 'react';

/** Guarda o momento em que a tela abriu (para medir o tempo de estudo). */
export function useInicio() {
  const inicio = useRef(0);
  useEffect(() => {
    inicio.current = Date.now();
  }, []);
  return inicio;
}

/** Segundos passados desde que a tela abriu. Use só em ações (ex.: ao concluir). */
export function segundosDesde(inicio: { current: number }) {
  return inicio.current ? (Date.now() - inicio.current) / 1000 : 0;
}
