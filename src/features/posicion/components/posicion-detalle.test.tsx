import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PosicionDto } from "../types";
import { PosicionDetalle } from "./posicion-detalle";

function fila(p: Partial<PosicionDto> & Pick<PosicionDto, "campania" | "cereal">): PosicionDto {
  const base = {
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
  // Por defecto el consolidado = lo que da el sistema (caso sin ajustes), como en la realidad.
  return {
    ...base,
    tnCompraTotal: p.tnCompraTotal ?? base.tnCompra,
    precioCompraTotal: p.precioCompraTotal ?? base.precioCompra,
    tnVentaTotal: p.tnVentaTotal ?? base.tnVenta,
    precioVentaTotal: p.precioVentaTotal ?? base.precioVenta,
    margenTotalUsdTn: p.margenTotalUsdTn ?? null,
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

  it("el título del cereal lleva el TOTAL consolidado y debajo el desglose de dónde sale", () => {
    // Trigo 2024-2025 de la planilla del cliente: el sistema da 6.189 de venta, pero el total es 8.485
    // (con arrastre 295 + semilla 1.880). El cliente controla el total arriba y el desglose abajo.
    render(
      <PosicionDetalle
        filas={[
          fila({
            campania: "2024-2025",
            cereal: "Trigo",
            tnCompra: 8215,
            precioCompra: 201.95,
            tnVenta: 6189,
            precioVenta: 203.3,
            tnCompraTotal: 8215,
            precioCompraTotal: 201.95,
            tnVentaTotal: 8485,
            precioVentaTotal: 209.4,
            posicionFinal: -270,
            ajustesDetalle: [
              { tipo: "arrastre", tn: -295, precioUsd: 240.4 },
              { tipo: "semilla", tn: -1880, precioUsd: 222.9 },
            ],
          }),
        ]}
      />,
    );

    const titulo = screen.getByText("Trigo").closest("tr");
    expect(titulo).toHaveTextContent("8.485"); // el TOTAL, no la venta cruda
    expect(titulo).toHaveTextContent("-270");

    const sistema = screen.getByText("del sistema").closest("tr");
    expect(sistema).toHaveTextContent("6.189"); // lo que da MacroGest, para poder controlarlo
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

  it("calcula la fila Total por campaña (suma compra, venta y posición)", () => {
    render(
      <PosicionDetalle
        filas={[
          fila({ campania: "2025-2026", cereal: "Soja", tnCompra: 100, tnVenta: 60, posicionFinal: 40 }),
          fila({ campania: "2025-2026", cereal: "Maíz", tnCompra: 50, tnVenta: 20, posicionFinal: 30 }),
        ]}
      />,
    );
    const totalRow = screen.getByText("Total").closest("tr");
    expect(totalRow).not.toBeNull();
    expect(totalRow).toHaveTextContent("150"); // compra 100 + 50
    expect(totalRow).toHaveTextContent("80"); //  venta 60 + 20
    expect(totalRow).toHaveTextContent("70"); //  posición 40 + 30
  });
});
