import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AFijarDetalleDto } from "../types";
import { FijacionVencidaCard } from "./fijacion-vencida-card";
import { PorCompradorCard } from "./por-comprador-card";

function fila(p: Partial<AFijarDetalleDto> & Pick<AFijarDetalleDto, "comprador" | "aFijarTn">): AFijarDetalleDto {
  return {
    cereal: "Soja",
    contrato: "C-1",
    campania: "20252026",
    vtoFijacion: null,
    diasParaVto: null,
    estado: "Verde",
    directo: true,
    ...p,
  };
}

describe("PorCompradorCard", () => {
  it("muestra el ranking por comprador y el reparto por canal", () => {
    const { container } = render(
      <PorCompradorCard
        filas={[
          fila({ comprador: "EXPORTADORA", aFijarTn: 10000, directo: true }),
          fila({ comprador: "ACOPIO", aFijarTn: 5552, directo: false }),
        ]}
      />,
    );
    expect(screen.getByText("A fijar por comprador")).toBeInTheDocument();
    expect(screen.getByText("EXPORTADORA")).toBeInTheDocument();
    expect(screen.getByText("ACOPIO")).toBeInTheDocument();
    // El reparto por canal (directo vs. corredor) está presente.
    expect(container.textContent).toContain("directo");
    expect(container.textContent).toContain("por corredor");
  });
});

describe("FijacionVencidaCard", () => {
  it("lista solo lo vencido, ordenado por tn, y encabeza con el total", () => {
    render(
      <FijacionVencidaCard
        filas={[
          fila({ comprador: "AL DIA", aFijarTn: 9999, estado: "Verde" }),
          fila({ comprador: "VENCIDO CHICO", aFijarTn: 100, estado: "Vencido", contrato: "V1" }),
          fila({ comprador: "VENCIDO GRANDE", aFijarTn: 4281, estado: "Vencido", contrato: "V2" }),
        ]}
      />,
    );

    expect(screen.getByText("4.381 tn")).toBeInTheDocument(); // total vencido, no incluye "AL DIA"
    expect(screen.queryByText("AL DIA")).not.toBeInTheDocument();

    const filasLi = screen.getAllByRole("listitem");
    expect(filasLi[0]).toHaveTextContent("VENCIDO GRANDE");
  });

  it("estado vacío positivo cuando no hay vencidos", () => {
    render(<FijacionVencidaCard filas={[fila({ comprador: "AL DIA", aFijarTn: 100, estado: "Verde" })]} />);
    expect(screen.getByText(/Ningún contrato con fijación vencida/i)).toBeInTheDocument();
  });
});
