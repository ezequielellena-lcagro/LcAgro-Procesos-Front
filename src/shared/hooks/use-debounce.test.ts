import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./use-debounce";

/**
 * El caso que motiva este hook: el buscador de Proveedores mandaba el texto directo al `queryKey`,
 * así que cada tecla disparaba una agregación completa sobre `moviprov1` (34.500 movimientos) contra
 * la base de PRODUCCIÓN del cliente. Escribir "RIZOBACTER" eran ~10 barridos.
 */
describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("devuelve el valor inicial sin esperar", () => {
    const { result } = renderHook(() => useDebounce("adama", 300));

    expect(result.current).toBe("adama");
  });

  it("no propaga el valor nuevo hasta que pasa el retardo", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "" },
    });

    rerender({ v: "riz" });
    expect(result.current).toBe("");

    act(() => void vi.advanceTimersByTime(299));
    expect(result.current).toBe("");

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe("riz");
  });

  it("tipear seguido propaga UNA sola vez, con el último valor", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "" },
    });

    // Simula tipeo: cada tecla llega antes de que venza el retardo de la anterior.
    for (const parcial of ["r", "ri", "riz", "rizo", "rizob"]) {
      rerender({ v: parcial });
      act(() => void vi.advanceTimersByTime(100));
    }

    // Ningún valor intermedio se propagó: los 5 rerenders no dispararon ni una actualización.
    expect(result.current).toBe("");

    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe("rizob");
  });

  it("borrar el campo también se debouncea (no vuelve al listado completo por cada backspace)", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "rizob" },
    });

    rerender({ v: "" });
    expect(result.current).toBe("rizob");

    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe("");
  });

  it("desmontar antes de que venza el retardo no deja el timer colgado", () => {
    const { unmount } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "riz" },
    });

    unmount();

    // Si el efecto no limpiara su timer, este avance intentaría setear estado en un hook desmontado.
    expect(() => act(() => void vi.advanceTimersByTime(300))).not.toThrow();
  });
});
