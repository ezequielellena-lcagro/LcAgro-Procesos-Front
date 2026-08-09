import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConciliacionMacroGest } from "../types";
import { ConciliacionPanel } from "./conciliacion-panel";

const VACIA: ConciliacionMacroGest = {
  desde: "2023-08-08",
  conciliadas: [],
  sinRespaldoBancario: [],
  sinCargar: [],
  sinNumeroDeOperacion: [],
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
});
