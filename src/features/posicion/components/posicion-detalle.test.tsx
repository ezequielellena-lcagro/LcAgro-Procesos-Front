import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PosicionDto } from "../types";
import { PosicionDetalle } from "./posicion-detalle";

function fila(p: Partial<PosicionDto> & Pick<PosicionDto, "campania" | "cereal">): PosicionDto {
  return {
    tnCompra: 0,
    precioCompra: null,
    tnVenta: 0,
    precioVenta: null,
    tnCalzadas: 0,
    margenUsdTn: null,
    margenPct: null,
    resultadoUsd: 0,
    posicionSinAjustes: 0,
    posicionFinal: 0,
    ajustesDetalle: [],
    ...p,
  };
}

describe("PosicionDetalle", () => {
  it("muestra un bloque por campaña, de la más nueva a la más vieja", () => {
    render(
      <PosicionDetalle
        filas={[fila({ campania: "2024-2025", cereal: "Soja" }), fila({ campania: "2025-2026", cereal: "Soja" })]}
      />,
    );
    const titulos = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(titulos).toEqual(["Campaña 2025-2026", "Campaña 2024-2025"]);
  });

  it("renderiza una sub-fila por cada ajuste del cereal", () => {
    render(
      <PosicionDetalle
        filas={[
          fila({
            campania: "2025-2026",
            cereal: "Soja",
            tnCompra: 100,
            tnVenta: 80,
            posicionFinal: 20,
            ajustesDetalle: [
              { tipo: "arrastre", tn: -30, precioUsd: null },
              { tipo: "semilla", tn: -10, precioUsd: 200 },
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Arrastre")).toBeInTheDocument();
    expect(screen.getByText("Semilla")).toBeInTheDocument();
  });

  it("no muestra sub-filas cuando el cereal no tiene ajustes", () => {
    render(<PosicionDetalle filas={[fila({ campania: "2025-2026", cereal: "Girasol", ajustesDetalle: [] })]} />);
    expect(screen.queryByText("Arrastre")).not.toBeInTheDocument();
    expect(screen.queryByText("Semilla")).not.toBeInTheDocument();
  });

  it("marca 'sin ventas cargadas' cuando todas las filas tienen venta 0", () => {
    render(<PosicionDetalle filas={[fila({ campania: "2023-2024", cereal: "Maíz", tnCompra: 100, tnVenta: 0 })]} />);
    expect(screen.getByText("sin ventas cargadas")).toBeInTheDocument();
  });
});
