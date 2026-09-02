import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EliminarPrestamo } from "./eliminar-prestamo";

function renderZona(over: Partial<Parameters<typeof EliminarPrestamo>[0]> = {}) {
  return render(
    <EliminarPrestamo
      prestamoId={23}
      nroOperacion="28078142"
      cantidadCuotas={8}
      onEliminar={vi.fn()}
      eliminando={false}
      {...over}
    />,
  );
}

const abrir = () => fireEvent.click(screen.getByRole("button", { name: /eliminar préstamo/i }));

const escribir = (texto: string) =>
  fireEvent.change(screen.getByLabelText(/escribí/i), { target: { value: texto } });

/**
 * Eliminar un préstamo.
 *
 * Es la operación más peligrosa del módulo: borra la única copia del dato — los cronogramas viven
 * sólo en nuestra base, MacroGest no los tiene. El error probable no es querer borrar, es borrar
 * **el equivocado**, y por eso hay que escribir el número de operación.
 */
describe("EliminarPrestamo", () => {
  it("no borra nada de un solo clic", () => {
    const onEliminar = vi.fn();
    renderZona({ onEliminar });

    abrir();

    expect(onEliminar).not.toHaveBeenCalled();
  });

  /** Antes de confirmar hay que ver de qué tamaño es lo que se va. */
  it("dice cuántas cuotas se van con el préstamo", () => {
    renderZona();
    abrir();

    expect(screen.getByText(/8 cuotas/)).toBeInTheDocument();
  });

  it("el botón de confirmar no se habilita hasta escribir el número", () => {
    renderZona();
    abrir();

    const confirmar = screen.getByRole("button", { name: /^eliminar$/i });
    expect(confirmar).toBeDisabled();

    escribir("28078142");

    expect(confirmar).toBeEnabled();
  });

  it("con el número equivocado sigue sin habilitarse", () => {
    renderZona();
    abrir();

    escribir("28078143");

    expect(screen.getByRole("button", { name: /^eliminar$/i })).toBeDisabled();
  });

  /** Nadie tipea con precisión quirúrgica: los espacios de sobra no son un error. */
  it("tolera espacios alrededor", () => {
    renderZona();
    abrir();

    escribir("  28078142 ");

    expect(screen.getByRole("button", { name: /^eliminar$/i })).toBeEnabled();
  });

  it("confirmar manda el id y lo escrito", () => {
    const onEliminar = vi.fn();
    renderZona({ onEliminar });
    abrir();
    escribir("28078142");

    fireEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

    expect(onEliminar).toHaveBeenCalledWith(23, "28078142");
  });

  it("se puede arrepentir", () => {
    const onEliminar = vi.fn();
    renderZona({ onEliminar });
    abrir();
    escribir("28078142");

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onEliminar).not.toHaveBeenCalled();
  });

  /**
   * Un préstamo sin número de operación se confirma con el Id: es lo único que lo identifica, y es
   * justo el caso más fácil de confundir como para dejarlo sin protección.
   */
  it("sin número de operación pide el Id", () => {
    renderZona({ nroOperacion: null });
    abrir();

    escribir("23");

    expect(screen.getByRole("button", { name: /^eliminar$/i })).toBeEnabled();
  });

  it("no envía el formulario que lo contiene", () => {
    renderZona();
    abrir();

    for (const b of screen.getAllByRole("button")) expect(b).toHaveAttribute("type", "button");
  });
});
