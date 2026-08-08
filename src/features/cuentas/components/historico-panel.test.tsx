import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usd } from "@/shared/format/format";
import type { CierreDetalle, CierreEstado, CierrePeriodo } from "../types";
import {
  useCerrarMes,
  useCierreEstado,
  useCierrePeriodo,
  useCierrePeriodos,
  useExportarCierre,
} from "../queries/use-cierre";
import { HistoricoPanel } from "./historico-panel";

vi.mock("../queries/use-cierre", () => ({
  useCierrePeriodos: vi.fn(),
  useCierreEstado: vi.fn(),
  useCierrePeriodo: vi.fn(),
  useCerrarMes: vi.fn(),
  useExportarCierre: vi.fn(),
}));

// Solo se rehidrata lo que el panel realmente lee de cada hook (no todo el UseQueryResult/UseMutationResult).
// `R` lo infiere TS del tipo que espera cada `mockReturnValue`, así un mismo helper sirve para queries y mutations.
const como = <R,>(r: unknown): R => r as R;

const PERIODOS: CierrePeriodo[] = [
  { anio: 2026, mes: 6, cuentas: 2, saldo: 20345.67, fechaCierre: "2026-07-01T10:00:00.000Z" },
  { anio: 2026, mes: 5, cuentas: 2, saldo: 18000, fechaCierre: "2026-06-01T10:00:00.000Z" },
];

const ESTADO: CierreEstado = { anio: 2026, mes: 7, faltaCerrar: true };

const DETALLE: CierreDetalle = {
  anio: 2026,
  mes: 6,
  corte: "2026-06-30",
  totales: { cuentas: 2, vencido: 12345.67, aVencer: 8000, saldo: 20345.67 },
  items: [
    {
      cuenta: 1024,
      denominacion: "Estancia La Esperanza S.A.",
      vendedor: "LC AGRO",
      vendNro: 1,
      saldoVencido: 10000,
      saldoAVencer: 5000,
      saldo: 15000,
      devolucion: "Plan a 90 días",
      observaciones: null,
    },
    {
      cuenta: 2011,
      denominacion: "Cabaña Los Aromos",
      vendedor: "PAMPA SUR",
      vendNro: 2,
      saldoVencido: 2345.67,
      saldoAVencer: 3000,
      saldo: 5345.67,
      devolucion: null,
      observaciones: "Contra cosecha",
    },
  ],
};

describe("HistoricoPanel", () => {
  beforeEach(() => {
    vi.mocked(useCierrePeriodos).mockReturnValue(como({ isPending: false, isError: false, data: PERIODOS }));
    vi.mocked(useCierreEstado).mockReturnValue(como({ isPending: false, isError: false, data: ESTADO }));
    vi.mocked(useCierrePeriodo).mockReturnValue(como({ isPending: false, isError: false, data: DETALLE }));
    vi.mocked(useCerrarMes).mockReturnValue(como({ mutate: vi.fn(), isPending: false }));
    vi.mocked(useExportarCierre).mockReturnValue(como({ mutate: vi.fn(), isPending: false }));
  });

  it("muestra la foto del mes (cuentas + total) y no ofrece cerrar sin permiso", () => {
    render(<HistoricoPanel puedeGestionar={false} />);

    // Filas de la foto.
    expect(screen.getByText("Estancia La Esperanza S.A.")).toBeInTheDocument();
    expect(screen.getByText("Cabaña Los Aromos")).toBeInTheDocument();
    expect(screen.getByText("Plan a 90 días")).toBeInTheDocument();

    // Total del período en la fila de totales (footer del DataTable). El saldo total también aparece en
    // el resumen de arriba, así que se acota a la fila "TOTAL" en vez de buscarlo suelto en todo el DOM.
    const filaTotal = screen.getByText("TOTAL").closest("tr") as HTMLElement;
    expect(within(filaTotal).getByText(usd(20345.67))).toBeInTheDocument();

    // Sin permiso de gestión no aparece el botón de cierre.
    expect(screen.queryByRole("button", { name: /Cerrar mes/ })).not.toBeInTheDocument();
  });

  it("con permiso muestra el botón 'Cerrar mes' y el aviso de mes sin cerrar", () => {
    render(<HistoricoPanel puedeGestionar />);

    expect(screen.getByRole("button", { name: /Cerrar mes/ })).toBeInTheDocument();
    expect(screen.getByText(/está sin cerrar/i)).toBeInTheDocument();
    expect(screen.getByText("Julio 2026")).toBeInTheDocument(); // mes en curso del aviso
  });

  it("muestra el estado vacío cuando no hay meses cerrados", () => {
    vi.mocked(useCierrePeriodos).mockReturnValue(como({ isPending: false, isError: false, data: [] }));
    render(<HistoricoPanel puedeGestionar={false} />);

    expect(screen.getByText("Todavía no hay meses cerrados.")).toBeInTheDocument();
  });
});
