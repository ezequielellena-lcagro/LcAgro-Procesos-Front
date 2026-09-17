import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { apiClient } from "@/lib/api-client";
import { planificacionKeys } from "./keys";
import { useGuardarPlan } from "./use-guardar-plan";

afterEach(() => vi.restoreAllMocks());

describe("guardado de plan e invalidación", () => {
  it("invalida todas las variantes de la grilla para no reabrir caché vieja al alternar filtros", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const normal = planificacionKeys.plan("2026-2027", undefined, false);
    const activos = planificacionKeys.plan("2026-2027", undefined, true);
    const contexto = planificacionKeys.contexto();
    client.setQueryData(normal, { filas: [] });
    client.setQueryData(activos, { filas: [] });
    client.setQueryData(contexto, { campaniaVigente: "2026-2027" });
    vi.spyOn(apiClient, "put").mockResolvedValue({ data: { guardados: [] } } as never);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result: consulta, rerender } = renderHook(
      ({ incluir }: { incluir: boolean }) =>
        useQuery({
          queryKey: incluir ? activos : normal,
          queryFn: () => new Promise<{ filas: never[] }>(() => {}),
          placeholderData: keepPreviousData,
          staleTime: Infinity,
        }),
      { initialProps: { incluir: false }, wrapper },
    );
    const { result } = renderHook(() => useGuardarPlan(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ campania: "2026-2027", request: { items: [] } });
    });
    expect(client.getQueryState(normal)?.isInvalidated).toBe(true);
    expect(client.getQueryState(activos)).toBeUndefined();
    expect(client.getQueryState(contexto)?.isInvalidated).toBe(false);
    rerender({ incluir: true });
    expect(consulta.current.isPlaceholderData).toBe(true);
    expect(consulta.current.data).toEqual({ filas: [] });
  });

  it("al volver del plan al consolidado pide los importes recalculados", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
    const clave = planificacionKeys.consolidado("2026-2027", undefined, undefined);
    client.setQueryData(clave, { campania: "2026-2027", mercadoUsd: 10 });
    vi.spyOn(apiClient, "put").mockResolvedValue({ data: { guardados: [] } } as never);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result: guardar } = renderHook(() => useGuardarPlan(), { wrapper });
    await act(async () => {
      await guardar.current.mutateAsync({ campania: "2026-2027", request: { items: [] } });
    });
    expect(client.getQueryState(clave)).toBeUndefined();
    const consultar = vi.fn().mockResolvedValue({ campania: "2026-2027", mercadoUsd: 20 });
    const { result: consolidado } = renderHook(() => useQuery({ queryKey: clave, queryFn: consultar, staleTime: Infinity }), { wrapper });
    await waitFor(() => expect(consolidado.current.data?.mercadoUsd).toBe(20));
    expect(consultar).toHaveBeenCalledTimes(1);
  });

  it("refresca el consolidado activo si el PUT termina después de abrir esa solapa", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
    const clave = planificacionKeys.consolidado("2026-2027", undefined, undefined);
    client.setQueryData(clave, { campania: "2026-2027", mercadoUsd: 10 });
    let completarGet: () => void = () => {};
    const consultar = vi.fn().mockImplementation(() => new Promise((resolver) => {
      completarGet = () => resolver({ campania: "2026-2027", mercadoUsd: 20 });
    }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    let completarPut: () => void = () => {};
    const put = vi.spyOn(apiClient, "put").mockImplementation(() => new Promise((resolver) => {
      completarPut = () => resolver({ data: { guardados: [] } } as never);
    }) as never);
    const { result: guardar } = renderHook(() => useGuardarPlan(), { wrapper });
    let pendiente!: Promise<unknown>;
    act(() => {
      pendiente = guardar.current.mutateAsync({ campania: "2026-2027", request: { items: [] } });
    });
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const { result: consolidado } = renderHook(() => useQuery({ queryKey: clave, queryFn: consultar, staleTime: Infinity }), { wrapper });
    expect(consolidado.current.data?.mercadoUsd).toBe(10);
    expect(consultar).not.toHaveBeenCalled();
    const descartarBorrador = vi.fn();
    void pendiente.then(descartarBorrador);
    act(() => completarPut());
    try {
      await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(descartarBorrador).toHaveBeenCalledTimes(1));
      expect(consolidado.current.data?.mercadoUsd).toBe(10);
    } finally {
      await act(async () => {
        completarGet();
        await pendiente;
      });
    }
    await waitFor(() => expect(consolidado.current.data?.mercadoUsd).toBe(20));
  });
});
