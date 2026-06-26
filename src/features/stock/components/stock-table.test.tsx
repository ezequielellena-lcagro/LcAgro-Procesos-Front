import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StockItem } from "../types";
import { StockTable } from "./stock-table";

function item(p: Partial<StockItem> & Pick<StockItem, "deposito" | "codigoArticulo">): StockItem {
  return {
    nombreProducto: "PRODUCTO",
    rubro: 200,
    rubroDesc: "HERBICIDAS",
    unidad: "LT",
    stockActual: 100,
    precioUsd: 1,
    valorUsd: 100,
    ventaDiaria: 1,
    diasCobertura: 50,
    estado: "Ok",
    ...p,
  };
}

const filas: StockItem[] = [
  item({ deposito: 0, codigoArticulo: 1, nombreProducto: "GLIFOSATO", valorUsd: 500 }),
  item({ deposito: 0, codigoArticulo: 2, nombreProducto: "ATRAZINA", valorUsd: 300 }),
  item({ deposito: 5, codigoArticulo: 3, nombreProducto: "UREA", valorUsd: 1000, estado: "Inmovilizado", diasCobertura: null }),
];

describe("StockTable", () => {
  it("muestra un encabezado de grupo por depósito", () => {
    render(<StockTable filas={filas} />);
    expect(screen.getByText("Depósito 0")).toBeInTheDocument();
    expect(screen.getByText("Depósito 5")).toBeInTheDocument();
  });

  it("muestra las filas de artículo de cada grupo", () => {
    render(<StockTable filas={filas} />);
    expect(screen.getByText("GLIFOSATO")).toBeInTheDocument();
    expect(screen.getByText("ATRAZINA")).toBeInTheDocument();
    expect(screen.getByText("UREA")).toBeInTheDocument();
  });

  it("colapsa un grupo al hacer click en su encabezado", () => {
    render(<StockTable filas={filas} />);
    expect(screen.getByText("GLIFOSATO")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Depósito 0/ }));
    expect(screen.queryByText("GLIFOSATO")).not.toBeInTheDocument();
    expect(screen.queryByText("ATRAZINA")).not.toBeInTheDocument();
    // El otro grupo sigue visible.
    expect(screen.getByText("UREA")).toBeInTheDocument();
  });

  it("muestra '—' cuando diasCobertura es null", () => {
    render(<StockTable filas={[filas[2]]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
