import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ESTADO_CONTADO_META } from "../estado-contado";
import type { EstadoContado } from "../types";
import { EstadoContadoBadge, EstadoContadoSemaforo } from "./estado-contado-badge";

const TODOS: EstadoContado[] = ["Mora", "AVencer", "AlDia", "PagoTarde", "PagadaEnPlazo", "SaldadaPorCanje"];

describe("EstadoContadoBadge", () => {
  it("muestra la etiqueta de cada estado", () => {
    for (const estado of TODOS) {
      const { unmount } = render(<EstadoContadoBadge estado={estado} />);
      expect(screen.getByText(ESTADO_CONTADO_META[estado].label)).toBeInTheDocument();
      unmount();
    }
  });
});

describe("EstadoContadoSemaforo", () => {
  it("Mora → punto rojo + etiqueta accesible", () => {
    const { container } = render(<EstadoContadoSemaforo estado="Mora" />);
    expect(container.querySelector(".bg-rojo")).not.toBeNull();
    expect(screen.getByText("En mora")).toBeInTheDocument();
  });

  it("AVencer → punto amarillo (clementina)", () => {
    const { container } = render(<EstadoContadoSemaforo estado="AVencer" />);
    expect(container.querySelector(".bg-clementina-deep")).not.toBeNull();
  });

  it("AlDia → punto verde", () => {
    const { container } = render(<EstadoContadoSemaforo estado="AlDia" />);
    expect(container.querySelector(".bg-verde")).not.toBeNull();
  });

  it("un estado 'cerrado' cae en su semáforo (SaldadaPorCanje → verde)", () => {
    const { container } = render(<EstadoContadoSemaforo estado="SaldadaPorCanje" />);
    expect(container.querySelector(".bg-verde")).not.toBeNull();
  });
});
