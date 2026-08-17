import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniBarChart } from "./mini-bar-chart";
import { Sparkline } from "./sparkline";

describe("MiniBarChart", () => {
  it("muestra una fila por dato con su etiqueta y valor formateado", () => {
    render(
      <MiniBarChart
        rows={[
          { label: "2024-2025", value: 2100 },
          { label: "2025-2026", value: 2308, highlight: true },
        ]}
        unit="tn"
      />,
    );
    expect(screen.getByText("2024-2025")).toBeInTheDocument();
    expect(screen.getByText(/2\.100 tn/)).toBeInTheDocument();
    expect(screen.getByText(/2\.308 tn/)).toBeInTheDocument();
  });
});

describe("Sparkline", () => {
  it("no dibuja nada con menos de dos puntos", () => {
    const { container } = render(<Sparkline values={[5]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("dibuja una polilínea con dos o más puntos", () => {
    const { container } = render(<Sparkline values={[10, 4, 0]} />);
    const poly = container.querySelector("polyline");
    expect(poly).not.toBeNull();
    // 3 puntos = 3 pares "x,y"
    expect(poly!.getAttribute("points")!.trim().split(" ")).toHaveLength(3);
  });
});
