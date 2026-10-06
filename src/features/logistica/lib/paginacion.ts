import { useState } from "react";
import type { Pagina } from "../types";

/** Lo que la paginación necesita de un `useListado`; no ata el componente a react-query. */
interface Listado<T> {
  data?: { pages: Pagina<T>[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}

export interface EstadoPaginacion {
  /** Página que se esta viendo, base 1. */
  pagina: number;
  filasVisibles: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
  cargando: boolean;
  /** Mueve a esa página (base 1); si todavía no se trajo, la pide. */
  ir: (pagina: number) => void;
}

/**
 * Convierte el scroll infinito de `useListado` en páginas de ida y vuelta.
 *
 * Los listados de Logística paginan por cursor (keyset): el servidor devuelve un tramo y si hay
 * más, nada de cuántos faltan. Por eso no hay "página 3 de 12" como en las pantallas con `total`;
 * lo que sí se puede es mostrar UN tramo por vez y volver a los ya traídos, que es lo que la
 * gente espera de una tabla. Acumular todo en una sola lista infinita dejaba 300 filas colgando
 * abajo de los filtros.
 */
export function usePaginacion<T>(q: Listado<T>): EstadoPaginacion & { filas: T[] } {
  const [pedida, setPedida] = useState(1);
  const paginas = q.data?.pages ?? [];
  // El recorte va en el render y no en un efecto: cuando cambia un filtro, react-query vuelve a
  // una sola página y un efecto pintaría una página vacía antes de corregir el índice.
  const indice = Math.min(pedida, Math.max(paginas.length, 1)) - 1;
  const filas = paginas[indice]?.filas ?? [];
  return {
    filas,
    pagina: indice + 1,
    filasVisibles: filas.length,
    hayAnterior: indice > 0,
    haySiguiente: indice + 1 < paginas.length || q.hasNextPage,
    cargando: q.isFetchingNextPage,
    ir: (destino) => {
      if (destino < 1) return;
      if (destino > paginas.length) {
        if (!q.hasNextPage || q.isFetchingNextPage) return;
        q.fetchNextPage();
      }
      setPedida(destino);
    },
  };
}
