import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Modal } from "./modal";

describe("Modal", () => {
  it("mueve el foco al panel cuando se abre (a11y)", () => {
    const { getByRole, rerender } = render(
      <Modal open={false} onClose={() => {}} title="Diálogo">
        <input aria-label="campo" />
      </Modal>,
    );
    rerender(
      <Modal open onClose={() => {}} title="Diálogo">
        <input aria-label="campo" />
      </Modal>,
    );
    expect(document.activeElement).toBe(getByRole("dialog"));
  });

  it("no roba el foco al re-renderizar con un onClose nuevo (cada tecla en un input hijo)", () => {
    const { rerender, getByLabelText } = render(
      <Modal open onClose={() => {}} title="Diálogo">
        <input aria-label="campo" />
      </Modal>,
    );

    const input = getByLabelText("campo") as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    // El padre crea una arrow nueva como onClose en cada render (lo que pasa al tipear).
    // El Modal no debe re-enfocar el panel por eso.
    rerender(
      <Modal open onClose={() => {}} title="Diálogo">
        <input aria-label="campo" />
      </Modal>,
    );

    expect(document.activeElement).toBe(input);
  });
});
