import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProductorTableroDetalleDto } from "../types";
import { ProductorDetalle } from "./productor-detalle";

function detalle(): ProductorTableroDetalleDto {
  return {
    campania: "2025-2026",
    generadoEn: "2026-04-01T02:30:00Z",
    item: {
      score: null,
      segmento: null,
      desglose: [],
      productor: {
        productorId: 7,
        cuentaMacroGest: 1007,
        razonSocial: "Productor inventado",
        vendedorCodigo: 8,
        vendedorNombre: "Vendedor inventado",
        sucursal: "Sucursal inventada",
        planCargado: true,
        hectareasTotales: 10,
        mercadoConocidoUsd: 100,
        mercadoCompleto: true,
        hectareasSinCosto: 0,
        cultivosSinCosto: [],
        facturacionLcUsd: 20,
        rentabilidadLcUsd: 2,
        margenLcPct: 10,
        mixSubrubrosLc: 1,
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
        tieneActividadLc: true,
        tieneActividadBayer: null,
        tieneActividad: null,
      },
    },
    plan: {
      productorId: 7,
      cuentaMacroGest: 1007,
      razonSocial: "Productor inventado",
      vendedorCodigo: 8,
      vendedorNombre: "Vendedor inventado",
      sucursal: "Sucursal inventada",
      habilitado: true,
      campania: "2025-2026",
      planCargado: true,
      revision: 3,
      vigenteDesde: "2026-04-01T02:30:00Z",
      lineas: [],
      hectareasTotales: 10,
      mercadoUsd: 100,
      mercadoCompleto: true,
      hectareasSinCosto: 0,
      cultivosSinCosto: [],
    },
  };
}

describe("ProductorDetalle", () => {
  it("presenta el corte y la vigencia en Buenos Aires y en español", () => {
    render(<ProductorDetalle detalle={detalle()} onClose={vi.fn()} />);

    expect(screen.getByText("Corte").nextElementSibling).toHaveTextContent(/31\/3\/26.*23:30/);
    expect(screen.getByText(/Vigente desde 31\/3\/26.*23:30/)).toBeInTheDocument();
    expect(screen.queryByText("Snapshot")).not.toBeInTheDocument();
  });
});
