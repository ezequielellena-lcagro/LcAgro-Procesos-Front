import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TotalesStock } from "../types";
import { StockKpis } from "./stock-kpis";

const totales: TotalesStock = {
  cantidadArticulos: 207,
  valorUsdTotal: 6588852,
  valorUsdPropio: 5000000,
  valorUsdConsignado: 1588852,
  valorUsdInmovilizado: 1200000,
  pctInmovilizado: 18.2,
  cantidadRiesgoQuiebre: 14,
  cantidadBajoMinimo: 9,
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

  it("muestra el desglose propio/consignado", () => {
    render(<StockKpis totales={totales} />);
    expect(screen.getByText(/Propio US\$ 5\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Consignado US\$ 1\.588\.852/)).toBeInTheDocument();
  });

  it("muestra la cantidad en riesgo de quiebre", () => {
    render(<StockKpis totales={totales} />);
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("muestra la cantidad bajo mínimo", () => {
    render(<StockKpis totales={totales} />);
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});
