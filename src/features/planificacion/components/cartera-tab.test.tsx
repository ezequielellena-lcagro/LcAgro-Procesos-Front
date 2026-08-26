import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TableroPlanificacionDto } from "../types";
import { useProductorTableroDetalle } from "../queries/use-tablero-planificacion";
import { CarteraTab } from "./cartera-tab";

vi.mock("../queries/use-tablero-planificacion", () => ({
  useProductorTableroDetalle: vi.fn(),
}));

function tablero(): TableroPlanificacionDto {
  return {
    campania: "2025-2026",
    bayerDisponible: false,
    segmentacionDisponible: false,
    motivoSegmentacionNoDisponible: "Falta Bayer.",
    vendedores: [],
    items: [
      {
        score: null,
        segmento: null,
        desglose: [],
        productor: {
          productorId: 7,
          cuentaMacroGest: 70,
          razonSocial: "Productor de prueba",
          vendedorCodigo: null,
          vendedorNombre: null,
          sucursal: null,
          planCargado: false,
          hectareasTotales: 0,
          mercadoConocidoUsd: null,
          mercadoCompleto: false,
          hectareasSinCosto: 0,
          cultivosSinCosto: [],
          facturacionLcUsd: 0,
          rentabilidadLcUsd: 0,
          margenLcPct: null,
          mixSubrubrosLc: 0,
          facturacionLcSinVendedorUsd: 0,
          tieneDesvioVendedorLc: false,
          vendedoresHistoricosLc: [],
          facturacionBayerUsd: null,
          facturacionBayerSinVendedorUsd: null,
          tieneDesvioVendedorBayer: null,
          vendedoresHistoricosBayer: [],
          facturacionTotalUsd: null,
          canal: null,
          participacionPct: null,
          oportunidadUsd: null,
          tieneActividadLc: false,
          tieneActividadBayer: null,
          tieneActividad: null,
        },
      },
    ],
    resumenSeleccion: {
      productores: 1,
      productoresConPlan: 0,
      productoresMercadoIncompleto: 0,
      hectareasTotales: 0,
      mercadoConocidoUsd: 0,
      facturacionLcUsd: 0,
      facturacionBayerUsd: null,
      facturacionTotalUsd: null,
      ventaComparableUsd: null,
      ventaSinMercadoUsd: null,
      participacionComparablePct: null,
      oportunidadUsd: null,
    },
    resumenPorSegmento: [],
    resumenPorCanal: [],
    page: 1,
    totalPages: 1,
    total: 1,
  } as unknown as TableroPlanificacionDto;
}

describe("CarteraTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useProductorTableroDetalle).mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProductorTableroDetalle>);
  });

  it("ofrece un botón accesible para abrir el productor sin depender del click de fila", () => {
    render(
      <CarteraTab
        tablero={tablero()}
        filtros={{ campania: "2025-2026" }}
        busqueda=""
        actualizando={false}
        onBusqueda={vi.fn()}
        onFiltros={vi.fn()}
        onLimpiarFiltros={vi.fn()}
        onConfigurarSegmentacion={vi.fn()}
      />,
    );

    const abrir = screen.getByRole("button", {
      name: "Abrir detalle de Productor de prueba",
    });
    fireEvent.click(abrir);

    expect(useProductorTableroDetalle).toHaveBeenLastCalledWith(7, "2025-2026");
  });
});
