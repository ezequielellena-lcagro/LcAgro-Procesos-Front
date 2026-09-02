import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VencimientoDto, VencimientosDto } from "../types";
import { ReportePanel } from "./reporte-panel";

function cuota(over: Partial<VencimientoDto> = {}): VencimientoDto {
  return {
    cuotaId: 1,
    prestamoId: 1,
    fechaVencimiento: "2026-11-09",
    banco: "NACIÓN",
    sucursal: "SAN JORGE",
    linea: "TEDESCHI",
    nroOperacion: "39646384",
    moneda: "USD",
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

function bloque(moneda: "USD" | "ARS", items: VencimientoDto[]): VencimientosDto {
  return {
    moneda,
    items,
    totalCapital: items.reduce((s, i) => s + i.capital, 0),
    totalInteres: items.reduce((s, i) => s + i.interes, 0),
    totalIva: items.reduce((s, i) => s + i.iva, 0),
    totalTotal: items.reduce((s, i) => s + i.total, 0),
  };
}

const USD = bloque("USD", [cuota()]);
const ARS = bloque("ARS", [
  cuota({
    cuotaId: 2,
    moneda: "ARS",
    nroOperacion: "28078142",
    linea: "CAPITAL DE TRABAJO",
    fechaVencimiento: "2027-01-28",
    capital: 7170000,
    interes: 2457836.71,
    iva: 294940.41,
    total: 9922777.12,
    nroCuota: 5,
    cantidadCuotas: 8,
  }),
]);

function renderPanel(over: Partial<Parameters<typeof ReportePanel>[0]> = {}) {
  return render(
    <ReportePanel
      usd={USD}
      ars={ARS}
      cargando={false}
      onDescargarExcel={vi.fn()}
      descargando={false}
      onImprimir={vi.fn()}
      {...over}
    />,
  );
}

/**
 * El reporte en pantalla.
 *
 * Es la hoja que Administración imprime hoy, pero mirable sin bajar un archivo. Sale de los
 * **mismos datos** que el Excel — el mismo endpoint de vencimientos —, así que los dos no pueden
 * decir cosas distintas.
 */
describe("ReportePanel", () => {
  it("muestra los dos bloques, pesos y dólares", () => {
    renderPanel();

    expect(screen.getByRole("region", { name: /préstamos \$/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /préstamos u\$s/i })).toBeInTheDocument();
  });

  it("cada bloque lleva su fila de totales", () => {
    renderPanel();

    // Con una sola cuota el importe aparece dos veces: en su fila y en el TOTAL. El que importa
    // es el del pie — es el número que Administración lee.
    const pie = (nombre: RegExp) =>
      screen.getByRole("region", { name: nombre }).querySelector("tfoot")!;

    expect(within(pie(/préstamos \$/i)).getByText("9.922.777,12")).toBeInTheDocument();
    expect(within(pie(/préstamos u\$s/i)).getByText("36.111,77")).toBeInTheDocument();
  });

  /** El encabezado del Excel dice a qué fecha está el corte; en pantalla tiene que decir lo mismo. */
  it("dice a qué fecha está el reporte", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: /préstamos la clementina/i })).toBeInTheDocument();
  });

  it("se puede bajar el Excel", () => {
    const onDescargarExcel = vi.fn();
    renderPanel({ onDescargarExcel });

    fireEvent.click(screen.getByRole("button", { name: /excel/i }));

    expect(onDescargarExcel).toHaveBeenCalled();
  });

  /** El PDF sale de imprimir esta misma vista: por construcción dice lo mismo que la pantalla. */
  it("se puede imprimir o guardar como PDF", () => {
    const onImprimir = vi.fn();
    renderPanel({ onImprimir });

    fireEvent.click(screen.getByRole("button", { name: /pdf|imprimir/i }));

    expect(onImprimir).toHaveBeenCalled();
  });

  /** Los botones no salen en el papel: son de la pantalla. */
  it("los botones no se imprimen", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: /excel/i }).closest(".no-print")).not.toBeNull();
  });

  /** Una moneda sin vencimientos no dibuja una tabla vacía con un total en cero. */
  it("una moneda sin vencimientos no muestra su bloque", () => {
    renderPanel({ ars: bloque("ARS", []) });

    expect(screen.queryByRole("region", { name: /préstamos \$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /préstamos u\$s/i })).toBeInTheDocument();
  });

  it("mientras carga no muestra números a medias", () => {
    renderPanel({ cargando: true, usd: undefined, ars: undefined });

    expect(screen.queryByRole("region", { name: /préstamos/i })).not.toBeInTheDocument();
  });
});
