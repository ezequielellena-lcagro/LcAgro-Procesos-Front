import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
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
});
