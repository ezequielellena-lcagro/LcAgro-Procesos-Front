import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvanceBar } from "./avance-bar";

describe("AvanceBar", () => {
  it("distingue un real no disponible de un objetivo faltante", () => {
    render(<AvanceBar avance={null} esperado={0.4} motivoIndisponible="sin dato actual" />);

    expect(screen.getByText("sin dato actual")).toBeInTheDocument();
    expect(screen.queryByText("sin objetivo")).not.toBeInTheDocument();
  });
});
