import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StockTotalesDto } from "../types";
import { SemilleroKpis } from "./semillero-kpis";

const totales: StockTotalesDto = {
  propio: { bigBagsDisponibles: 12, bolsasDisponibles: 340, kgDisponibles: 96000 },
  clientes: { bigBagsDisponibles: 5, bolsasDisponibles: 80, kgDisponibles: 24000 },
  kgComprometidos: 15000,
  ordenesPendientes: 3,
};

describe("SemilleroKpis", () => {
  it("muestra BigBags, bolsas y disponible propios", () => {
    render(<SemilleroKpis totales={totales} />);
    expect(screen.getByText("BigBags propios")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Bolsas propias")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByText("Disponible propio")).toBeInTheDocument();
    expect(screen.getByText("96 t")).toBeInTheDocument();
  });

  /**
   * ADR-13: "los totales de stock se parten en Propio y Clientes (bigbags, bolsas y kg
   * disponibles de cada uno)". El grupo Clientes debe tener el mismo desglose que Propio,
   * no sólo el total en toneladas (hallazgo de revision adversarial, engram #1118/#1124).
   */
  it("muestra BigBags, bolsas y disponible de clientes con el mismo desglose que Propio", () => {
    render(<SemilleroKpis totales={totales} />);
    expect(screen.getByText("BigBags de clientes")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Bolsas de clientes")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("Disponible de clientes")).toBeInTheDocument();
    expect(screen.getByText("24 t")).toBeInTheDocument();
  });

  it("aclara que la semilla de clientes no es stock vendible", () => {
    render(<SemilleroKpis totales={totales} />);
    expect(screen.getByText("No es stock vendible")).toBeInTheDocument();
  });

  it("muestra las órdenes pendientes con los kg comprometidos", () => {
    render(<SemilleroKpis totales={totales} />);
    expect(screen.getByText("Órdenes pendientes")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("15.000 kg reservados")).toBeInTheDocument();
  });
});
