import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockEstadoFiltro } from "./estado-filtro";

describe("StockEstadoFiltro", () => {
  it("ofrece todos los estados de cobertura, con 'Todos' como default", () => {
    render(<StockEstadoFiltro valor="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Estado")).toHaveValue("");
    expect(screen.getByRole("option", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "OK" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Riesgo quiebre" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Inmovilizado" })).toBeInTheDocument();
  });

  it("avisa cuando se aísla el riesgo de quiebre", () => {
    const onChange = vi.fn();
    render(<StockEstadoFiltro valor="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "RiesgoQuiebre" } });
    expect(onChange).toHaveBeenCalledWith("RiesgoQuiebre");
  });

  it("refleja el valor elegido", () => {
    render(<StockEstadoFiltro valor="RiesgoQuiebre" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Estado")).toHaveValue("RiesgoQuiebre");
  });

  it("vuelve a 'Todos' avisando con string vacío", () => {
    const onChange = vi.fn();
    render(<StockEstadoFiltro valor="Inmovilizado" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });
});
