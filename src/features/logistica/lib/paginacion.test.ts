import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pagina } from "../types";
import { usePaginacion } from "./paginacion";

function listado(
  paginas: string[][],
  { hayMas = false, cargando = false, fetchNextPage = vi.fn() } = {},
) {
  const pages: Pagina<string>[] = paginas.map((filas, i) => ({
    filas,
    hayMas: hayMas || i < paginas.length - 1,
    datosAl: "2026-10-04T12:00:00",
  }));
  return { data: { pages }, hasNextPage: hayMas, isFetchingNextPage: cargando, fetchNextPage };
}

describe("paginación por cursor", () => {
  it("muestra una página por vez y no acumula las anteriores", () => {
    const { result, rerender } = renderHook((q: ReturnType<typeof listado>) => usePaginacion(q), {
      initialProps: listado([["a", "b"]], { hayMas: true }),
    });
    expect(result.current.filas).toEqual(["a", "b"]);
    expect(result.current.pagina).toBe(1);
    expect(result.current.hayAnterior).toBe(false);
    expect(result.current.haySiguiente).toBe(true);

    rerender(listado([["a", "b"], ["c"]]));
    act(() => result.current.ir(2));
    expect(result.current.filas).toEqual(["c"]);
    expect(result.current.pagina).toBe(2);
    expect(result.current.haySiguiente).toBe(false);

    act(() => result.current.ir(1));
    expect(result.current.filas).toEqual(["a", "b"]);
  });

  it("pide al servidor la página que todavía no se trajo, una sola vez", () => {
    const fetchNextPage = vi.fn();
    const { result, rerender } = renderHook((q: ReturnType<typeof listado>) => usePaginacion(q), {
      initialProps: listado([["a"]], { hayMas: true, fetchNextPage }),
    });
    act(() => result.current.ir(2));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    // Mientras viaja la consulta se sigue viendo la página actual, no una vacía.
    expect(result.current.filas).toEqual(["a"]);

    rerender(listado([["a"], ["b"]], { cargando: true, fetchNextPage }));
    act(() => result.current.ir(3));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("vuelve a la primera cuando el listado se reinicia por un filtro nuevo", () => {
    const { result, rerender } = renderHook((q: ReturnType<typeof listado>) => usePaginacion(q), {
      initialProps: listado([["a"], ["b"], ["c"]]),
    });
    act(() => result.current.ir(3));
    expect(result.current.pagina).toBe(3);

    rerender(listado([["z"]], { hayMas: true }));
    expect(result.current.pagina).toBe(1);
    expect(result.current.filas).toEqual(["z"]);
    expect(result.current.hayAnterior).toBe(false);
  });
});
