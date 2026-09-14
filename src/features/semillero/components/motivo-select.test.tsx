import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MOTIVOS_AJUSTE, MOTIVOS_ANULACION } from "../types";
import { MotivoSelect } from "./motivo-select";

/**
 * Selector de motivo con lista cerrada (R1.4/R1.5): sirve tanto para el ajuste de stock como para la
 * anulación de una orden, porque ambos enums comparten la misma forma y el mismo tratamiento de
 * "Otro" (ADR-05): sin el detalle, no se puede confirmar la operación.
 */
describe("MotivoSelect", () => {
  it("elegir un motivo llama a onChange con el valor del enum", () => {
    const onChange = vi.fn();
    render(
      <MotivoSelect
        opciones={MOTIVOS_AJUSTE}
        value=""
        onChange={onChange}
        detalle=""
        onDetalleChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "RoturaPerdida" } });

    expect(onChange).toHaveBeenCalledWith("RoturaPerdida");
  });

  it('sin elegir "Otro" no pide detalle', () => {
    render(
      <MotivoSelect
        opciones={MOTIVOS_AJUSTE}
        value="RoturaPerdida"
        onChange={vi.fn()}
        detalle=""
        onDetalleChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/detalle/i)).not.toBeInTheDocument();
  });

  it('con motivo "Otro" exige detalle (R1.4)', () => {
    const onDetalleChange = vi.fn();
    render(
      <MotivoSelect
        opciones={MOTIVOS_AJUSTE}
        value="Otro"
        onChange={vi.fn()}
        detalle=""
        onDetalleChange={onDetalleChange}
      />,
    );

    const detalle = screen.getByLabelText(/detalle/i);
    expect(detalle).toBeRequired();

    fireEvent.change(detalle, { target: { value: "Se mojó en el galpón" } });
    expect(onDetalleChange).toHaveBeenCalledWith("Se mojó en el galpón");
  });

  it('tambien funciona con la lista de motivos de anulacion (R1.5)', () => {
    render(
      <MotivoSelect
        opciones={MOTIVOS_ANULACION}
        value="Otro"
        onChange={vi.fn()}
        detalle=""
        onDetalleChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Cliente no retiró")).toBeInTheDocument();
    expect(screen.getByLabelText(/detalle/i)).toBeInTheDocument();
  });
});
