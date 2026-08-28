import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TableroPlanificacionDto } from "../types";
import { ComparacionFuentes } from "./comparacion-fuentes";

function tableroReferencia(): TableroPlanificacionDto {
  return {
    campania: "2025-2026",
    generadoEn: "2026-08-26T15:00:00-03:00",
    conciliacion: {
      lc: { renglones: 100, totalVivoUsd: 13_396_528.69 },
      bayer: {
        disponible: true,
        totalArchivoUsd: 7_083_328.31,
        fechaImportacion: "2026-08-25T12:00:00-03:00",
      },
      totalOperativoCarteraUsd: 20_300_000,
      referenciaHistorica: {
        disponible: true,
        campania: "2025-2026",
        facturacionLcUsd: 13_284_338.65,
        facturacionBayerUsd: 7_195_518.35,
        facturacionTotalUsd: 20_479_857,
        mercadoUsd: 98_474_466,
        participacionPct: 20.8,
        diferenciaLcVivoUsd: 112_190.04,
        diferenciaBayerArchivoUsd: -112_190.04,
        totalActualFuentesUsd: 20_479_857,
        diferenciaTotalFuentesUsd: 0,
        participacionActualSobreMercadoReferenciaPct: 20.8,
        estado: "referencia_disponible",
      },
    },
    referenciaSegmentacion: {
      disponible: true,
      campania: "2025-2026",
      productoresEvaluados: 404,
      productoresSinScore: 21,
      distribucion: { a: 21, b: 59, c: 196, d: 128, sinScore: 0, total: 404 },
      estado: "referencia_disponible",
    },
  } as TableroPlanificacionDto;
}

describe("ComparacionFuentes", () => {
  it("separa el dato actual de la referencia Excel y aclara que no se suman", () => {
    render(<ComparacionFuentes tablero={tableroReferencia()} soloLectura={false} />);

    expect(screen.getByText("Fuentes operativas completas")).toBeInTheDocument();
    expect(screen.getByText("Referencia histórica Excel")).toBeInTheDocument();
    expect(screen.getByText(/No se suma:/)).toBeInTheDocument();
    expect(screen.getByText("US$ 13.396.528,69")).toBeInTheDocument();
    expect(screen.getByText("US$ 13.284.338,65")).toBeInTheDocument();
    expect(screen.getByText("US$ 98.474.466,00")).toBeInTheDocument();
  });

  it("muestra la distribución histórica validada sin mezclarla con la operativa", () => {
    render(<ComparacionFuentes tablero={tableroReferencia()} soloLectura={false} />);

    expect(screen.getByText("Segmentación histórica Excel")).toBeInTheDocument();
    expect(screen.getAllByText("404")).toHaveLength(2);
    for (const segmento of ["Segmento A", "Segmento B", "Segmento C", "Segmento D"]) {
      expect(screen.getByText(segmento)).toBeInTheDocument();
    }
    expect(
      screen.getByText(/no se suma ni reemplaza la segmentación operativa/i),
    ).toBeInTheDocument();
  });

  it("en una foto reemplaza los rótulos vivos por términos del corte sin cambiar importes", () => {
    render(<ComparacionFuentes tablero={tableroReferencia()} soloLectura />);

    expect(screen.getByText("Fuentes fotografiadas vs. referencia Excel")).toBeInTheDocument();
    expect(screen.getByText("Dato fotografiado")).toBeInTheDocument();
    expect(screen.getByText("LC fotografiado")).toBeInTheDocument();
    expect(screen.getByText("Diferencia al momento del corte − histórica")).toBeInTheDocument();
    expect(screen.queryByText(/actual|vivo/i)).not.toBeInTheDocument();
    expect(screen.getByText("US$ 13.396.528,69")).toBeInTheDocument();
    expect(screen.getByText("US$ 13.284.338,65")).toBeInTheDocument();
  });

  it("muestra las fechas operativas en la zona de Buenos Aires", () => {
    const tablero = tableroReferencia();
    tablero.generadoEn = "2026-04-01T02:30:00Z";
    tablero.conciliacion.bayer.fechaImportacion = "2026-04-01T02:30:00Z";

    render(<ComparacionFuentes tablero={tablero} soloLectura />);

    expect(screen.getByText(/Corte 31\/3\/26.*23:30/)).toBeInTheDocument();
    expect(screen.getByText(/Importado el 31\/3\/26.*23:30/)).toBeInTheDocument();
  });
});
