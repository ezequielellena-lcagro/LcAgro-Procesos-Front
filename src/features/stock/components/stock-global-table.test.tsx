import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeStockItem as item } from "../fakes";
import { StockGlobalTable } from "./stock-global-table";

describe("StockGlobalTable", () => {
  it("muestra una fila por artículo, sin columna de depósito", () => {
    render(
      <StockGlobalTable
        filas={[
          item({ deposito: 0, codigoArticulo: 10001, nombreProducto: "GLIFOSATO", stockActual: 1600, ventaFacturados: 150 }),
          item({ deposito: 0, codigoArticulo: 10003, nombreProducto: "DICAMBA", stockActual: 870, ventaFacturados: 600, ventaSinFacturar: 240 }),
        ]}
      />,
    );
    expect(screen.getByText("GLIFOSATO")).toBeInTheDocument();
    expect(screen.getByText("DICAMBA")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Depósito" })).not.toBeInTheDocument();
  });

  it("muestra stock, disponible y valor USD", () => {
    render(
      <StockGlobalTable
        filas={[
          item({ deposito: 0, codigoArticulo: 10003, stockActual: 870, ventaFacturados: 600, ventaSinFacturar: 240, valorUsd: 10440 }),
        ]}
      />,
    );
    expect(screen.getByText("870")).toBeInTheDocument();
    expect(screen.getByTestId("disponible-0-10003")).toHaveTextContent("30");
    expect(screen.getByText("US$ 10.440,00")).toBeInTheDocument();
  });

  it("marca la sobreventa igual que la tabla por depósito", () => {
    // El −60 sale de la aritmética del contrato (90 − 120 − 30), no de un campo puesto a mano.
    render(
      <StockGlobalTable
        filas={[item({ deposito: 0, codigoArticulo: 10080, stockActual: 90, ventaFacturados: 120, ventaSinFacturar: 30 })]}
      />,
    );
    const celda = screen.getByTestId("disponible-0-10080");
    expect(celda).toHaveTextContent("-60");
    expect(celda.className).toContain("text-rojo");
  });

  /**
   * Regresión: la key era solo el código de artículo, único únicamente DENTRO del modo consolidado.
   * Un render con filas por depósito (el placeholder de la solapa anterior) generaba dos hijos con
   * la misma key y React lo grita por consola en vez de romper.
   */
  it("no colisiona la key cuando el mismo artículo llega en dos depósitos", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <StockGlobalTable
        filas={[
          item({ deposito: 0, codigoArticulo: 10001, nombreProducto: "GLIFOSATO SJ" }),
          item({ deposito: 5, codigoArticulo: 10001, nombreProducto: "GLIFOSATO SF" }),
        ]}
      />,
    );
    expect(screen.getByText("GLIFOSATO SJ")).toBeInTheDocument();
    expect(screen.getByText("GLIFOSATO SF")).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("muestra el vacío cuando no hay artículos", () => {
    render(<StockGlobalTable filas={[]} />);
    expect(screen.getByText(/No hay artículos con esos filtros/)).toBeInTheDocument();
  });
});
