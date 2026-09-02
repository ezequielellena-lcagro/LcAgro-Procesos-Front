import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FilaCuota } from "../cronograma";
import { CronogramaEditor } from "./cronograma-editor";

const CUOTAS: FilaCuota[] = [
  {
    nroCuota: 1,
    fechaVencimiento: "2025-01-28",
    capital: 7170000,
    interes: 4808810.95,
    iva: 577057.32,
    respaldoMacroGest: "MacroGest · DE 28078142 · 29/01/2025 · Pago capital préstamo en pesos",
  },
  {
    nroCuota: 5,
    fechaVencimiento: "2027-01-28",
    capital: 7170000,
    interes: 2457836.71,
    iva: 294940.41,
  },
];

/**
 * El cronograma del formulario. Lo que se prueba acá es el <b>respaldo</b> de las cuotas
 * reconstruidas: son filas que el sistema armó solo desde MacroGest, y sin decir de dónde salieron
 * serían indistinguibles de un dato inventado.
 */
describe("CronogramaEditor", () => {
  const renderEditor = () =>
    render(<CronogramaEditor cuotas={CUOTAS} onChange={vi.fn()} bloqueadas={[1]} />);

  it("una cuota reconstruida muestra de qué movimiento de MacroGest salió", () => {
    renderEditor();

    expect(screen.getByText(/DE 28078142 · 29\/01\/2025/)).toBeInTheDocument();
  });

  /** Las cargadas a mano o traídas del Excel no tienen respaldo, y no muestran nada. */
  it("una cuota cargada normalmente no muestra ningún respaldo", () => {
    renderEditor();

    const fila = screen.getByDisplayValue("5").closest("tr") as HTMLElement;
    expect(within(fila).queryByText(/MacroGest/)).not.toBeInTheDocument();
  });
});
