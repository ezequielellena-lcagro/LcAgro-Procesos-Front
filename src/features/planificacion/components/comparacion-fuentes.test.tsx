import { render, screen, within } from "@testing-library/react";
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
        importacionId: 87,
        totalArchivoUsd: 7_083_328.31,
        fechaImportacion: "2026-08-25T12:00:00-03:00",
        nombreArchivo: "comisiones-bayer-2026.xlsx",
        formato: "xlsx",
        filas: 700,
        filasImportacion: 739,
        filasCruzadasImportacion: 718,
        filasSinCruzarImportacion: 21,
      },
      totalOperativoCarteraUsd: 20_300_000,
      controlBayer: {
        disponible: true,
        motivoNoDisponible: null,
        diferenciaArchivoVsPedidoNominalUsd: 2_500,
        datos: {
          campania: "2025-2026",
          desde: "2025-04-01",
          hastaExclusiva: "2026-04-01",
          depositosConsultados: [43, 53],
          depositos: [
            {
              deposito: 43,
              renglonesTodosEstados: 300,
              renglonesVigentes: 270,
              pedidos: 180,
              cuentas: 150,
              articulos: 45,
              renglonesPrecioCero: 3,
              renglonesMonedaNoUsd: 2,
              fechaMin: "2025-04-04",
              fechaMax: "2026-03-20",
              cantidad: 1_200,
              importeNominalUsd: 4_000_000,
              importeNominalMonedaNoUsd: 50_000,
            },
            {
              deposito: 53,
              renglonesTodosEstados: 220,
              renglonesVigentes: 204,
              pedidos: 130,
              cuentas: 120,
              articulos: 38,
              renglonesPrecioCero: 1,
              renglonesMonedaNoUsd: 0,
              fechaMin: "2025-04-10",
              fechaMax: "2026-03-18",
              cantidad: 900,
              importeNominalUsd: 3_080_828.31,
              importeNominalMonedaNoUsd: 0,
            },
          ],
          renglonesTodosEstados: 520,
          renglonesVigentes: 474,
          pedidos: 310,
          cantidad: 2_100,
          importeNominalUsd: 7_080_828.31,
          importeNominalMonedaNoUsd: 50_000,
        },
      },
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

  it("identifica el último Excel Bayer confirmado y sus conteos globales", () => {
    render(<ComparacionFuentes tablero={tableroReferencia()} soloLectura={false} />);

    const fuenteBayer = screen.getByRole("region", {
      name: "Fuente operativa: último Excel Bayer confirmado",
    });
    expect(
      within(fuenteBayer).getByText("Integración directa: pendiente de habilitación externa"),
    ).toBeInTheDocument();
    expect(within(fuenteBayer).getByText("Importación #87")).toBeInTheDocument();
    expect(within(fuenteBayer).getByText("comisiones-bayer-2026.xlsx")).toBeInTheDocument();
    expect(within(fuenteBayer).getByText("XLSX")).toBeInTheDocument();
    expect(within(fuenteBayer).getByText("739")).toBeInTheDocument();
    expect(within(fuenteBayer).getByText("718")).toBeInTheDocument();
    expect(within(fuenteBayer).getByText("21")).toBeInTheDocument();
    expect(within(fuenteBayer).getByText(/esta campaña usa 700 filas/i)).toBeInTheDocument();
  });

  it("muestra el control 43/53 separado y deja explícito que no se suma", () => {
    render(<ComparacionFuentes tablero={tableroReferencia()} soloLectura={false} />);

    expect(
      screen.getByRole("heading", { name: "Control indicativo · depósitos 43/53" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Depósito 43")).toBeInTheDocument();
    expect(screen.getByText("Depósito 53")).toBeInTheDocument();
    expect(screen.getByText(/no se suma al consolidado/i)).toBeInTheDocument();
    expect(screen.getByText("US$ 7.080.828,31")).toBeInTheDocument();
    expect(screen.getByText("+US$ 2.500,00")).toBeInTheDocument();
  });

  it("distingue una campaña sin importación de un control temporalmente no disponible", () => {
    const tablero = tableroReferencia();
    tablero.conciliacion.bayer = {
      ...tablero.conciliacion.bayer,
      disponible: false,
      importacionId: null,
      fechaImportacion: null,
      nombreArchivo: null,
      formato: null,
      filasImportacion: null,
      filasCruzadasImportacion: null,
      filasSinCruzarImportacion: null,
      totalArchivoUsd: null,
    };
    tablero.conciliacion.controlBayer = {
      disponible: false,
      motivoNoDisponible: "MacroGest no respondió al control acotado.",
      datos: null,
      diferenciaArchivoVsPedidoNominalUsd: null,
    };

    render(<ComparacionFuentes tablero={tablero} soloLectura={false} />);

    expect(screen.getByText("Sin importación Bayer confirmada")).toBeInTheDocument();
    expect(screen.getByText("Control indicativo no disponible")).toBeInTheDocument();
    expect(screen.getByText("MacroGest no respondió al control acotado.")).toBeInTheDocument();
  });

  it("mantiene el control disponible aunque la campaña no tenga Excel confirmado", () => {
    const tablero = tableroReferencia();
    tablero.conciliacion.bayer = {
      ...tablero.conciliacion.bayer,
      disponible: false,
      importacionId: null,
      fechaImportacion: null,
      nombreArchivo: null,
      formato: null,
      filasImportacion: null,
      filasCruzadasImportacion: null,
      filasSinCruzarImportacion: null,
      totalArchivoUsd: null,
    };
    tablero.conciliacion.controlBayer.diferenciaArchivoVsPedidoNominalUsd = null;

    render(<ComparacionFuentes tablero={tablero} soloLectura={false} />);

    expect(screen.getByText("Sin importación Bayer confirmada")).toBeInTheDocument();
    expect(screen.getByText("US$ 7.080.828,31")).toBeInTheDocument();
    expect(screen.getByText("No calculable")).toBeInTheDocument();
    expect(screen.queryByText("Control indicativo no disponible")).not.toBeInTheDocument();
  });

  it("mantiene el Excel confirmado cuando el control no está disponible", () => {
    const tablero = tableroReferencia();
    tablero.conciliacion.controlBayer = {
      disponible: false,
      motivoNoDisponible: "MacroGest no respondió al control acotado.",
      datos: null,
      diferenciaArchivoVsPedidoNominalUsd: null,
    };

    render(<ComparacionFuentes tablero={tablero} soloLectura={false} />);

    expect(screen.getByText("Importación #87")).toBeInTheDocument();
    expect(screen.getByText("Control indicativo no disponible")).toBeInTheDocument();
    expect(screen.getByText("MacroGest no respondió al control acotado.")).toBeInTheDocument();
    expect(screen.queryByText("Sin importación Bayer confirmada")).not.toBeInTheDocument();
  });

  it("trata un control vacío como consulta exitosa y distingue el detalle faltante", () => {
    const tablero = tableroReferencia();
    tablero.conciliacion.controlBayer = {
      disponible: true,
      motivoNoDisponible: null,
      diferenciaArchivoVsPedidoNominalUsd: null,
      datos: {
        ...tablero.conciliacion.controlBayer.datos!,
        depositos: [],
        renglonesTodosEstados: 0,
        renglonesVigentes: 0,
        pedidos: 0,
        cantidad: 0,
        importeNominalUsd: 0,
        importeNominalMonedaNoUsd: 0,
      },
    };

    render(<ComparacionFuentes tablero={tablero} soloLectura={false} />);

    const control = screen.getByRole("region", {
      name: "Control indicativo · depósitos 43/53",
    });
    expect(within(control).queryByText("Control indicativo no disponible")).not.toBeInTheDocument();
    expect(within(control).getAllByText("Sin detalle en el control informado.")).toHaveLength(2);
    expect(within(control).getByText("US$ 0,00")).toBeInTheDocument();
  });

  it("no convierte en cero los conteos globales desconocidos", () => {
    const tablero = tableroReferencia();
    tablero.conciliacion.bayer.filasImportacion = null;
    tablero.conciliacion.bayer.filasCruzadasImportacion = null;
    tablero.conciliacion.bayer.filasSinCruzarImportacion = null;

    render(<ComparacionFuentes tablero={tablero} soloLectura={false} />);

    expect(screen.getAllByText("Sin dato")).toHaveLength(3);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("explica los conteos desconocidos de una foto anterior sin completarlos con datos vivos", () => {
    const tablero = tableroReferencia();
    tablero.conciliacion.bayer.filasImportacion = null;
    tablero.conciliacion.bayer.filasCruzadasImportacion = null;
    tablero.conciliacion.bayer.filasSinCruzarImportacion = null;

    render(<ComparacionFuentes tablero={tablero} soloLectura />);

    expect(screen.getAllByText("Sin dato en este corte")).toHaveLength(3);
    expect(screen.queryByText("Sin dato")).not.toBeInTheDocument();
  });

  it("en una foto reemplaza los rótulos vivos por términos del corte sin cambiar importes", () => {
    render(<ComparacionFuentes tablero={tableroReferencia()} soloLectura />);

    expect(screen.getByText("Fuentes fotografiadas vs. referencia Excel")).toBeInTheDocument();
    expect(screen.getByText("Dato fotografiado")).toBeInTheDocument();
    expect(screen.getByText("LC fotografiado")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Fuente operativa fotografiada: último Excel Bayer confirmado al corte",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Control indicativo al corte · depósitos 43/53" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Diferencia al momento del corte − histórica")).toBeInTheDocument();
    // Ninguno de los rótulos de modo vivo sobrevive a la foto. Se listan uno por uno en lugar de
    // una regex /actual|vivo/: la prosa explicativa dice "se actualiza" y no es un rótulo.
    for (const rotuloVivo of [
      "Dato actual",
      "Fuentes actuales",
      "LC vivo",
      "LC vivo vs. Excel",
      "Bayer actual vs. Excel",
      "Diferencia actual − histórica",
    ]) {
      expect(screen.queryByText(rotuloVivo)).not.toBeInTheDocument();
    }
    expect(screen.getByText("US$ 13.396.528,69")).toBeInTheDocument();
    expect(screen.getByText("US$ 13.284.338,65")).toBeInTheDocument();
  });

  it("muestra las fechas operativas en la zona de Buenos Aires", () => {
    const tablero = tableroReferencia();
    tablero.generadoEn = "2026-04-01T02:30:00Z";
    tablero.conciliacion.bayer.fechaImportacion = "2026-04-01T02:30:00Z";

    render(<ComparacionFuentes tablero={tablero} soloLectura />);

    expect(screen.getByText(/Corte 31\/3\/26.*23:30/)).toBeInTheDocument();
    expect(screen.getByText(/Confirmado al corte el 31\/3\/26.*23:30/)).toBeInTheDocument();
  });
});
