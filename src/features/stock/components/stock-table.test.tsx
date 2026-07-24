import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeStockItem as item } from "../fakes";
import type { StockItem } from "../types";
import { StockTable } from "./stock-table";

const filas: StockItem[] = [
  item({ deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 1, nombreProducto: "GLIFOSATO", valorUsd: 500 }),
  item({ deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 2, nombreProducto: "ATRAZINA", valorUsd: 300 }),
  item({ deposito: 44, depositoNombre: "Adama", tipoDeposito: "Consignado", codigoArticulo: 3, nombreProducto: "UREA", valorUsd: 1000, estado: "Inmovilizado", diasCobertura: null }),
];

/** El caso real: 870 en el galpón, 840 ya vendidos → 30 disponibles con "20 días de cobertura". */
const dicamba = item({
  deposito: 0,
  codigoArticulo: 10003,
  nombreProducto: "DICAMBA",
  stockActual: 870,
  ventaFacturados: 600,
  ventaSinFacturar: 240,
  totalDisponible: 30,
  diasCobertura: 20,
});

describe("StockTable", () => {
  it("muestra un encabezado de grupo por depósito con código y nombre", () => {
    render(<StockTable filas={filas} />);
    expect(screen.getByRole("button", { name: /Depósito 0 — San Jorge/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Depósito 44 — Adama/ })).toBeInTheDocument();
  });

  it("muestra el badge de tipo en el encabezado de grupo", () => {
    render(<StockTable filas={filas} />);
    expect(screen.getByText("Propio")).toBeInTheDocument();
    expect(screen.getByText("Consignado")).toBeInTheDocument();
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

  it("el subtotal del grupo suma el valor USD de sus artículos", () => {
    render(<StockTable filas={filas} />);
    // 500 + 300 en San Jorge; Adama va solo con 1.000.
    expect(screen.getByRole("button", { name: /Depósito 0/ })).toHaveTextContent("2 art. · US$ 800,00");
    expect(screen.getByRole("button", { name: /Depósito 44/ })).toHaveTextContent("1 art. · US$ 1.000,00");
  });
});

describe("StockTable — disponibilidad", () => {
  it("muestra la columna Disponible", () => {
    render(<StockTable filas={[dicamba]} />);
    expect(screen.getByRole("columnheader", { name: "Disponible" })).toBeInTheDocument();
    expect(screen.getByTestId("disponible-0-10003")).toHaveTextContent("30");
  });

  it("explica la cuenta del disponible en el title", () => {
    render(<StockTable filas={[dicamba]} />);
    expect(screen.getByTestId("disponible-0-10003")).toHaveAttribute(
      "title",
      "870 en stock + 0 por llegar − 840 comprometido = 30",
    );
  });

  it("muestra el comprometido agrupado con el desglose en el title", () => {
    render(<StockTable filas={[dicamba]} />);
    const celda = screen.getByTitle("Facturado: 600 · Sin facturar: 240");
    expect(celda).toHaveTextContent("840");
  });

  it("muestra los pedidos de compra por llegar", () => {
    render(<StockTable filas={[item({ deposito: 0, codigoArticulo: 7, stockActual: 0, pedidosCompras: 800, totalDisponible: 800 })]} />);
    expect(screen.getByRole("columnheader", { name: "Por llegar" })).toBeInTheDocument();
    expect(screen.getByTestId("disponible-0-7")).toHaveTextContent("800");
  });

  it("pinta el disponible en rojo cuando hay sobreventa", () => {
    render(
      <StockTable
        filas={[item({ deposito: 45, codigoArticulo: 10080, stockActual: 90, ventaFacturados: 120, ventaSinFacturar: 30, totalDisponible: -60 })]}
      />,
    );
    const celda = screen.getByTestId("disponible-45-10080");
    expect(celda).toHaveTextContent("-60");
    expect(celda.className).toContain("text-rojo");
    expect(celda).toHaveAttribute("title", expect.stringContaining("Sobreventa"));
  });

  it("no pinta de rojo un disponible positivo", () => {
    render(<StockTable filas={[dicamba]} />);
    expect(screen.getByTestId("disponible-0-10003").className).not.toContain("text-rojo");
  });
});
