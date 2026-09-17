import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { apiClient } from "@/lib/api-client";
import { planificacionKeys } from "./keys";
import { useGuardarMarketShare } from "./use-market-share";

afterEach(() => vi.restoreAllMocks());

describe("Market Share y derivados", () => {
  it("PUT invalida Market Share, Plan y Consolidado sin esperar GET derivados", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const actual = planificacionKeys.marketShare("2026-2027");
    const anterior = planificacionKeys.marketShare("2025-2026");
    const planActivo = planificacionKeys.plan("2026-2027", 1, false);
    const planInactivo = planificacionKeys.plan("2026-2027", 1, true);
    const consolidadoActivo = planificacionKeys.consolidado("2026-2027", 1, undefined);
    const consolidadoInactivo = planificacionKeys.consolidado("2026-2027", 2, undefined);
    for (const clave of [
      actual,
      anterior,
      planActivo,
      planInactivo,
      consolidadoActivo,
      consolidadoInactivo,
    ])
      client.setQueryData(clave, { mercadoUsd: 10 });

    const resolverGet: (() => void)[] = [];
    const consultar = vi.fn(
      () =>
        new Promise<{ mercadoUsd: number }>((resolve) => {
          resolverGet.push(() => resolve({ mercadoUsd: 20 }));
        }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result: mercado } = renderHook(
      () => useQuery({ queryKey: actual, queryFn: consultar, staleTime: Infinity }),
      { wrapper },
    );
    const { result: plan } = renderHook(
      () => useQuery({ queryKey: planActivo, queryFn: consultar, staleTime: Infinity }),
      { wrapper },
    );
    const { result: consolidado } = renderHook(
      () => useQuery({ queryKey: consolidadoActivo, queryFn: consultar, staleTime: Infinity }),
      { wrapper },
    );
    vi.spyOn(apiClient, "put").mockResolvedValue({ data: { cultivos: [] } } as never);
    const { result: guardar } = renderHook(() => useGuardarMarketShare(), { wrapper });
    await act(async () => {
      await guardar.current.mutateAsync({
        campania: "2026-2027",
        request: {
          cultivos: [
            {
              cultivo: "soja",
              qqInsumoHa: 10,
              precioUsdTn: 325,
              rindeTnHa: 4,
              revisionEsperada: 1,
            },
          ],
        },
      });
    });
    await waitFor(() => expect(guardar.current.isSuccess).toBe(true));
    expect(client.getQueryState(actual)?.isInvalidated).toBe(true);
    expect(client.getQueryState(anterior)).toBeUndefined();
    expect(client.getQueryState(planInactivo)).toBeUndefined();
    expect(client.getQueryState(consolidadoInactivo)).toBeUndefined();
    expect(mercado.current.data?.mercadoUsd).toBe(10);
    expect(plan.current.data?.mercadoUsd).toBe(10);
    expect(consolidado.current.data?.mercadoUsd).toBe(10);
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
    await act(async () => resolverGet.forEach((resolve) => resolve()));
    await waitFor(() => expect(plan.current.data?.mercadoUsd).toBe(20));
    await waitFor(() => expect(consolidado.current.data?.mercadoUsd).toBe(20));
  });
});
