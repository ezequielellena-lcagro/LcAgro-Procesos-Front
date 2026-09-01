import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdministrarCatalogos } from "../types";
import { CatalogosDialog } from "./catalogos-dialog";

const DATOS: AdministrarCatalogos = {
  bancos: [
    { id: 1, nombre: "NACIÓN", activo: true, esFinanciacionProveedor: false, enUso: 3 },
    { id: 2, nombre: "GALICIA", activo: true, esFinanciacionProveedor: false, enUso: 0 },
  ],
  lineas: [
    { id: 1, nombre: "CAPITAL DE TRABAJO", activo: true, esFinanciacionProveedor: false, enUso: 4 },
    { id: 2, nombre: "AGRO BAYER", activo: true, esFinanciacionProveedor: true, enUso: 0 },
    { id: 3, nombre: "PRENDARIO", activo: false, esFinanciacionProveedor: false, enUso: 0 },
  ],
};

function renderDialog(over: Partial<Parameters<typeof CatalogosDialog>[0]> = {}) {
  return render(
    <CatalogosDialog
      open
      onClose={vi.fn()}
      datos={DATOS}
      cargando={false}
      onCrear={vi.fn()}
      onActualizar={vi.fn()}
      onEliminar={vi.fn()}
      guardando={false}
      {...over}
    />,
  );
}

/** La fila de la tabla que tiene ese nombre en su input. */
function fila(nombre: string) {
  const campo = screen.getByDisplayValue(nombre);
  return within(campo.closest("[data-fila]") as HTMLElement);
}

/**
 * Administración de bancos y líneas de crédito.
 *
 * Existe porque cada proveedor nuevo con financiación trae una línea nueva, y hasta ahora eso
 * pedía una migración y un deploy.
 */
describe("CatalogosDialog", () => {
  it("lista las líneas y los bancos que ya existen", () => {
    renderDialog();

    expect(screen.getByDisplayValue("CAPITAL DE TRABAJO")).toBeInTheDocument();
    expect(screen.getByDisplayValue("NACIÓN")).toBeInTheDocument();
  });

  /** Los desactivados también se ven: si no, no habría forma de volver a activarlos. */
  it("muestra los desactivados marcados como tales", () => {
    renderDialog();

    expect(fila("PRENDARIO").getByRole("checkbox", { name: /activ/i })).not.toBeChecked();
    expect(fila("AGRO BAYER").getByRole("checkbox", { name: /activ/i })).toBeChecked();
  });

  // ── Alta ────────────────────────────────────────────────────────────────

  it("agrega una línea nueva", () => {
    const onCrear = vi.fn();
    renderDialog({ onCrear });

    fireEvent.change(screen.getByLabelText(/nueva línea/i), { target: { value: "YARA" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar línea/i }));

    expect(onCrear).toHaveBeenCalledWith("lineas", {
      nombre: "YARA",
      esFinanciacionProveedor: false,
      activo: true,
    });
  });

  it("agrega un banco nuevo", () => {
    const onCrear = vi.fn();
    renderDialog({ onCrear });

    fireEvent.change(screen.getByLabelText(/nuevo banco/i), { target: { value: "PATAGONIA" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar banco/i }));

    expect(onCrear).toHaveBeenCalledWith("bancos", expect.objectContaining({ nombre: "PATAGONIA" }));
  });

  /** Se cargan varias seguidas: ir al botón cada vez es una fricción tonta. */
  it("Enter en el campo también agrega", () => {
    const onCrear = vi.fn();
    renderDialog({ onCrear });

    const campo = screen.getByLabelText(/nueva línea/i);
    fireEvent.change(campo, { target: { value: "YARA" } });
    fireEvent.keyDown(campo, { key: "Enter" });

    expect(onCrear).toHaveBeenCalledWith("lineas", expect.objectContaining({ nombre: "YARA" }));
  });

  it("no agrega nada con el campo vacío", () => {
    const onCrear = vi.fn();
    renderDialog({ onCrear });

    fireEvent.click(screen.getByRole("button", { name: /agregar línea/i }));

    expect(onCrear).not.toHaveBeenCalled();
  });

  it("después de agregar, el campo queda limpio para la siguiente", () => {
    renderDialog();

    const campo = screen.getByLabelText(/nueva línea/i);
    fireEvent.change(campo, { target: { value: "YARA" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar línea/i }));

    expect(campo).toHaveValue("");
  });

  // ── Edición ─────────────────────────────────────────────────────────────

  /** Guardar aparece recién cuando hay algo distinto: si no, es un botón que no hace nada. */
  it("el guardar de una fila aparece sólo cuando cambió algo", () => {
    renderDialog();

    expect(fila("AGRO BAYER").queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("AGRO BAYER"), { target: { value: "BAYER AGRO" } });

    expect(fila("BAYER AGRO").getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });

  it("renombrar una línea la manda con su id", () => {
    const onActualizar = vi.fn();
    renderDialog({ onActualizar });

    fireEvent.change(screen.getByDisplayValue("AGRO BAYER"), { target: { value: "BAYER AGRO" } });
    fireEvent.click(fila("BAYER AGRO").getByRole("button", { name: /guardar/i }));

    expect(onActualizar).toHaveBeenCalledWith("lineas", 2, {
      nombre: "BAYER AGRO",
      esFinanciacionProveedor: true,
      activo: true,
    });
  });

  /** Desactivar es la baja de verdad: no pide confirmar ni pasa por el botón guardar. */
  it("destildar activa desactiva la línea al toque", () => {
    const onActualizar = vi.fn();
    renderDialog({ onActualizar });

    fireEvent.click(fila("AGRO BAYER").getByRole("checkbox", { name: /activ/i }));

    expect(onActualizar).toHaveBeenCalledWith("lineas", 2, expect.objectContaining({ activo: false }));
  });

  // ── Baja ────────────────────────────────────────────────────────────────

  /**
   * Lo que está en uso no se borra: los préstamos que lo tienen lo siguen mostrando. La fila lo
   * dice antes de que el usuario lo intente.
   */
  it("lo que usan préstamos no se puede borrar y dice cuántos son", () => {
    renderDialog();

    const enUso = fila("CAPITAL DE TRABAJO");
    expect(enUso.getByRole("button", { name: /eliminar/i })).toBeDisabled();
    expect(enUso.getByText("4")).toBeInTheDocument();
  });

  it("lo que no usa nadie se borra confirmando", () => {
    const onEliminar = vi.fn();
    renderDialog({ onEliminar });

    fireEvent.click(fila("AGRO BAYER").getByRole("button", { name: /eliminar/i }));
    fireEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

    expect(onEliminar).toHaveBeenCalledWith("lineas", 2);
  });

  it("se puede arrepentir de eliminar", () => {
    const onEliminar = vi.fn();
    renderDialog({ onEliminar });

    fireEvent.click(fila("AGRO BAYER").getByRole("button", { name: /eliminar/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onEliminar).not.toHaveBeenCalled();
  });
});
