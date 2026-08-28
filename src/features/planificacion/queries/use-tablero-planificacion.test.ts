import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listarSnapshotsPlanificacion,
  obtenerDetalleProductorSnapshot,
  obtenerDetalleProductorTablero,
  obtenerTablero,
  obtenerTableroSnapshot,
} from "../api";
import type {
  CorteConsultaPlanificacion,
  SnapshotPlanificacionDto,
  TableroPlanificacionDto,
} from "../types";
import { CORTE_VIVO_PLANIFICACION, planificacionKeys } from "./keys";
import { useSnapshotsPlanificacion } from "./use-snapshots-planificacion";
import {
  esMismoCorteTablero,
  useProductorTableroDetalle,
  useTableroPlanificacion,
} from "./use-tablero-planificacion";

vi.mock("../api", () => ({
  listarSnapshotsPlanificacion: vi.fn(),
  obtenerDetalleProductorSnapshot: vi.fn(),
  obtenerDetalleProductorTablero: vi.fn(),
  obtenerTablero: vi.fn(),
  obtenerTableroSnapshot: vi.fn(),
}));

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function snapshot(sha256: string): SnapshotPlanificacionDto {
  return {
    id: 41,
    loteId: "f4b29685-3067-4dd6-b26f-08093e8513f6",
    fecha: "2026-08-28",
    campania: "2025-2026",
    capturadoEn: "2026-08-28T23:30:00-03:00",
    versionEsquema: 1,
    productores: 2,
    bayerImportacionId: null,
    matrizRevision: 3,
    objetivosRevision: 4,
    sha256,
  };
}

function conflictoSha(): AxiosError {
  const error = new AxiosError("Conflict");
  error.response = {
    status: 409,
    statusText: "Conflict",
    data: { detail: "El corte histórico fue actualizado." },
  } as AxiosResponse;
  return error;
}

function corteSnapshot(id: number, sha256: string): CorteConsultaPlanificacion {
  return { modo: "snapshot", snapshot: { id, sha256 } };
}

function crearWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("placeholder del tablero", () => {
  beforeEach(() => vi.clearAllMocks());

  it("conserva la página previa sólo dentro de la misma campaña y el mismo corte", () => {
    const anterior = planificacionKeys.tablero({
      campania: "2025-2026",
      vendedorCodigo: 8,
      page: 2,
    });

    expect(esMismoCorteTablero(anterior, "2025-2026", CORTE_VIVO_PLANIFICACION)).toBe(true);
    expect(esMismoCorteTablero(anterior, "2024-2025", CORTE_VIVO_PLANIFICACION)).toBe(false);
    expect(esMismoCorteTablero(anterior, "2025-2026", corteSnapshot(41, SHA_A))).toBe(false);
  });

  it("no reutiliza datos cuando todavía no existe una consulta anterior", () => {
    expect(
      esMismoCorteTablero(undefined, "2025-2026", CORTE_VIVO_PLANIFICACION),
    ).toBe(false);
  });

  it("separa las cachés del vivo y de cada snapshot", () => {
    const filtros = { campania: "2025-2026", page: 1 };

    expect(planificacionKeys.tablero(filtros, CORTE_VIVO_PLANIFICACION)).not.toEqual(
      planificacionKeys.tablero(filtros, corteSnapshot(41, SHA_A)),
    );
    expect(planificacionKeys.tablero(filtros, corteSnapshot(41, SHA_A))).not.toEqual(
      planificacionKeys.tablero(filtros, corteSnapshot(41, SHA_B)),
    );
    expect(planificacionKeys.tablero(filtros, corteSnapshot(41, SHA_A))[3]).toContain(SHA_A);
    expect(planificacionKeys.detalle(7, filtros.campania, CORTE_VIVO_PLANIFICACION)).not.toEqual(
      planificacionKeys.detalle(7, filtros.campania, corteSnapshot(41, SHA_A)),
    );
  });

  it("no consulta tablero ni detalle históricos hasta tener la metadata con SHA", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const cortePendiente: CorteConsultaPlanificacion = {
      modo: "snapshot-pendiente",
      snapshotId: 41,
    };
    const wrapper = crearWrapper(queryClient);

    const tablero = renderHook(
      () => useTableroPlanificacion({ campania: "2025-2026" }, cortePendiente),
      { wrapper },
    );
    const detalle = renderHook(
      () => useProductorTableroDetalle(7, "2025-2026", cortePendiente),
      { wrapper },
    );

    expect(tablero.result.current.fetchStatus).toBe("idle");
    expect(detalle.result.current.fetchStatus).toBe("idle");
    expect(obtenerTablero).not.toHaveBeenCalled();
    expect(obtenerTableroSnapshot).not.toHaveBeenCalled();
    expect(obtenerDetalleProductorTablero).not.toHaveBeenCalled();
    expect(obtenerDetalleProductorSnapshot).not.toHaveBeenCalled();
  });

  it("refresca el listado una sola vez y continúa con el SHA autoritativo tras un 409", async () => {
    vi.mocked(listarSnapshotsPlanificacion)
      .mockResolvedValueOnce([snapshot(SHA_A)])
      .mockResolvedValueOnce([snapshot(SHA_B)]);
    vi.mocked(obtenerTableroSnapshot).mockImplementation(async (referencia) => {
      if (referencia.sha256 === SHA_A) throw conflictoSha();
      return {
        snapshot: snapshot(SHA_B),
        tablero: { campania: "2025-2026", generadoEn: "2026-08-28T23:30:00-03:00" },
      } as { snapshot: SnapshotPlanificacionDto; tablero: TableroPlanificacionDto };
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const consulta = renderHook(
      () => {
        const listado = useSnapshotsPlanificacion("2025-2026");
        const foto = listado.data?.[0];
        const corte: CorteConsultaPlanificacion = foto
          ? { modo: "snapshot", snapshot: foto }
          : { modo: "snapshot-pendiente", snapshotId: 41 };
        return useTableroPlanificacion({ campania: "2025-2026" }, corte);
      },
      { wrapper: crearWrapper(queryClient) },
    );

    await waitFor(() => expect(consulta.result.current.data?.campania).toBe("2025-2026"));

    expect(listarSnapshotsPlanificacion).toHaveBeenCalledTimes(2);
    expect(obtenerTableroSnapshot).toHaveBeenCalledTimes(2);
    expect(vi.mocked(obtenerTableroSnapshot).mock.calls.map(([foto]) => foto.sha256)).toEqual([
      SHA_A,
      SHA_B,
    ]);
  });

  it("no reintenta automáticamente el mismo SHA cuando el servidor responde 409", async () => {
    vi.mocked(obtenerTableroSnapshot).mockRejectedValue(conflictoSha());
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 5 } },
    });

    const consulta = renderHook(
      () =>
        useTableroPlanificacion(
          { campania: "2025-2026" },
          corteSnapshot(41, SHA_A),
        ),
      { wrapper: crearWrapper(queryClient) },
    );

    await waitFor(() => expect(consulta.result.current.isError).toBe(true));

    expect(obtenerTableroSnapshot).toHaveBeenCalledTimes(1);
    expect(obtenerTableroSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 41, sha256: SHA_A }),
      expect.objectContaining({ campania: "2025-2026" }),
    );
  });

  it("vuelve a refrescar metadatos al reintentar si el primer refresco del 409 falló", async () => {
    vi.mocked(listarSnapshotsPlanificacion)
      .mockResolvedValueOnce([snapshot(SHA_A)])
      .mockRejectedValueOnce(new Error("No se pudo refrescar el listado"))
      .mockResolvedValueOnce([snapshot(SHA_B)]);
    vi.mocked(obtenerTableroSnapshot).mockImplementation(async (referencia) => {
      if (referencia.sha256 === SHA_A) throw conflictoSha();
      return {
        snapshot: snapshot(SHA_B),
        tablero: { campania: "2025-2026", generadoEn: "2026-08-28T23:30:00-03:00" },
      } as { snapshot: SnapshotPlanificacionDto; tablero: TableroPlanificacionDto };
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const consulta = renderHook(
      () => {
        const listado = useSnapshotsPlanificacion("2025-2026");
        const foto = listado.data?.[0];
        const corte: CorteConsultaPlanificacion = foto
          ? { modo: "snapshot", snapshot: foto }
          : { modo: "snapshot-pendiente", snapshotId: 41 };
        return useTableroPlanificacion({ campania: "2025-2026" }, corte);
      },
      { wrapper: crearWrapper(queryClient) },
    );

    await waitFor(() => expect(consulta.result.current.isError).toBe(true));
    expect(listarSnapshotsPlanificacion).toHaveBeenCalledTimes(2);

    await act(async () => {
      await consulta.result.current.refetch();
    });

    await waitFor(() => expect(consulta.result.current.data?.campania).toBe("2025-2026"));
    expect(listarSnapshotsPlanificacion).toHaveBeenCalledTimes(3);
    expect(vi.mocked(obtenerTableroSnapshot).mock.calls.map(([foto]) => foto.sha256)).toEqual([
      SHA_A,
      SHA_A,
      SHA_B,
    ]);
  });
});
