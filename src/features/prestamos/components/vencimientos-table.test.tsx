import { fireEvent, render, screen, within } from "@testing-library/react";
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

/**
 * El contenido de una columna, sólo de las filas de datos: se saltean el encabezado, el pie de
 * totales y los títulos de grupo (que son `<th>` y por eso no tienen celdas).
 */
function columnaDelCuerpo(indice: number): (string | null)[] {
  return screen
    .getAllByRole("row")
    .filter((tr) => tr.closest("tbody"))
    .map((tr) => within(tr).queryAllByRole("cell"))
    .filter((celdas) => celdas.length > 1)
    .map((celdas) => celdas[indice].textContent);
}

describe("VencimientosTable", () => {
  it("muestra una fila por cuota con su operación y su número de cuota", () => {
    render(<VencimientosTable datos={DATOS} onPagar={vi.fn()} puedeGestionar agrupacion="ninguna" />);

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
    render(<VencimientosTable datos={DATOS} onPagar={vi.fn()} puedeGestionar agrupacion="ninguna" />);

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
        agrupacion="ninguna"
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
        agrupacion="ninguna"
      />,
    );

    expect(screen.getByText("Pagada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagar" })).not.toBeInTheDocument();
  });

  it("no ofrece pagar a quien sólo puede mirar", () => {
    render(<VencimientosTable datos={DATOS} onPagar={vi.fn()} puedeGestionar={false} agrupacion="ninguna" />);

    expect(screen.queryByRole("button", { name: "Pagar" })).not.toBeInTheDocument();
  });

  it("avisa cuando no hay vencimientos en vez de mostrar una tabla vacía", () => {
    render(<VencimientosTable datos={{ ...DATOS, items: [] }} onPagar={vi.fn()} puedeGestionar agrupacion="ninguna" />);

    expect(screen.getByText(/No hay vencimientos/i)).toBeInTheDocument();
  });

  it("muestra los importes en la moneda del calendario", () => {
    render(
      <VencimientosTable
        datos={{ ...DATOS, moneda: "ARS", items: [fila({ capital: 25000000 })] }}
        onPagar={vi.fn()}
        puedeGestionar
        agrupacion="ninguna"
      />,
    );

    // En pesos no puede decir "US$": son dos calendarios distintos que nunca se mezclan.
    expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
  });

  /**
   * El caso real que motivó la agrupación: los dos préstamos de Nación en pesos vencen el mismo
   * día, así que en el calendario sus cuotas quedan intercaladas de a pares.
   */
  it("agrupada por operación, las cuotas de cada préstamo quedan juntas", () => {
    const items = [
      fila({ cuotaId: 1, nroOperacion: "28078488", fechaVencimiento: "2027-01-28", total: 30646027.4 }),
      fila({ cuotaId: 2, nroOperacion: "28078142", fechaVencimiento: "2027-01-28", total: 9922777.12 }),
      fila({ cuotaId: 3, nroOperacion: "28078488", fechaVencimiento: "2027-07-28", total: 29165479.45 }),
      fila({ cuotaId: 4, nroOperacion: "28078142", fechaVencimiento: "2027-07-28", total: 9200921.17 }),
    ];
    render(
      <VencimientosTable
        datos={{ ...DATOS, moneda: "ARS", items }}
        onPagar={vi.fn()}
        puedeGestionar
        agrupacion="operacion"
      />,
    );

    // Los vacíos son la fila de subtotal con la que cierra cada grupo. Los grupos salen por
    // número de operación porque es el orden con el que abre la tabla.
    expect(columnaDelCuerpo(4)).toEqual([
      "28078142", "28078142", "",
      "28078488", "28078488", "",
    ]);
  });

  it("cada grupo dice de qué préstamo es y cuántas cuotas tiene", () => {
    render(
      <VencimientosTable
        datos={DATOS}
        onPagar={vi.fn()}
        puedeGestionar
        agrupacion="operacion"
      />,
    );

    expect(screen.getByText(/NACIÓN · 39646384 · TEDESCHI — 1 cuota/)).toBeInTheDocument();
  });

  it("cada grupo cierra con su subtotal", () => {
    const items = [
      fila({ cuotaId: 1, total: 100 }),
      fila({ cuotaId: 2, total: 250, fechaVencimiento: "2027-05-10" }),
    ];
    render(
      <VencimientosTable
        datos={{ ...DATOS, items }}
        onPagar={vi.fn()}
        puedeGestionar
        agrupacion="operacion"
      />,
    );

    const subtotal = screen.getByText(/Subtotal/).closest("tr")!;
    expect(within(subtotal).getAllByRole("cell")[9]).toHaveTextContent("350,00");
  });

  /** Sin número de operación no se pueden fusionar dos préstamos distintos del mismo banco. */
  it("los préstamos sin número de operación no se mezclan entre sí", () => {
    const items = [
      fila({ cuotaId: 1, prestamoId: 10, nroOperacion: null }),
      fila({ cuotaId: 2, prestamoId: 11, nroOperacion: null }),
    ];
    render(
      <VencimientosTable
        datos={{ ...DATOS, items }}
        onPagar={vi.fn()}
        puedeGestionar
        agrupacion="operacion"
      />,
    );

    expect(screen.getAllByText(/sin n° de operación/)).toHaveLength(2);
  });

  it("se puede reordenar por una columna clickeando su encabezado", () => {
    const items = [
      fila({ cuotaId: 1, banco: "SANTANDER", fechaVencimiento: "2026-11-09" }),
      fila({ cuotaId: 2, banco: "GALICIA", fechaVencimiento: "2027-05-10" }),
    ];
    render(
      <VencimientosTable
        datos={{ ...DATOS, items }}
        onPagar={vi.fn()}
        puedeGestionar
        agrupacion="ninguna"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /banco/i }));

    expect(columnaDelCuerpo(1)).toEqual(["GALICIA", "SANTANDER"]);
  });
});
