import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeStockItem } from "../fakes";
import type { StockItem } from "../types";
import { InmovilizadoTable } from "./inmovilizado-table";

function item(p: Partial<StockItem> & Pick<StockItem, "deposito" | "codigoArticulo">): StockItem {
  return fakeStockItem({
    stockActual: 300,
    precioUsd: 8,
    valorUsd: 2400,
    totalDisponible: 300,
    ventaDiaria: 0,
    diasCobertura: null,
    estado: "Inmovilizado",
    estadoVenc: "Normal",
    diasEnStockMax: 300,
    diasEnStockPromedio: 300,
    semaforoRotacion: "Rojo",
    ...p,
  });
}

describe("InmovilizadoTable", () => {
  it("muestra producto, depósito y rubro", () => {
    render(<InmovilizadoTable filas={[item({ deposito: 0, codigoArticulo: 10010, nombreProducto: "CIPERMETRINA" })]} />);
    expect(screen.getByText("CIPERMETRINA")).toBeInTheDocument();
    expect(screen.getByText("San Jorge")).toBeInTheDocument();
    expect(screen.getByText("HERBICIDAS")).toBeInTheDocument();
  });

  it("muestra stock, días en stock y valor USD", () => {
    render(<InmovilizadoTable filas={[item({ deposito: 0, codigoArticulo: 10010 })]} />);
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("300 d")).toBeInTheDocument();
    expect(screen.getByText(/2\.400,00/)).toBeInTheDocument();
  });

  it("muestra el badge de rotación", () => {
    render(<InmovilizadoTable filas={[item({ deposito: 0, codigoArticulo: 10010 })]} />);
    expect(screen.getByText("Inmovilizado")).toBeInTheDocument();
  });

  it("muestra '—' cuando no hay cobertura ni antigüedad", () => {
    render(
      <InmovilizadoTable
        filas={[item({ deposito: 0, codigoArticulo: 10010, diasCobertura: null, diasEnStockPromedio: null, semaforoRotacion: "SinDato" })]}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("respeta el orden que trae el backend (por valor desc)", () => {
    render(
      <InmovilizadoTable
        filas={[
          item({ deposito: 5, codigoArticulo: 1, nombreProducto: "UREA", valorUsd: 36000 }),
          item({ deposito: 0, codigoArticulo: 2, nombreProducto: "CIPERMETRINA", valorUsd: 2400 }),
        ]}
      />,
    );
    const filas = screen.getAllByRole("row");
    expect(filas[1]).toHaveTextContent("UREA");
    expect(filas[2]).toHaveTextContent("CIPERMETRINA");
  });

  it("muestra el vacío cuando no hay inmovilizados", () => {
    render(<InmovilizadoTable filas={[]} />);
    expect(screen.getByText(/No hay artículos inmovilizados/)).toBeInTheDocument();
  });
});
