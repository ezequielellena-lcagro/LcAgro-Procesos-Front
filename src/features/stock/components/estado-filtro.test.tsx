import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EstadoFiltroField } from "./estado-filtro";

describe("EstadoFiltroField", () => {
  it("ofrece todos los estados de cobertura, con 'Todos' como default", () => {
    render(<EstadoFiltroField valor="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Estado")).toHaveValue("");
    expect(screen.getByRole("option", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "OK" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Riesgo quiebre" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Inmovilizado" })).toBeInTheDocument();
  });

  it("avisa cuando se aísla el riesgo de quiebre", () => {
    const onChange = vi.fn();
    render(<EstadoFiltroField valor="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "RiesgoQuiebre" } });
    expect(onChange).toHaveBeenCalledWith("RiesgoQuiebre");
  });

  it("refleja el valor elegido", () => {
    render(<EstadoFiltroField valor="RiesgoQuiebre" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Estado")).toHaveValue("RiesgoQuiebre");
  });

  it("vuelve a 'Todos' avisando con string vacío", () => {
    const onChange = vi.fn();
    render(<EstadoFiltroField valor="Inmovilizado" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("queda habilitado cuando la solapa no impone un estado", () => {
    render(<EstadoFiltroField valor="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Estado")).toBeEnabled();
  });
});

describe("EstadoFiltroField — estado impuesto por la solapa", () => {
  it("muestra el estado fijo y deshabilita el control", () => {
    render(<EstadoFiltroField valor="Ok" onChange={vi.fn()} fijo="Inmovilizado" />);
    const select = screen.getByLabelText("Estado");
    // Gana el fijo, aunque el usuario haya elegido otra cosa antes: es lo que va a viajar en la query.
    expect(select).toHaveValue("Inmovilizado");
    expect(select).toBeDisabled();
  });

  it("explica por qué está fijo en vez de pisar la elección en silencio", () => {
    render(<EstadoFiltroField valor="" onChange={vi.fn()} fijo="Inmovilizado" />);
    expect(screen.getByLabelText("Estado")).toHaveAttribute(
      "title",
      'Esta solapa ya filtra por "Inmovilizado": el filtro queda fijo.',
    );
  });
});
