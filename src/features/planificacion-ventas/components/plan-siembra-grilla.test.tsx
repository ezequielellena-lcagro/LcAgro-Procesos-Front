import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanSiembraGrilla } from "./plan-siembra-grilla";
import {
  cancelarCelda,
  editarCelda,
  finalizarEdicion,
  type BorradorPlan,
} from "../lib/borrador-plan";
import type { PlanSiembraFila } from "../types";

const filas: PlanSiembraFila[] = [
  {
    cuit: "20111111112",
    razonSocial: "Alfa Ficticia",
    cuentas: [1, 2],
    vendedor: { id: 1, nombre: "Vendedor" },
    sucursal: "Sucursal",
    conMovimiento: true,
    plan: null,
    revision: 0,
    anterior: { soja: 12, maiz: null, trigo: null, otro: null },
    modificadoPor: null,
    modificadoEl: null,
  },
  {
    cuit: "20999999991",
    razonSocial: "Beta Ficticia",
    cuentas: [3],
    vendedor: { id: 1, nombre: "Vendedor" },
    sucursal: "Sucursal",
    conMovimiento: true,
    plan: null,
    revision: 0,
    anterior: null,
    modificadoPor: null,
    modificadoEl: null,
  },
];

function Grilla({ editable = true }: { editable?: boolean }) {
  const [borrador, setBorrador] = useState<BorradorPlan>({});
  return (
    <PlanSiembraGrilla
      filas={filas}
      marketShare={null}
      campania="2026-2027"
      editable={editable}
      borrador={borrador}
      errores={{}}
      conflictos={new Set()}
      onEditar={(fila, cultivo, texto) =>
        setBorrador((actual) => editarCelda(actual, fila, cultivo, texto))
      }
      onFinalizarEdicion={(fila) => setBorrador((actual) => finalizarEdicion(actual, fila))}
      onCancelarCelda={(fila, cultivo) =>
        setBorrador((actual) => cancelarCelda(actual, fila, cultivo))
      }
      onCopiarAnterior={vi.fn()}
      onRecargarConflictos={vi.fn()}
    />
  );
}

describe("grilla del plan", () => {
  it("la esquina del Productor queda sobre el encabezado y las celdas", () => {
    render(<Grilla />);
    const esquina = screen.getByRole("columnheader", { name: "Productor" });
    expect(esquina).toHaveClass("sticky", "top-0", "left-0", "z-30");
    expect(esquina).not.toHaveClass("z-10");
    expect(screen.getByRole("columnheader", { name: "Soja" })).toHaveClass("z-20");
  });

  it("Enter baja a la misma columna y Escape revierte la celda", () => {
    render(<Grilla />);
    const primera = screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" });
    const segunda = screen.getByRole("textbox", { name: "Hectáreas de soja de Beta Ficticia" });
    fireEvent.change(primera, { target: { value: "1.200" } });
    expect(primera).toHaveValue("1.200");
    fireEvent.keyDown(primera, { key: "Enter" });
    expect(segunda).toHaveFocus();
    fireEvent.keyDown(primera, { key: "Escape" });
    expect(primera).toHaveValue("");
  });

  it("muestra anterior como placeholder y sin Market Share explica la ausencia", () => {
    render(<Grilla />);
    expect(
      screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }),
    ).toHaveAttribute("placeholder", "12");
    expect(screen.getAllByTitle("Falta cargar Market Share de 2026/27").length).toBeGreaterThan(0);
  });

  it("una campaña cerrada se muestra sin inputs", () => {
    render(<Grilla editable={false} />);
    expect(screen.queryByRole("textbox", { name: /Hectáreas de soja/ })).not.toBeInTheDocument();
    expect(screen.getByText("Alfa Ficticia")).toBeInTheDocument();
  });
});
