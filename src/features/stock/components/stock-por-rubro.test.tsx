import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RubroValor } from "../types";
import { StockPorRubro } from "./stock-por-rubro";

const datos: RubroValor[] = [
  { rubro: 200, rubroDesc: "HERBICIDAS", valorUsd: 3000000 },
  { rubro: 207, rubroDesc: "FERTILIZANTES", valorUsd: 1500000 },
];

describe("StockPorRubro", () => {
  it("renderiza una fila por rubro con su descripción", () => {
    render(<StockPorRubro porRubro={datos} />);
    expect(screen.getByText("HERBICIDAS")).toBeInTheDocument();
    expect(screen.getByText("FERTILIZANTES")).toBeInTheDocument();
  });

  it("la barra del rubro de mayor valor ocupa el 100% del ancho", () => {
    render(<StockPorRubro porRubro={datos} />);
    const barra = screen.getByTestId("barra-200");
    expect(barra.style.width).toBe("100%");
  });

  it("no renderiza nada si no hay rubros", () => {
    const { container } = render(<StockPorRubro porRubro={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
