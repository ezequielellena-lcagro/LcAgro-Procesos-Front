import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { planificacionKeys } from "./keys";
import { useGuardarVendedor } from "./use-vendedores";

afterEach(() => vi.restoreAllMocks());

describe("cambios de catálogo de vendedores", () => {
  it("PUT no reenvía un código quitado del vendedor", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const put = vi.spyOn(apiClient, "put").mockResolvedValue({ data: { id: 3 } } as never);
    const { result } = renderHook(() => useGuardarVendedor(), { wrapper });
    const request = {
      nombre: "Vendedor A", sucursalId: 1, viajantes: [10], usuarioId: null, activo: true,
    };
    await act(async () => {
      await result.current.mutateAsync({ id: 3, request });
    });
    expect(put).toHaveBeenCalledWith("/planificacion-ventas/vendedores/3", request);
  });

  it("invalida control y listas activas sin esperar sus GET; elimina variantes inactivas", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const control = planificacionKeys.controlPadron("2026-2027");
    const otroControl = planificacionKeys.controlPadron("2025-2026");
    const viajantes = planificacionKeys.viajantes();
    const usuarios = planificacionKeys.usuariosAsignables();
    const vendedores = planificacionKeys.vendedores();
    for (const key of [control, otroControl, viajantes, usuarios, vendedores]) {
      client.setQueryData(key, { previo: true });
    }
    const consultar = vi.fn(() => new Promise<{ previo: boolean }>(() => {}));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    for (const key of [control, viajantes, usuarios]) {
      renderHook(() => useQuery({ queryKey: key, queryFn: consultar, staleTime: Infinity }),
        { wrapper });
    }
    vi.spyOn(apiClient, "post").mockResolvedValue({ data: { id: 1 } } as never);
    const { result } = renderHook(() => useGuardarVendedor(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        request: {
          nombre: "Vendedor de prueba", sucursalId: 1, viajantes: [10],
          usuarioId: null, activo: true,
        },
      });
    });

    expect(client.getQueryState(control)?.isInvalidated).toBe(true);
    expect(client.getQueryState(viajantes)?.isInvalidated).toBe(true);
    expect(client.getQueryState(usuarios)?.isInvalidated).toBe(true);
    expect(client.getQueryState(otroControl)).toBeUndefined();
    expect(client.getQueryState(vendedores)).toBeUndefined();
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(3));
  });
});
