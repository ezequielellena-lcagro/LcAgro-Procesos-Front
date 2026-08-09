import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResumenPrestamos } from "../types";
import { ResumenMatriz } from "./resumen-matriz";

const DATOS: ResumenPrestamos = {
  moneda: "USD",
  periodos: ["2026-10", "2026-11"],
  filas: [
    { banco: "GALICIA", montos: [200, 0], total: 200 },
    { banco: "NACIÓN", montos: [0, 36111.77], total: 36111.77 },
  ],
  totalesPorPeriodo: [200, 36111.77],
  totalGeneral: 36311.77,
};

function renderMatriz(over: Partial<Parameters<typeof ResumenMatriz>[0]> = {}) {
  return render(
    <ResumenMatriz
      datos={DATOS}
      agrupacion="mes"
      onAgrupacionChange={vi.fn()}
      cargando={false}
      {...over}
    />,
  );
}

describe("ResumenMatriz", () => {
  it("arma una columna por período y una fila por banco", () => {
    renderMatriz();

    expect(screen.getByRole("columnheader", { name: "oct 2026" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "nov 2026" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "GALICIA" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "NACIÓN" })).toBeInTheDocument();
  });

  it("pone el monto de cada banco en la columna que le toca", () => {
    renderMatriz();

    const nacion = screen.getByRole("cell", { name: "NACIÓN" }).closest("tr")!;
    // Banco · oct · nov · total: el mes sin vencimiento va vacío, no en cero.
    const celdas = within(nacion).getAllByRole("cell");
    expect(celdas[1]).toHaveTextContent("");
    expect(celdas[2]).toHaveTextContent("36.111,77");
  });

  it("muestra el total de cada banco y el de cada período", () => {
    renderMatriz();

    const galicia = screen.getByRole("cell", { name: "GALICIA" }).closest("tr")!;
    expect(within(galicia).getAllByRole("cell").at(-1)).toHaveTextContent("200,00");

    // El pie: un total por período, en la misma columna que la que totaliza.
    const pie = screen.getByText("Total general").closest("tr")!;
    const celdasPie = within(pie).getAllByRole("cell");
    expect(celdasPie[1]).toHaveTextContent("200,00");
    expect(celdasPie[2]).toHaveTextContent("36.111,77");
  });

  it("cierra con el total general, que es el mismo del calendario", () => {
    renderMatriz();

    const pie = screen.getByText("Total general").closest("tr")!;
    expect(within(pie).getAllByRole("cell").at(-1)).toHaveTextContent("36.311,77");
  });

  it("muestra el símbolo de la moneda para que no se lean pesos como dólares", () => {
    renderMatriz();
    expect(screen.getByText(/U\$S/)).toBeInTheDocument();
  });

  it("con agrupación por fecha rotula las columnas con el día exacto", () => {
    renderMatriz({
      agrupacion: "fecha",
      datos: {
        ...DATOS,
        periodos: ["2026-10-15", "2026-11-09"],
      },
    });

    expect(screen.getByRole("columnheader", { name: "15/10/26" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "09/11/26" })).toBeInTheDocument();
  });

  it("permite cambiar la agrupación", () => {
    const onAgrupacionChange = vi.fn();
    renderMatriz({ onAgrupacionChange });

    fireEvent.change(screen.getByLabelText(/agrupar/i), { target: { value: "fecha" } });

    expect(onAgrupacionChange).toHaveBeenCalledWith("fecha");
  });

  it("sin vencimientos lo dice, en vez de mostrar una tabla vacía", () => {
    renderMatriz({
      datos: {
        moneda: "USD",
        periodos: [],
        filas: [],
        totalesPorPeriodo: [],
        totalGeneral: 0,
      },
    });

    expect(screen.getByText(/no hay vencimientos/i)).toBeInTheDocument();
  });

  it("mientras carga no muestra la tabla vieja como si fuera la nueva", () => {
    renderMatriz({ datos: undefined, cargando: true });

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
