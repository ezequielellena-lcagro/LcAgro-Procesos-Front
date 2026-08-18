import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConciliacionMacroGest } from "../types";
import { ConciliacionPanel } from "./conciliacion-panel";

const VACIA: ConciliacionMacroGest = {
  desde: "2023-08-08",
  conciliadas: [],
  sinRespaldoBancario: [],
  sinCargar: [],
  sinNumeroDeOperacion: [],
  descartados: [],
  hayDiferencias: false,
};

const CONCILIADA = {
  prestamoId: 1,
  nroOperacion: "39646384",
  banco: "NACIÓN",
  linea: "TEDESCHI",
  capital: 313500,
};

/** El cruce real del 2026-08-08, en chico. */
const CON_DIFERENCIAS: ConciliacionMacroGest = {
  ...VACIA,
  hayDiferencias: true,
  conciliadas: [CONCILIADA],
  sinRespaldoBancario: [
    {
      prestamoId: 2,
      nroOperacion: "972180700",
      banco: "SANTA FE",
      linea: "CAPITAL DE TRABAJO",
      capital: 150000,
    },
  ],
  sinCargar: [
    {
      nroOperacion: "00058050",
      banco: "NACIÓN",
      capitalUsd: 225377.02,
      tasaNominalAnual: 2.75,
      concepto: "Préstamo Agronación Agro Bayer TNA 2,75 %",
      fecha: "2026-05-04",
    },
  ],
  sinNumeroDeOperacion: [
    { prestamoId: 3, nroOperacion: null, banco: "MACRO", linea: "AGRO BAYER", capital: 62212.65 },
  ],
};

function renderPanel(over: Partial<Parameters<typeof ConciliacionPanel>[0]> = {}) {
  return render(
    <ConciliacionPanel
      datos={CON_DIFERENCIAS}
      cargando={false}
      error={null}
      onReintentar={vi.fn()}
      onDescartar={vi.fn()}
      onQuitarDescarte={vi.fn()}
      puedeGestionar
      {...over}
    />,
  );
}

