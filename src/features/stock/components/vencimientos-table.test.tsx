import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StockItem, StockLote } from "../types";
import { filasDeVencimiento } from "../vencimientos";
import { VencimientosTable } from "./vencimientos-table";

function lote(p: Partial<StockLote> & Pick<StockLote, "serie">): StockLote {
  return {
    stockActual: 10,
    fechaIngreso: "2026-01-01",
    fechaVencimiento: "2026-08-01",
    diasParaVencer: 16,
    estadoVenc: "Critico",
    diasEnStock: 100,
    semaforoRotacion: "Amarillo",
    ...p,
  };
}

function item(p: Partial<StockItem> & Pick<StockItem, "deposito" | "codigoArticulo">): StockItem {
  return {
    depositoNombre: "San Jorge",
    tipoDeposito: "Propio",
    nombreProducto: "PRODUCTO",
    rubro: 200,
    rubroDesc: "HERBICIDAS",
    unidad: "LT",
    stockActual: 100,
    precioUsd: 2,
    valorUsd: 200,
    ventaDiaria: 1,
    diasCobertura: 50,
    estado: "Ok",
    nivelMinimo: 0,
    bajoMinimo: false,
    estadoVenc: "Critico",
    proximoVencimiento: "2026-08-01",
    unidadesVencidas: 0,
    unidadesCriticas: 0,
    valorUsdVencido: 0,
    diasEnStockMax: 100,
    diasEnStockPromedio: 100,
    semaforoRotacion: "Amarillo",
    lotes: [],
    ...p,
  };
}

describe("filasDeVencimiento", () => {
  it("aplana items → lotes dejando solo los accionables", () => {
    const filas = filasDeVencimiento([
      item({
        deposito: 0,
        codigoArticulo: 1,
        lotes: [
          lote({ serie: "A", estadoVenc: "Vencido", diasParaVencer: -5 }),
          lote({ serie: "B", estadoVenc: "Normal", diasParaVencer: 500 }),
          lote({ serie: "C", estadoVenc: "SinFecha", diasParaVencer: null }),
        ],
      }),
    ]);
    expect(filas.map((f) => f.serie)).toEqual(["A"]);
  });

  it("ordena por diasParaVencer asc con los sin fecha al final", () => {
    const filas = filasDeVencimiento([
      item({
        deposito: 0,
        codigoArticulo: 1,
        lotes: [
          lote({ serie: "ALERTA", estadoVenc: "Alerta", diasParaVencer: 300 }),
          lote({ serie: "SIN-FECHA", estadoVenc: "Vencido", diasParaVencer: null }),
          lote({ serie: "VENCIDO", estadoVenc: "Vencido", diasParaVencer: -20 }),
          lote({ serie: "CRITICO", estadoVenc: "Critico", diasParaVencer: 30 }),
        ],
      }),
    ]);
    expect(filas.map((f) => f.serie)).toEqual(["VENCIDO", "CRITICO", "ALERTA", "SIN-FECHA"]);
  });

  it("ordena por urgencia cruzando artículos y valoriza el lote con el precio del item", () => {
    const filas = filasDeVencimiento([
      item({ deposito: 0, codigoArticulo: 1, precioUsd: 2, lotes: [lote({ serie: "A", diasParaVencer: 90, stockActual: 10 })] }),
      item({ deposito: 5, codigoArticulo: 2, precioUsd: 3, lotes: [lote({ serie: "B", diasParaVencer: 5, stockActual: 4 })] }),
    ]);
    expect(filas.map((f) => f.serie)).toEqual(["B", "A"]);
    // Valor = stock del LOTE × precio del artículo (no el valorUsd del item).
    expect(filas[0].valorUsd).toBe(12);
    expect(filas[1].valorUsd).toBe(20);
  });

  it("arma una key estable con depósito, artículo y serie", () => {
    const filas = filasDeVencimiento([item({ deposito: 44, codigoArticulo: 10090, lotes: [lote({ serie: "L-1" })] })]);
    expect(filas[0].key).toBe("44-10090-L-1");
  });
});

describe("VencimientosTable", () => {
  const filas: StockItem[] = [
    item({
      deposito: 0,
      depositoNombre: "San Jorge",
      codigoArticulo: 1,
      nombreProducto: "GLIFOSATO",
      precioUsd: 2,
      lotes: [lote({ serie: "L-1", estadoVenc: "Vencido", diasParaVencer: -20, stockActual: 10, fechaVencimiento: "2026-06-26" })],
    }),
    item({
      deposito: 5,
      depositoNombre: "San Francisco",
      codigoArticulo: 2,
      nombreProducto: "ATRAZINA",
      lotes: [lote({ serie: "", estadoVenc: "Alerta", diasParaVencer: null, fechaVencimiento: null })],
    }),
  ];

  it("muestra una fila por lote accionable con producto y depósito", () => {
    render(<VencimientosTable filas={filas} />);
    expect(screen.getByText("GLIFOSATO")).toBeInTheDocument();
    expect(screen.getByText("San Jorge")).toBeInTheDocument();
    expect(screen.getByText("ATRAZINA")).toBeInTheDocument();
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
  });

  it("muestra el badge de estado del lote", () => {
    render(<VencimientosTable filas={filas} />);
    expect(screen.getByText("Vencido")).toBeInTheDocument();
    expect(screen.getByText("Alerta")).toBeInTheDocument();
  });

  it("aclara los días cuando el lote ya venció", () => {
    render(<VencimientosTable filas={filas} />);
    expect(screen.getByText("vencido hace 20 d")).toBeInTheDocument();
  });

  it("muestra '—' en fecha, días y serie cuando no hay dato", () => {
    render(<VencimientosTable filas={[filas[1]]} />);
    // Serie vacía, fecha null y días null → tres guiones.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("respeta la urgencia: el vencido va primero", () => {
    render(<VencimientosTable filas={filas} />);
    const primera = screen.getAllByRole("row")[1];
    expect(within(primera).getByText("GLIFOSATO")).toBeInTheDocument();
  });

  it("muestra el vacío cuando ningún lote es accionable", () => {
    render(<VencimientosTable filas={[item({ deposito: 0, codigoArticulo: 9, lotes: [lote({ serie: "N", estadoVenc: "Normal" })] })]} />);
    expect(screen.getByText(/No hay lotes vencidos/)).toBeInTheDocument();
  });
});
