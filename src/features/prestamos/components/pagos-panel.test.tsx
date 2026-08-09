import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConciliacionPagos, PagoSugerido } from "../types";
import { PagosPanel } from "./pagos-panel";

function sugerido(over: Partial<PagoSugerido> = {}): PagoSugerido {
  return {
    prestamoId: 22,
    cuotaId: 69,
    nroOperacion: "28078488",
    banco: "NACIÓN",
    linea: "CAPITAL DE TRABAJO",
    moneda: "ARS",
    nroCuota: 5,
    cantidadCuotas: 8,
    fechaVencimiento: "2027-01-28",
    totalCuota: 30646027.4,
    fechaPago: "2027-01-28",
    importeDebitado: 30646027.4,
    concepto: "CAPITAL CUOTA DE PRÉSTAMO · FAC A 00004-28078488",
    importeCoincide: true,
    diferenciaArs: 0,
    ...over,
  };
}

const DATOS: ConciliacionPagos = {
  desde: "2025-08-08",
  sugeridos: [sugerido()],
  sinCuotaPendiente: [],
  sinPrestamo: [],
  hayPropuestas: true,
};

function renderPanel(over: Partial<Parameters<typeof PagosPanel>[0]> = {}) {
  return render(
    <PagosPanel
      datos={DATOS}
      cargando={false}
      error={null}
      onReintentar={vi.fn()}
      onConfirmar={vi.fn()}
      confirmando={false}
      puedeGestionar
      {...over}
    />,
  );
}

describe("PagosPanel", () => {
  it("lista cada débito con la cuota que le propone", () => {
    renderPanel();

    expect(screen.getByText("28078488")).toBeInTheDocument();
    expect(screen.getByText("5/8")).toBeInTheDocument();
    expect(screen.getAllByText("30.646.027,40").length).toBeGreaterThan(0);
  });

  it("no confirma nada hasta que el usuario elige", () => {
    const onConfirmar = vi.fn();
    renderPanel({ onConfirmar });

    // El botón arranca deshabilitado: la propuesta no se aplica sola.
    expect(screen.getByRole("button", { name: /imputar/i })).toBeDisabled();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("confirma sólo lo tildado, con la fecha del banco", () => {
    const onConfirmar = vi.fn();
    renderPanel({ onConfirmar });

    fireEvent.click(screen.getByLabelText(/imputar la cuota 5/i));
    fireEvent.click(screen.getByRole("button", { name: /imputar/i }));

    expect(onConfirmar).toHaveBeenCalledWith([
      { cuotaId: 69, fechaPago: "2027-01-28", importePagado: 30646027.4 },
    ]);
  });

  /**
   * En dólares el banco debita pesos: mandar ese importe como "importe pagado" de una cuota en
   * dólares guardaría un número sin sentido.
   */
  it("en dólares no manda el importe debitado como importe pagado", () => {
    const onConfirmar = vi.fn();
    renderPanel({
      onConfirmar,
      datos: {
        ...DATOS,
        sugeridos: [sugerido({ moneda: "USD", diferenciaArs: null, importeDebitado: 60695288.04 })],
      },
    });

    fireEvent.click(screen.getByLabelText(/imputar la cuota 5/i));
    fireEvent.click(screen.getByRole("button", { name: /imputar/i }));

    expect(onConfirmar).toHaveBeenCalledWith([
      { cuotaId: 69, fechaPago: "2027-01-28", importePagado: null },
    ]);
  });

  it("marca la fila cuando el débito no coincide con el total de la cuota", () => {
    renderPanel({
      datos: {
        ...DATOS,
        sugeridos: [
          sugerido({ importeCoincide: false, diferenciaArs: 353972.6, importeDebitado: 31000000 }),
        ],
      },
    });

    expect(screen.getByText(/353\.972,60/)).toBeInTheDocument();
  });

  it("permite tildar todo de una", () => {
    const onConfirmar = vi.fn();
    renderPanel({
      onConfirmar,
      datos: {
        ...DATOS,
        sugeridos: [sugerido(), sugerido({ cuotaId: 70, nroCuota: 6, fechaPago: "2027-07-28" })],
      },
    });

    fireEvent.click(screen.getByLabelText(/imputar todas/i));
    fireEvent.click(screen.getByRole("button", { name: /imputar/i }));

    expect(onConfirmar.mock.calls[0][0]).toHaveLength(2);
  });

  it("sin gestión no muestra el botón de imputar", () => {
    renderPanel({ puedeGestionar: false });

    expect(screen.queryByRole("button", { name: /imputar/i })).not.toBeInTheDocument();
  });

  /**
   * Los débitos anteriores a la carga inicial: el préstamo está cargado pero sus cuotas viejas
   * no. No es un error, pero tiene que verse — es el rastro de lo que ya se pagó.
   */
  it("muestra aparte los débitos sin cuota pendiente, con su préstamo", () => {
    renderPanel({
      datos: {
        ...DATOS,
        sugeridos: [],
        hayPropuestas: false,
        sinCuotaPendiente: [
          {
            nroComprobante: "28078488",
            fecha: "2026-07-29",
            importeArs: 31942465.74,
            banco: "NACIÓN",
            concepto: "CAPITAL CUOTA DE PRESTAMO",
            prestamoId: 22,
            nroOperacion: "28078488",
          },
        ],
      },
    });

    const seccion = screen.getByRole("region", { name: /sin cuota pendiente/i });
    expect(within(seccion).getByText("31.942.465,74")).toBeInTheDocument();
  });

  it("muestra aparte los débitos de préstamos que no están cargados", () => {
    renderPanel({
      datos: {
        ...DATOS,
        sugeridos: [],
        hayPropuestas: false,
        sinPrestamo: [
          {
            nroComprobante: "1766273",
            fecha: "2025-12-11",
            importeArs: 17129983.23,
            banco: "CREDICOOP",
            concepto: "CAPITAL CUOTA PRÉSTAMO",
            prestamoId: null,
            nroOperacion: null,
          },
        ],
      },
    });

    const seccion = screen.getByRole("region", { name: /sin préstamo/i });
    expect(within(seccion).getByText("CREDICOOP")).toBeInTheDocument();
  });

  it("sin nada que imputar lo dice", () => {
    renderPanel({
      datos: {
        ...DATOS,
        sugeridos: [],
        hayPropuestas: false,
      },
    });

    expect(screen.getByText(/no hay pagos para imputar/i)).toBeInTheDocument();
  });

  it("si MacroGest no responde lo dice en vez de mostrar listas vacías", () => {
    renderPanel({ datos: undefined, error: new Error("503") });

    expect(screen.getByText(/no se pudo consultar macrogest/i)).toBeInTheDocument();
    expect(screen.queryByText(/no hay pagos para imputar/i)).not.toBeInTheDocument();
  });

  it("mientras carga no muestra resultados", () => {
    renderPanel({ datos: undefined, cargando: true });

    expect(screen.getByText(/consultando macrogest/i)).toBeInTheDocument();
  });
});
