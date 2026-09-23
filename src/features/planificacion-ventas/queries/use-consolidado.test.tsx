import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { apiClient } from "@/lib/api-client";
import { useConsolidado } from "./use-consolidado";

const adapterOriginal = apiClient.defaults.adapter;
afterEach(() => {
  apiClient.defaults.adapter = adapterOriginal;
});

/** Devuelve la URL que axios arma de verdad (params ya serializados) para esa selección. */
async function urlDe(vendedorIds: number[]): Promise<string> {
  let uri = "";
  apiClient.defaults.adapter = (async (config) => {
    uri = apiClient.getUri(config);
    return { data: {}, status: 200, statusText: "OK", headers: {}, config };
  }) as typeof adapterOriginal;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  renderHook(() => useConsolidado("2026-2027", vendedorIds, undefined, true), { wrapper });
  await waitFor(() => expect(uri).not.toBe(""));
  return uri;
}

describe("query del consolidado", () => {
  it("manda una clave `vendedorId` por vendedor elegido, sin índices", async () => {
    const uri = await urlDe([3, 7]);
    expect(uri).toContain("vendedorId=3&vendedorId=7");
    // `vendedorId[]=3` o `vendedorId[0]=3` no los bindea el controlador: quedaría filtrando por uno.
    expect(uri).not.toContain("%5B");
  });

  it("sin selección no manda la clave: son todas las carteras del alcance", async () => {
    expect(await urlDe([])).not.toContain("vendedorId");
  });
});
