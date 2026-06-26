import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EstadoBadge } from "./estado-badge";

describe("EstadoBadge", () => {
  it("muestra 'OK' para estado Ok", () => {
    render(<EstadoBadge estado="Ok" />);
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("muestra 'Riesgo quiebre' para RiesgoQuiebre", () => {
    render(<EstadoBadge estado="RiesgoQuiebre" />);
    expect(screen.getByText("Riesgo quiebre")).toBeInTheDocument();
  });

  it("muestra 'Inmovilizado' para Inmovilizado", () => {
    render(<EstadoBadge estado="Inmovilizado" />);
    expect(screen.getByText("Inmovilizado")).toBeInTheDocument();
  });
});
