import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TotalesStock } from "../types";
import { StockKpis } from "./stock-kpis";

const totales: TotalesStock = {
  cantidadArticulos: 207,
  valorUsdTotal: 6588852,
  valorUsdInmovilizado: 1200000,
  pctInmovilizado: 18.2,
  cantidadRiesgoQuiebre: 14,
};

describe("StockKpis", () => {
  it("muestra la cantidad de artículos", () => {
    render(<StockKpis totales={totales} />);
    expect(screen.getByText("207")).toBeInTheDocument();
  });

  it("muestra el valor USD total formateado", () => {
    render(<StockKpis totales={totales} />);
    expect(screen.getByText(/6\.588\.852/)).toBeInTheDocument();
  });

  it("muestra la cantidad en riesgo de quiebre", () => {
    render(<StockKpis totales={totales} />);
    expect(screen.getByText("14")).toBeInTheDocument();
  });
});