describe("ConciliacionPanel", () => {
  it("avisa cuando no hay diferencias en vez de mostrar tablas vacías", () => {
    renderPanel({ datos: VACIA });

    expect(screen.getByText(/sin diferencias/i)).toBeInTheDocument();
  });

  it("muestra cuántas diferencias hay", () => {
    renderPanel();

    // 1 sin respaldo + 1 sin cargar + 1 sin número
    expect(screen.getByText(/3 diferencias/i)).toBeInTheDocument();
  });

  it("lista lo que está cargado y el banco no registró", () => {
    renderPanel();

    const seccion = screen.getByRole("region", { name: /sin respaldo bancario/i });
    expect(within(seccion).getByText("972180700")).toBeInTheDocument();
    expect(within(seccion).getByText("SANTA FE")).toBeInTheDocument();
  });

  it("lista los préstamos del banco que nadie cargó, con lo que se pudo leer del texto", () => {
    renderPanel();

    const seccion = screen.getByRole("region", { name: /sin cargar/i });
    expect(within(seccion).getByText("00058050")).toBeInTheDocument();
    expect(within(seccion).getByText(/Agronación Agro Bayer/)).toBeInTheDocument();
    expect(within(seccion).getByText(/225\.377,02/)).toBeInTheDocument();
  });

  it("separa las operaciones sin número de operación", () => {
    // No son un faltante: es que les falta el dato con el que se ataría.
    renderPanel();

    const seccion = screen.getByRole("region", { name: /sin n° de operación/i });
    expect(within(seccion).getByText("MACRO")).toBeInTheDocument();
  });

  it("las conciliadas se cuentan pero no ocupan la pantalla", () => {
    renderPanel();

    // Son la mayoría y no requieren acción: alcanza con el número.
    expect(screen.getByText(/1 conciliada/i)).toBeInTheDocument();
    expect(screen.queryByText("TEDESCHI")).not.toBeInTheDocument();
  });

  it("mientras carga lo dice, porque la consulta va por VPN y tarda", () => {
    renderPanel({ datos: undefined, cargando: true });

    expect(screen.getByText(/consultando macrogest/i)).toBeInTheDocument();
  });

  /** Si la VPN se cayó hay que decirlo: listas vacías se leerían como "todo en orden". */
  it("si MacroGest no responde muestra el error y ofrece reintentar", () => {
    const onReintentar = vi.fn();
    renderPanel({ datos: undefined, error: new Error("VPN caída"), onReintentar });

    expect(screen.getByText(/no se pudo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("deja claro contra qué período se comparó", () => {
    // El formateador compartido usa es-AR sin ceros a la izquierda: 8/8/2023.
    renderPanel();

    expect(screen.getByText(/desde 8\/8\/2023/)).toBeInTheDocument();
  });

  // ── Descartes ─────────────────────────────────────────────────────────────

  /**
   * Los COMEX de MACRO están pagados pero el alta no declara el importe en dólares, así que
   * ninguna regla los puede atar. La salida es que una persona los saque del cruce.
   */
  it("ofrece descartar cada movimiento que el banco tiene y el sistema no", () => {
    render(
      <ConciliacionPanel
        datos={CON_DIFERENCIAS}
        cargando={false}
        error={null}
        onReintentar={vi.fn()}
        onDescartar={vi.fn()}
        onQuitarDescarte={vi.fn()}
        puedeGestionar
      />,
    );

    expect(screen.getByRole("button", { name: /no corresponde/i })).toBeInTheDocument();
  });

  it("pide el motivo antes de descartar", () => {
    const onDescartar = vi.fn();
    render(
      <ConciliacionPanel
        datos={CON_DIFERENCIAS}
        cargando={false}
        error={null}
        onReintentar={vi.fn()}
        onDescartar={onDescartar}
        onQuitarDescarte={vi.fn()}
        puedeGestionar
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /no corresponde/i }));

    // Se abre el diálogo y el botón de confirmar arranca deshabilitado: sin motivo no se descarta.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^descartar$/i })).toBeDisabled();
    expect(onDescartar).not.toHaveBeenCalled();
  });

  it("descarta con el motivo que se escribió", () => {
    const onDescartar = vi.fn();
    render(
      <ConciliacionPanel
        datos={CON_DIFERENCIAS}
        cargando={false}
        error={null}
        onReintentar={vi.fn()}
        onDescartar={onDescartar}
        onQuitarDescarte={vi.fn()}
        puedeGestionar
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /no corresponde/i }));
    fireEvent.change(screen.getByLabelText(/motivo/i), {
      target: { value: "Cancelado en abril de 2025." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^descartar$/i }));

    expect(onDescartar).toHaveBeenCalledWith({
      nroOperacion: "00058050",
      motivo: "Cancelado en abril de 2025.",
    });
  });

  it("lista los descartados con su motivo y quién lo puso", () => {
    render(
      <ConciliacionPanel
        datos={{
          ...VACIA,
          descartados: [
            {
              id: 1,
              nroOperacion: "02660953",
              motivo: "Cancelado en abril de 2025.",
              usuario: "Ana",
              fecha: "2026-08-18T17:11:19Z",
            },
          ],
        }}
        cargando={false}
        error={null}
        onReintentar={vi.fn()}
        onDescartar={vi.fn()}
        onQuitarDescarte={vi.fn()}
        puedeGestionar
      />,
    );

    const seccion = screen.getByRole("region", { name: /descartados/i });
    expect(within(seccion).getByText("02660953")).toBeInTheDocument();
    expect(within(seccion).getByText(/Cancelado en abril de 2025/)).toBeInTheDocument();
    expect(within(seccion).getByText(/Ana/)).toBeInTheDocument();
  });

  it("se puede deshacer un descarte", () => {
    const onQuitarDescarte = vi.fn();
    render(
      <ConciliacionPanel
        datos={{
          ...VACIA,
          descartados: [
            { id: 7, nroOperacion: "02660953", motivo: "x", usuario: "Ana", fecha: "2026-08-18T17:11:19Z" },
          ],
        }}
        cargando={false}
        error={null}
        onReintentar={vi.fn()}
        onDescartar={vi.fn()}
        onQuitarDescarte={onQuitarDescarte}
        puedeGestionar
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /deshacer/i }));

    expect(onQuitarDescarte).toHaveBeenCalledWith(7);
  });

  it("sin permiso de gestión no se puede descartar ni deshacer", () => {
    render(
      <ConciliacionPanel
        datos={{
          ...CON_DIFERENCIAS,
          descartados: [
            { id: 7, nroOperacion: "02660953", motivo: "x", usuario: "Ana", fecha: "2026-08-18T17:11:19Z" },
          ],
        }}
        cargando={false}
        error={null}
        onReintentar={vi.fn()}
        onDescartar={vi.fn()}
        onQuitarDescarte={vi.fn()}
        puedeGestionar={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /no corresponde/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deshacer/i })).not.toBeInTheDocument();
  });

  /** Un descarte no es una diferencia: es algo ya revisado. */
  it("los descartados no cuentan como diferencia", () => {
    render(
      <ConciliacionPanel
        datos={{
          ...VACIA,
          descartados: [
            { id: 1, nroOperacion: "02660953", motivo: "x", usuario: "Ana", fecha: "2026-08-18T17:11:19Z" },
          ],
        }}
        cargando={false}
        error={null}
        onReintentar={vi.fn()}
        onDescartar={vi.fn()}
        onQuitarDescarte={vi.fn()}
        puedeGestionar
      />,
    );

    expect(screen.getByText(/Sin diferencias/i)).toBeInTheDocument();
  });
});
