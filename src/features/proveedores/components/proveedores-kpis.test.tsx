import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fecha, usd } from "@/shared/format/format";
import type { TotalesProveedores, TramoDto } from "../types";
import { ProveedoresKpis } from "./proveedores-kpis";

const TRAMOS: TramoDto[] = [
  { etiqueta: "Hasta 31-08-2026", desde: null, hasta: "2026-08-31" },
  { etiqueta: "01-09 → 30-09-2026", desde: "2026-08-31", hasta: "2026-09-30" },
];

const TOTALES: TotalesProveedores = {
  montos: [12000, 25000],
  saldoTotal: 87000,
  vencidoHoy: 4521.9,
  proveedores: 87,
};

// A propósito `hoy` NO cae en un fin de mes (que es lo que sería `fechaBase`): si alguien le pasara
// `fechaBase` en vez de `hoy` a `ProveedoresKpis`, TypeScript no lo detecta (los dos son `string`),
// pero esta fecha lo delata porque no coincide con el corte de ningún tramo.
const HOY = "2026-09-13";

describe("ProveedoresKpis", () => {
  it("el KPI 'Vencido hoy' muestra totales.vencidoHoy y un hint con la fecha de `hoy` (no `fechaBase`)", () => {
    render(<ProveedoresKpis tramos={TRAMOS} totales={TOTALES} hoy={HOY} />);

    const label = screen.getByText("Vencido hoy");
    const card = label.parentElement as HTMLElement;

    expect(within(card).getByText(usd(TOTALES.vencidoHoy))).toBeInTheDocument();

    const hint = within(card).getByText(/memo, no suma/i);
    expect(hint).toHaveTextContent(fecha(HOY));
  });
});
