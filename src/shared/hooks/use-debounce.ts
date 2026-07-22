import { useEffect, useState } from "react";

/**
 * Retrasa la propagación de un valor hasta que deja de cambiar por `retardoMs`.
 *
 * Para qué: los filtros de texto viajan dentro del `queryKey` de TanStack Query, así que **cada tecla
 * es un request**. En pantallas que consultan MacroGest eso no es un detalle de UX: el buscador de
 * Proveedores dispara una agregación completa sobre `moviprov1` (~34.500 movimientos de la zona)
 * contra la base de PRODUCCIÓN del cliente, y encima el texto se filtra en memoria en el backend, o
 * sea que no acota la consulta. Escribir "RIZOBACTER" eran ~10 barridos; con debounce es uno.
 *
 * Se usa para el valor que alimenta la query, no para el `value` del input: el campo tiene que seguir
 * respondiendo a cada tecla, lo que se retrasa es la consulta.
 */
export function useDebounce<T>(valor: T, retardoMs = 300): T {
  const [debounced, setDebounced] = useState(valor);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(valor), retardoMs);
    // Cada cambio cancela el timer anterior: por eso tipear seguido propaga una sola vez, el último
    // valor. La limpieza cubre también el desmontaje (no queda un setState sobre un hook muerto).
    return () => clearTimeout(timer);
  }, [valor, retardoMs]);

  return debounced;
}
