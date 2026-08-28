import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  listarSnapshotsPlanificacion,
  obtenerDetalleProductorSnapshot,
  obtenerTableroSnapshot,
} from "./api";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn() },
}));

describe("API de snapshots de planificación", () => {
  beforeEach(() => vi.clearAllMocks());

  const snapshot = { id: 41, sha256: "a".repeat(64) };

  it("lista fotos por campaña y rango de fechas", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });

    await listarSnapshotsPlanificacion({
      campania: "2025-2026",
      desde: "2026-08-01",
      hasta: "2026-08-28",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/planificacion-vendedores/snapshots", {
      params: {
        campania: "2025-2026",
        desde: "2026-08-01",
        hasta: "2026-08-28",
      },
    });
  });

  it("consulta tablero y detalle dentro del snapshot sin volver a pedir la campaña viva", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });

    await obtenerTableroSnapshot(snapshot, {
      campania: "2025-2026",
      q: "productor",
      vendedorCodigo: 8,
      segmento: "A",
      canal: "Ambos",
      orden: "Mercado",
      page: 2,
      pageSize: 25,
    });
    await obtenerDetalleProductorSnapshot(snapshot, 7);

    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      "/planificacion-vendedores/snapshots/41/tablero",
      {
        params: {
          sha256: "a".repeat(64),
          q: "productor",
          vendedorCodigo: 8,
          segmento: "A",
          canal: "Ambos",
          orden: "Mercado",
          page: 2,
          pageSize: 25,
        },
      },
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      "/planificacion-vendedores/snapshots/41/productores/7",
      { params: { sha256: "a".repeat(64) } },
    );
  });
});
