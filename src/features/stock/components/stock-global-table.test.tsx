import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeStockItem as item } from "../fakes";
import { StockGlobalTable } from "./stock-global-table";

describe("StockGlobalTable", () => {
  it("muestra una fila por artículo, sin columna de depósito", () => {
    render(
      <StockGlobalTable
        filas={[
          item({ deposito: 0, codigoArticulo: 10001, nombreProducto: "GLIFOSATO", stockActual: 1600, totalDisponible: 1450 }),
          item({ deposito: 0, codigoArticulo: 10003, nombreProducto: "DICAMBA", stockActual: 870, totalDisponible: 30 }),
        ]}
      />,
    );
    expect(screen.getByText("GLIFOSATO")).toBeInTheDocument();
    expect(screen.getByText("DICAMBA")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Depósito" })).not.toBeInTheDocument();
  });

  it("muestra stock, disponible y valor USD", () => {
    render(<StockGlobalTable filas={[item({ deposito: 0, codigoArticulo: 10003, stockActual: 870, totalDisponible: 30, valorUsd: 10440 })]} />);
    expect(screen.getByText("870")).toBeInTheDocument();
    expect(screen.getByTestId("disponible-0-10003")).toHaveTextContent("30");
    expect(screen.getByText("US$ 10.440,00")).toBeInTheDocument();
  });

  it("marca la sobreventa igual que la tabla por depósito", () => {
    render(<StockGlobalTable filas={[item({ deposito: 0, codigoArticulo: 10080, totalDisponible: -60 })]} />);
    const celda = screen.getByTestId("disponible-0-10080");
    expect(celda).toHaveTextContent("-60");
    expect(celda.className).toContain("text-rojo");
  });

  it("muestra el vacío cuando no hay artículos", () => {
    render(<StockGlobalTable filas={[]} />);
    expect(screen.getByText(/No hay artículos con esos filtros/)).toBeInTheDocument();
  });
});
