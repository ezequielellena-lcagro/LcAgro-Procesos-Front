import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VencimientoDto, VencimientosDto } from "../types";
import { VencimientosTable } from "./vencimientos-table";

function fila(over: Partial<VencimientoDto> = {}): VencimientoDto {
  return {
    cuotaId: 1,
    prestamoId: 1,
    fechaVencimiento: "2026-11-09",
    banco: "NACIÓN",
    sucursal: "SAN JORGE",
    linea: "TEDESCHI",
    nroOperacion: "39646384",
    nroCuota: 1,
    cantidadCuotas: 10,
    capital: 31350,
    interes: 4251.58,
    iva: 510.19,
    total: 36111.77,
    tasaNominalAnual: 2.75,
    estado: "Pendiente",
    vencida: false,
    ...over,
  };
}

/** Los totales los manda el backend: son del set filtrado completo, no de lo que se ve. */
const DATOS: VencimientosDto = {
  moneda: "USD",
  items: [fila()],
  totalCapital: 2508690.49,
  totalInteres: 82813.09,
  totalIva: 9898.72,
  totalTotal: 2601402.3,
};

describe("VencimientosTable", () => {
  it("muestra una fila por cuota con su operación y su número de cuota", () => {
    render(<VencimientosTable datos={DATOS} onPagar={vi.fn()} puedeGestionar />);

    expect(screen.getByText("NACIÓN")).toBeInTheDocument();
    expect(screen.getByText("TEDESCHI")).toBeInTheDocument();
    expect(screen.getByText("39646384")).toBeInTheDocument();
    expect(screen.getByText("1/10")).toBeInTheDocument();
  });

  /**
   * El total lo calcula el backend sobre TODO lo filtrado. Si la tabla sumara sus filas, con
   * cualquier filtro el pie diría otra cosa que el KPI — que es exactamente el bug que tenía el
   * Excel entre la hoja maestra y las tablas dinámicas.
   */
  it("usa los totales del backend, no la suma de las filas visibles", () => {
    render(<VencimientosTable datos={DATOS} onPagar={vi.fn()} puedeGestionar />);

    const pie = screen.getByRole("row", { name: /TOTAL/ });
    expect(within(pie).getByText(/2\.601\.402,30/)).toBeInTheDocument();
    expect(within(pie).getByText(/2\.508\.690,49/)).toBeInTheDocument();
  });

  it("marca las cuotas vencidas impagas", () => {
    render(
      <VencimientosTable
        datos={{ ...DATOS, items: [fila({ vencida: true })] }}
        onPagar={vi.fn()}
        puedeGestionar
      />,
    );

    expect(screen.getByTitle("Vencida e impaga")).toBeInTheDocument();
  });

  it("muestra las cuotas pagadas con su fecha en vez del botón de pago", () => {
    render(
      <VencimientosTable
        datos={{ ...DATOS, items: [fila({ estado: "Pagada" })] }}
        onPagar={vi.fn()}
        puedeGestionar
      />,
    );

    expect(screen.getByText("Pagada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagar" })).not.toBeInTheDocument();
  });

  it("no ofrece pagar a quien sólo puede mirar", () => {
    render(<VencimientosTable datos={DATOS} onPagar={vi.fn()} puedeGestionar={false} />);

    expect(screen.queryByRole("button", { name: "Pagar" })).not.toBeInTheDocument();
  });

  it("avisa cuando no hay vencimientos en vez de mostrar una tabla vacía", () => {
    render(<VencimientosTable datos={{ ...DATOS, items: [] }} onPagar={vi.fn()} puedeGestionar />);

    expect(screen.getByText(/No hay vencimientos/i)).toBeInTheDocument();
  });

  it("muestra los importes en la moneda del calendario", () => {
    render(
      <VencimientosTable
        datos={{ ...DATOS, moneda: "ARS", items: [fila({ capital: 25000000 })] }}
        onPagar={vi.fn()}
        puedeGestionar
      />,
    );

    // En pesos no puede decir "US$": son dos calendarios distintos que nunca se mezclan.
    expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
  });
});
