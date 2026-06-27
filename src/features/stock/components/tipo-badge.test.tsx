import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TipoBadge } from "./tipo-badge";

describe("TipoBadge", () => {
  it("muestra 'Propio' para tipo Propio", () => {
    render(<TipoBadge tipo="Propio" />);
    expect(screen.getByText("Propio")).toBeInTheDocument();
  });

  it("muestra 'Consignado' para tipo Consignado", () => {
    render(<TipoBadge tipo="Consignado" />);
    expect(screen.getByText("Consignado")).toBeInTheDocument();
  });
});
