import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReconstruccionCronograma } from "../types";
import { ReconstruirCronograma } from "./reconstruir-cronograma";

const PROPUESTA: ReconstruccionCronograma = {
  prestamoId: 23,
  nroOperacion: "28078142",
  banco: "NACIÓN",
  faltantes: 4,
  advertencias: [],
  cuotas: [
    {
      nroCuota: 1,
      fechaVencimiento: "2025-01-28",
      capital: 7170000,
      interes: 4808810.95,
      iva: 577057.32,
      total: 12555868.27,
      fechaPago: "2025-01-29",
      importePagado: 12555868.27,
      respaldo: "MacroGest · DE 28078142 · 29/01/2025 · Pago capital préstamo en pesos",
    },
    {
      nroCuota: 2,
      fechaVencimiento: "2025-07-28",
      capital: 7170000,
      interes: 4270000.14,
      iva: 512400.02,
      total: 11952400.16,
      fechaPago: "2025-07-30",
      importePagado: 11952400.16,
      respaldo: "MacroGest · DE 28078142 · 30/07/2025 · CAPITAL CUOTA PRÉSTAMO 2/8",
    },
  ],
};

function renderPanel(over: Partial<Parameters<typeof ReconstruirCronograma>[0]> = {}) {
  return render(
    <ReconstruirCronograma
      faltantes={4}
      propuesta={undefined}
      cargando={false}
      error={null}
      onBuscar={vi.fn()}
      onConfirmar={vi.fn()}
      aplicando={false}
      puedeGestionar
      {...over}
    />,
  );
}

/**
 * Reconstruir las cuotas viejas.
 *
 * Los préstamos que entraron por el Excel arrancan en la cuota que estaba pendiente el día de la
 * carga: el de Nación dice "8 cuotas" y su cronograma empieza en la 5. Los débitos de MacroGest
 * tienen la historia, y este panel la trae — mostrando ANTES qué se va a crear y con qué respaldo.
 */
describe("ReconstruirCronograma", () => {
  it("avisa cuántas cuotas anteriores le faltan al cronograma", () => {
    renderPanel();

    expect(screen.getByText(/faltan 4 cuotas/i)).toBeInTheDocument();
  });

  /** Con el cronograma completo no hay nada que ofrecer: el panel no existe. */
  it("no aparece cuando no falta ninguna", () => {
    const { container } = renderPanel({ faltantes: 0 });

    expect(container).toBeEmptyDOMElement();
  });

  it("busca en MacroGest cuando se lo pide", () => {
    const onBuscar = vi.fn();
    renderPanel({ onBuscar });

    fireEvent.click(screen.getByRole("button", { name: /buscar en macrogest/i }));

    expect(onBuscar).toHaveBeenCalled();
  });

  // ── La vista previa ─────────────────────────────────────────────────────

  /**
   * Nada se crea sin verse antes. Son cuotas que el sistema arma solo: mostrarlas es lo que separa
   * "reconstruir desde el banco" de "inventar filas".
   */
  it("muestra qué cuotas va a crear antes de crearlas", () => {
    renderPanel({ propuesta: PROPUESTA });

    // `fecha()` usa toLocaleDateString("es-AR"): sin cero a la izquierda.
    expect(screen.getByText("28/1/2025")).toBeInTheDocument();
    expect(screen.getAllByText("7.170.000,00")).toHaveLength(2); // las dos cuotas
    expect(screen.getByText("4.808.810,95")).toBeInTheDocument();
  });

  it("cada cuota dice con qué movimiento de MacroGest se respalda", () => {
    renderPanel({ propuesta: PROPUESTA });

    expect(screen.getByText(/29\/01\/2025 · Pago capital préstamo en pesos/)).toBeInTheDocument();
  });

  it("confirmar aplica la reconstrucción", () => {
    const onConfirmar = vi.fn();
    renderPanel({ propuesta: PROPUESTA, onConfirmar });

    fireEvent.click(screen.getByRole("button", { name: /agregar (las )?2 cuotas/i }));

    expect(onConfirmar).toHaveBeenCalled();
  });

  /** Un hueco a la vista es mejor que un número inventado. */
  it("muestra las advertencias sin esconderlas", () => {
    renderPanel({
      propuesta: {
        ...PROPUESTA,
        advertencias: ["La cuota 4 se cobró el 29/07/2026 pero no aparece su factura de intereses."],
      },
    });

    expect(screen.getByText(/no aparece su factura de intereses/i)).toBeInTheDocument();
  });

  /**
   * Si el banco no tiene con qué respaldar ninguna, no se ofrece crear nada: el botón sería una
   * invitación a inventar cuatro pagos.
   */
  it("sin nada que respaldar no ofrece crear", () => {
    renderPanel({
      propuesta: { ...PROPUESTA, cuotas: [], advertencias: ["MacroGest no tiene débitos."] },
    });

    expect(screen.queryByRole("button", { name: /agregar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/macrogest no tiene débitos/i)).toBeInTheDocument();
  });

  it("sin permiso de gestión sólo se mira", () => {
    renderPanel({ propuesta: PROPUESTA, puedeGestionar: false });

    expect(screen.queryByRole("button", { name: /agregar/i })).not.toBeInTheDocument();
  });

  it("avisa si MacroGest no responde", () => {
    renderPanel({ error: "No se pudo leer MacroGest (¿VPN caída?)" });

    expect(screen.getByText(/no se pudo leer macrogest/i)).toBeInTheDocument();
  });

  /**
   * El panel vive DENTRO del formulario de edición, y un botón sin `type` es un submit: al
   * confirmar salía además un PUT del préstamo con las cuotas del editor — que son sólo las
   * pendientes — y podía llevarse puestas las que se acababan de crear.
   */
  it("ningún botón del panel envía el formulario que lo contiene", () => {
    renderPanel({ propuesta: PROPUESTA });

    for (const b of screen.getAllByRole("button")) expect(b).toHaveAttribute("type", "button");
  });
});