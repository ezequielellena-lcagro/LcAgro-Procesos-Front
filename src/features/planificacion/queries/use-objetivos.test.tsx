import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { obtenerObjetivos, previsualizarObjetivos } from "../api";
import type { ObjetivosDto, ObjetivosRequest } from "../types";
import { planificacionKeys } from "./keys";
import { useObjetivos, usePrevisualizarObjetivos } from "./use-objetivos";

vi.mock("../api", () => ({
  acordarObjetivo: vi.fn(),
  guardarObjetivos: vi.fn(),
  obtenerObjetivos: vi.fn(),
  previsualizarObjetivos: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const request: ObjetivosRequest = {
  campania: "2025-2026",
  revisionEsperada: 3,
  modoReparto: "plano",
  lineas: [],
};

function crearCliente() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function contenedor(queryClient: QueryClient) {
  return function Contenedor({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function conflicto(): AxiosError {
  return new AxiosError("Conflict", "ERR_BAD_RESPONSE", undefined, undefined, {
    status: 409,
    statusText: "Conflict",
    data: {
      detail: "Los objetivos cambiaron desde que los consultaste. Actualizá los datos y reintentá.",
    },
    headers: {},
    config: {},
  } as AxiosResponse);
}

describe("queries de objetivos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no muestra una revisión vigente como placeholder de una consulta histórica", () => {
    const queryClient = crearCliente();
    const vigente = { campania: "2025-2026" };
    const historica = { campania: "2025-2026", vigenteEn: "2026-05-01T00:00:00Z" };
    const datoVigente = { campania: vigente.campania, revision: 3 } as ObjetivosDto;
    queryClient.setQueryData(planificacionKeys.objetivo(vigente), datoVigente);
    vi.mocked(obtenerObjetivos).mockImplementation(() => new Promise(() => undefined));

    const { result, rerender } = renderHook(({ consulta }) => useObjetivos(consulta), {
      wrapper: contenedor(queryClient),
      initialProps: { consulta: vigente },
    });

    expect(result.current.data).toBe(datoVigente);
    rerender({ consulta: historica });
    expect(result.current.data).toBeUndefined();
  });

  it("ante 409 refresca las lecturas vigentes y comunica que pudo recargarlas", async () => {
    const queryClient = crearCliente();
    const error = conflicto();
    vi.mocked(previsualizarObjetivos).mockRejectedValue(error);
    const invalidar = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const { result } = renderHook(() => usePrevisualizarObjetivos(), {
      wrapper: contenedor(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(request)).rejects.toBe(error);
    });

    expect(invalidar).toHaveBeenCalledWith(
      { queryKey: planificacionKeys.objetivosVigentes(request.campania) },
      { throwOnError: true },
    );
    expect(invalidar).toHaveBeenCalledWith(
      { queryKey: planificacionKeys.tablerosCampania(request.campania) },
      { throwOnError: true },
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Cargamos la revisión vigente"),
      ),
    );
  });

  it("ante 409 no afirma que recargó si el refetch también falla", async () => {
    const queryClient = crearCliente();
    const error = conflicto();
    vi.mocked(previsualizarObjetivos).mockRejectedValue(error);
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(
      new Error("La lectura fresca falló"),
    );
    const { result } = renderHook(() => usePrevisualizarObjetivos(), {
      wrapper: contenedor(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(request)).rejects.toBe(error);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("No pudimos recargar la revisión vigente"),
      ),
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Cargamos la revisión vigente"),
    );
  });
});
