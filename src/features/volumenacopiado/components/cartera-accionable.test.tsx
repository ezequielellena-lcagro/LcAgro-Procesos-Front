import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ClienteCartera } from "../types";
import { CarteraAccionable } from "./cartera-accionable";

function cliente(p: Partial<ClienteCartera> & Pick<ClienteCartera, "numero" | "cliente">): ClienteCartera {
  return {
    tn: 0,
    tnPico: 0,
    campaniaPico: "2023-2024",
    estado: "Dormido",
    historia: {},
    ...p,
  };
}

describe("CarteraAccionable", () => {
  it("reactivar: suma el pico como toneladas recuperables y ordena por oportunidad", () => {
    render(
      <CarteraAccionable
        variante="reactivar"
        clientes={[
          cliente({ numero: 1, cliente: "LA DEMO CHICA", tn: 0, tnPico: 610, campaniaPico: "2022-2023" }),
          cliente({ numero: 2, cliente: "DON DEMO GRANDE", tn: 0, tnPico: 950, campaniaPico: "2023-2024" }),
        ]}
      />,
    );

    expect(screen.getByText("Reactivar")).toBeInTheDocument();
    // 950 + 610 = 1.560 recuperables
    expect(screen.getByText("1.560 tn")).toBeInTheDocument();
    expect(screen.getByText("recuperables")).toBeInTheDocument();

    // El de mayor pico va primero.
    const filas = screen.getAllByRole("listitem");
    expect(within(filas[0]).getByText("DON DEMO GRANDE")).toBeInTheDocument();
    expect(within(filas[1]).getByText("LA DEMO CHICA")).toBeInTheDocument();
  });

  it("defender: mide la brecha contra el pico y ordena por lo que más se está yendo", () => {
    render(
      <CarteraAccionable
        variante="defender"
        clientes={[
          cliente({ numero: 3, cliente: "PROD MEDIO", tn: 808, tnPico: 1200, estado: "Declinante" }), // brecha 392
          cliente({ numero: 4, cliente: "CAMPO EN CAIDA", tn: 420, tnPico: 1050, estado: "Declinante" }), // brecha 630
        ]}
      />,
    );

    expect(screen.getByText("Defender")).toBeInTheDocument();
    // 392 + 630 = 1.022 en riesgo
    expect(screen.getByText("1.022 tn")).toBeInTheDocument();
    expect(screen.getByText("en riesgo")).toBeInTheDocument();

    // Muestra la brecha contra el pico y ordena la mayor primero.
    expect(screen.getByText("−630 vs. pico")).toBeInTheDocument();
    const filas = screen.getAllByRole("listitem");
    expect(within(filas[0]).getByText("CAMPO EN CAIDA")).toBeInTheDocument();
  });

  it("dibuja un sparkline por cliente cuando hay al menos dos períodos de historia", () => {
    const { container } = render(
      <CarteraAccionable
        variante="reactivar"
        clientes={[
          cliente({
            numero: 5,
            cliente: "CON HISTORIA",
            tnPico: 900,
            historia: { "2023-2024": 900, "2024-2025": 400, "2025-2026": 0 },
          }),
        ]}
      />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("estado vacío positivo cuando no hay clientes en la categoría", () => {
    render(<CarteraAccionable variante="reactivar" clientes={[]} />);
    expect(screen.getByText(/cartera está bien cubierta/i)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
