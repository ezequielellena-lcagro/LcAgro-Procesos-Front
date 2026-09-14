import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClienteCopiaDto } from "../types";
import { ClienteSelect } from "./cliente-select";

const CLIENTES: ClienteCopiaDto[] = [
  { numero: 1234, denominacion: "Juan Pérez", cuit: "20-12345678-9" },
  { numero: 5678, denominacion: "Agropecuaria del Sur SA", cuit: null },
];

/**
 * Envuelve el `Combobox` genérico (R2.2): el selector de clientes siempre lee la copia local, nunca
 * MacroGest en vivo, así que sólo necesita buscar sobre la lista que le pasa el padre y resolver el
 * número de cliente a partir de la etiqueta elegida (no al revés: el value es un número, no texto).
 */
describe("ClienteSelect", () => {
  it("busca por texto y resuelve el numero del cliente elegido", () => {
    const onChange = vi.fn();
    render(<ClienteSelect clientes={CLIENTES} value={null} onChange={onChange} />);

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "perez" } });
    // El Combobox elige con `onMouseDown` (no `onClick`), para commitear antes de que el input
    // pierda el foco.
    fireEvent.mouseDown(screen.getByText("1234 · Juan Pérez"));

    expect(onChange).toHaveBeenCalledWith(1234);
  });

  it("muestra la etiqueta del cliente ya elegido, no sólo el numero", () => {
    render(<ClienteSelect clientes={CLIENTES} value={5678} onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveValue("5678 · Agropecuaria del Sur SA");
  });

  it("con value null no muestra ningun cliente seleccionado", () => {
    render(<ClienteSelect clientes={CLIENTES} value={null} onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("respeta el disabled del padre (p. ej. copia sin clientes, decision #7)", () => {
    render(<ClienteSelect clientes={[]} value={null} onChange={vi.fn()} disabled />);

    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
