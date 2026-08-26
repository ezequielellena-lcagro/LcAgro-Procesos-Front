import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarMatrizSegmentacion } from "../api";
import type {
  GuardadoMatrizSegmentacionDto,
  MatrizSegmentacionDto,
  MatrizSegmentacionRequest,
  TableroPlanificacionDto,
} from "../types";
import { planificacionKeys } from "./keys";
import { useGuardarMatrizSegmentacion } from "./use-segmentacion";

vi.mock("../api", () => ({
  guardarMatrizSegmentacion: vi.fn(),
  listarSegmentacion: vi.fn(),
  obtenerMatrizSegmentacion: vi.fn(),
  previsualizarMatrizSegmentacion: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function contenedor(queryClient: QueryClient) {
  return function Contenedor({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("guardado de matriz en caché", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no mezcla una matriz nueva con scores y resúmenes del snapshot anterior", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const filtros = { campania: "2025-2026", page: 1 };
    const matrizAnterior = { campania: filtros.campania, revision: 1 } as MatrizSegmentacionDto;
    const matrizNueva = { campania: filtros.campania, revision: 2 } as MatrizSegmentacionDto;
    const tableroAnterior = {
      campania: filtros.campania,
      matriz: matrizAnterior,
      items: [{ score: 10 }],
    } as TableroPlanificacionDto;
    const request = {
      campania: filtros.campania,
      revisionEsperada: 1,
      criterios: [],
    } satisfies MatrizSegmentacionRequest;
    const respuesta = {
      matriz: matrizNueva,
      sinCambios: false,
      impacto: {},
    } as GuardadoMatrizSegmentacionDto;
    queryClient.setQueryData(planificacionKeys.tablero(filtros), tableroAnterior);
    vi.mocked(guardarMatrizSegmentacion).mockResolvedValue(respuesta);
    const { result } = renderHook(() => useGuardarMatrizSegmentacion(), {
      wrapper: contenedor(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(request);
    });

    expect(queryClient.getQueryData(planificacionKeys.tablero(filtros))).toBe(tableroAnterior);
    expect(queryClient.getQueryData(planificacionKeys.matriz(filtros.campania))).toBe(matrizNueva);
  });
});
