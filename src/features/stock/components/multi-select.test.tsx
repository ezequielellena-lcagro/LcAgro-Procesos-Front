import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MultiSelect } from "./multi-select";

const OPTS = [
  { value: 200, label: "HERBICIDAS" },
  { value: 201, label: "INSECTICIDAS" },
  { value: 207, label: "FERTILIZANTES" },
];

describe("MultiSelect", () => {
  it("muestra el placeholder cuando no hay selección", () => {
    render(<MultiSelect options={OPTS} value={[]} onChange={() => {}} placeholder="Todos los rubros" />);
    expect(screen.getByText("Todos los rubros")).toBeInTheDocument();
  });

  it("muestra el conteo cuando hay selección", () => {
    render(<MultiSelect options={OPTS} value={[200, 201]} onChange={() => {}} placeholder="Todos" />);
    expect(screen.getByText("2 seleccionados")).toBeInTheDocument();
  });

  it("agrega un valor al tildar una opción", () => {
    const onChange = vi.fn();
    render(<MultiSelect options={OPTS} value={[]} onChange={onChange} placeholder="Todos" />);
    fireEvent.click(screen.getByRole("button", { name: /Todos/ }));
    fireEvent.click(screen.getByLabelText("HERBICIDAS"));
    expect(onChange).toHaveBeenCalledWith([200]);
  });

  it("quita un valor al destildar una opción seleccionada", () => {
    const onChange = vi.fn();
    render(<MultiSelect options={OPTS} value={[200, 201]} onChange={onChange} placeholder="Todos" />);
    fireEvent.click(screen.getByRole("button", { name: /seleccionados/ }));
    fireEvent.click(screen.getByLabelText("HERBICIDAS"));
    expect(onChange).toHaveBeenCalledWith([201]);
  });

  it("'Limpiar' vacía la selección", () => {
    const onChange = vi.fn();
    render(<MultiSelect options={OPTS} value={[200, 201]} onChange={onChange} placeholder="Todos" />);
    fireEvent.click(screen.getByRole("button", { name: /seleccionados/ }));
    fireEvent.click(screen.getByText("Limpiar"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
