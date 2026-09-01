import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateField } from "./date-field";

/**
 * El campo de fecha de toda la app. El valor viaja SIEMPRE como ISO (yyyy-mm-dd) y se muestra
 * como dd/mm/aaaa, sin depender del idioma del navegador.
 *
 * Se puede escribir o elegir del calendario. Escribir es lo que faltaba: con sólo flechas de mes,
 * poner una fecha de 2024 estando en 2026 son 25 clics — y por eso Administración decía que "no
 * deja elegir fechas".
 */
describe("DateField", () => {
  const abrirCalendario = () => fireEvent.click(screen.getByRole("button", { name: /calendario/i }));

  // ── Lo que ya andaba ────────────────────────────────────────────────────

  it("muestra la fecha en dd/mm/aaaa", () => {
    render(<DateField value="2024-08-01" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox")).toHaveValue("01/08/2024");
  });

  it("sin valor queda vacío con el formato a la vista", () => {
    render(<DateField value="" onChange={vi.fn()} />);

    const campo = screen.getByRole("textbox");
    expect(campo).toHaveValue("");
    expect(campo).toHaveAttribute("placeholder", "dd/mm/aaaa");
  });

  it("elegir un día del calendario devuelve la fecha en ISO", () => {
    const onChange = vi.fn();
    render(<DateField value="2026-09-01" onChange={onChange} />);

    abrirCalendario();
    fireEvent.click(screen.getByRole("button", { name: "15" }));

    expect(onChange).toHaveBeenCalledWith("2026-09-15");
  });

  it("deshabilitado no abre el calendario ni deja escribir", () => {
    render(<DateField value="2026-09-01" onChange={vi.fn()} disabled />);

    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /calendario/i })).toBeDisabled();
  });

  // ── Escribir la fecha ───────────────────────────────────────────────────

  it("se puede escribir la fecha sin abrir el calendario", () => {
    const onChange = vi.fn();
    render(<DateField value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "01/08/2024" } });

    expect(onChange).toHaveBeenCalledWith("2024-08-01");
  });

  it("acepta el día y el mes sin cero adelante", () => {
    const onChange = vi.fn();
    render(<DateField value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "1/8/2024" } });

    expect(onChange).toHaveBeenCalledWith("2024-08-01");
  });

  /** Mientras se tipea "01/0" no hay fecha todavía: avisar sería ruido. */
  it("mientras la fecha está a medias no avisa nada", () => {
    const onChange = vi.fn();
    render(<DateField value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "01/0" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("01/0");
  });

  /** El 31 de febrero no existe: se deja escrito pero no se convierte en fecha. */
  it("una fecha que no existe no se acepta", () => {
    const onChange = vi.fn();
    render(<DateField value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "31/02/2026" } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("borrar el texto borra la fecha", () => {
    const onChange = vi.fn();
    render(<DateField value="2024-08-01" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith("");
  });

  /** Al salir del campo, lo que quedó a medias vuelve a mostrar la fecha vigente. */
  it("al salir se descarta lo que quedó incompleto", () => {
    render(<DateField value="2024-08-01" onChange={vi.fn()} />);
    const campo = screen.getByRole("textbox");

    fireEvent.change(campo, { target: { value: "31/0" } });
    fireEvent.blur(campo);

    expect(campo).toHaveValue("01/08/2024");
  });

  // ── Saltar de mes y de año ──────────────────────────────────────────────

  it("el calendario deja elegir el mes y el año", () => {
    render(<DateField value="2026-09-01" onChange={vi.fn()} />);

    abrirCalendario();

    expect(screen.getByRole("combobox", { name: "Mes" })).toHaveValue("8");   // septiembre, base 0
    expect(screen.getByRole("combobox", { name: "Año" })).toHaveValue("2026");
  });

  it("cambiar el año lleva el calendario a ese año", () => {
    const onChange = vi.fn();
    render(<DateField value="2026-09-01" onChange={onChange} />);

    abrirCalendario();
    fireEvent.change(screen.getByRole("combobox", { name: "Año" }), { target: { value: "2024" } });
    fireEvent.click(screen.getByRole("button", { name: "15" }));

    expect(onChange).toHaveBeenCalledWith("2024-09-15");
  });

  it("cambiar el mes lleva el calendario a ese mes", () => {
    const onChange = vi.fn();
    render(<DateField value="2026-09-01" onChange={onChange} />);

    abrirCalendario();
    fireEvent.change(screen.getByRole("combobox", { name: "Mes" }), { target: { value: "0" } });   // enero
    fireEvent.click(screen.getByRole("button", { name: "15" }));

    expect(onChange).toHaveBeenCalledWith("2026-01-15");
  });

  /**
   * El rango tiene que cubrir lo que el negocio necesita: préstamos otorgados hace años y
   * cronogramas que llegan a 2031.
   */
  it("el rango de años cubre varios hacia atrás y hacia adelante", () => {
    render(<DateField value="2026-09-01" onChange={vi.fn()} />);

    abrirCalendario();
    const anios = within(screen.getByRole("combobox", { name: "Año" }))
      .getAllByRole("option")
      .map((o) => Number((o as HTMLOptionElement).value));

    expect(Math.min(...anios)).toBeLessThanOrEqual(2016);
    expect(Math.max(...anios)).toBeGreaterThanOrEqual(2036);
  });

  /** Una fecha vieja tiene que poder mostrarse aunque caiga fuera del rango habitual. */
  it("si el valor cae fuera del rango, el año igual está en la lista", () => {
    render(<DateField value="1998-03-10" onChange={vi.fn()} />);

    abrirCalendario();

    expect(screen.getByRole("combobox", { name: "Año" })).toHaveValue("1998");
  });
});
