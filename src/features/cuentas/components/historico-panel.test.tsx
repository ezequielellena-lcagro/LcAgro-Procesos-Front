import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hoyIso, usd } from "@/shared/format/format";
import type { CierreDetalle, CierreDiff, CierreEstado, CierrePeriodo, CierreRevision } from "../types";
import {
  useCerrarMes,
  useCierreDiff,
  useCierreEstado,
  useCierrePeriodo,
  useCierrePeriodos,
  useCierreRevisiones,
  useExportarCierre,
  useRecerrarPeriodo,
} from "../queries/use-cierre";
import { HistoricoPanel } from "./historico-panel";

vi.mock("../queries/use-cierre", () => ({
  useCierrePeriodos: vi.fn(),
  useCierreEstado: vi.fn(),
  useCierrePeriodo: vi.fn(),
  useCierreRevisiones: vi.fn(),
  useCierreDiff: vi.fn(),
  useCerrarMes: vi.fn(),
  useRecerrarPeriodo: vi.fn(),
  useExportarCierre: vi.fn(),
}));

// Solo se rehidrata lo que el panel realmente lee de cada hook (no todo el UseQueryResult/UseMutationResult).
// `R` lo infiere TS del tipo que espera cada `mockReturnValue`, así un mismo helper sirve para queries y mutations.
const como = <R,>(r: unknown): R => r as R;

// Junio cerrado con corte del 7 de julio: el informe se presentó ya entrado el mes siguiente, que es
// el caso normal del proceso (los vendedores cargan del 1 al 10).
const PERIODOS: CierrePeriodo[] = [
  { anio: 2026, mes: 6, cuentas: 2, saldo: 20345.67, corte: "2026-07-07", fechaCierre: "2026-07-12T10:00:00.000Z", revision: 1, revisiones: 1 },
  { anio: 2026, mes: 5, cuentas: 2, saldo: 18000, corte: "2026-06-05", fechaCierre: "2026-06-09T10:00:00.000Z", revision: 1, revisiones: 1 },
];

const REVISIONES: CierreRevision[] = [
  { revision: 2, corte: "2026-07-07", fechaCierre: "2026-07-20T09:30:00.000Z", cuentas: 2, saldo: 21845.67, vigente: true },
  { revision: 1, corte: "2026-07-07", fechaCierre: "2026-07-12T10:00:00.000Z", cuentas: 2, saldo: 20345.67, vigente: false },
];

const DIFF_CON_CAMBIOS: CierreDiff = {
  anio: 2026,
  mes: 6,
  revision: 1,
  corte: "2026-07-07",
  hayCambios: true,
  cambiadas: 1,
  agregadas: 0,
  quitadas: 0,
  deltaSaldo: 1500,
  items: [
    {
      cuenta: 1024,
      denominacion: "Estancia La Esperanza S.A.",
      vendedor: "LC AGRO",
      tipo: "Cambiada",
      vencidoFoto: 10000,
      vencidoActual: 11500,
      saldoFoto: 15000,
      saldoActual: 16500,
      delta: 1500,
    },
  ],
};

const SIN_CAMBIOS: CierreDiff = {
  ...DIFF_CON_CAMBIOS,
  hayCambios: false,
  cambiadas: 0,
  deltaSaldo: 0,
  items: [],
};

const ESTADO: CierreEstado = { anio: 2026, mes: 7, faltaCerrar: true };

const DETALLE: CierreDetalle = {
  anio: 2026,
  mes: 6,
  corte: "2026-07-07",
  revision: 1,
  fechaCierre: "2026-07-12T10:00:00.000Z",
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

/** El resumen del diff reparte el texto entre <p> y <span>, así que se matchea por el párrafo. */
const resumenDelDiff = () =>
  screen.getByText(
    (_, el) => el?.tagName === "P" && /cuentas? cambi/.test(el.textContent ?? ""),
  );

describe("HistoricoPanel", () => {
  beforeEach(() => {
    vi.mocked(useCierrePeriodos).mockReturnValue(como({ isPending: false, isError: false, data: PERIODOS }));
    vi.mocked(useCierreEstado).mockReturnValue(como({ isPending: false, isError: false, data: ESTADO }));
    vi.mocked(useCierrePeriodo).mockReturnValue(como({ isPending: false, isError: false, data: DETALLE }));
    vi.mocked(useCerrarMes).mockReturnValue(como({ mutate: vi.fn(), isPending: false }));
    vi.mocked(useExportarCierre).mockReturnValue(como({ mutate: vi.fn(), isPending: false }));
    vi.mocked(useRecerrarPeriodo).mockReturnValue(como({ mutate: vi.fn(), isPending: false }));
    // Por defecto: una sola revisión y el diff sin disparar (la query está deshabilitada).
    vi.mocked(useCierreRevisiones).mockReturnValue(como({ isPending: false, isError: false, data: [REVISIONES[1]] }));
    vi.mocked(useCierreDiff).mockReturnValue(como({ isPending: true, isError: false, data: undefined }));
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
    expect(screen.getByText("Julio 2026")).toBeInTheDocument(); // período abierto del aviso
  });

  it("el selector identifica cada foto por su mes Y su corte", () => {
    render(<HistoricoPanel puedeGestionar={false} />);

    // "Junio 2026" solo no alcanza: la foto puede estar tomada al 07-07.
    expect(screen.getByRole("option", { name: /Junio 2026 · al 7\/7\/2026/ })).toBeInTheDocument();
    // El resumen de arriba reparte el texto entre <p> y <span>, así que se matchea por el párrafo.
    const resumen = screen.getByText(
      (_, el) => el?.tagName === "P" && /Foto al\s+7\/7\/2026/.test(el.textContent ?? ""),
    );
    expect(resumen).toBeInTheDocument();
  });

  it("cierra con la fecha del informe que se elige, no con hoy", () => {
    const mutate = vi.fn();
    vi.mocked(useCerrarMes).mockReturnValue(como({ mutate, isPending: false }));
    render(<HistoricoPanel puedeGestionar />);

    fireEvent.click(screen.getByRole("button", { name: /Cerrar mes/ }));

    // El diálogo arranca en hoy, pero la usuaria lo mueve al día en que presentó el informe.
    const fechaInput = screen.getByLabelText(/Fecha del informe/i) as HTMLInputElement;
    expect(fechaInput.value).toBe(hoyIso());
    fireEvent.change(fechaInput, { target: { value: "2026-07-07" } });

    // El del diálogo es el segundo "Cerrar mes" del DOM (el primero es el de la barra).
    const enDialogo = screen.getAllByRole("button", { name: /^Cerrar mes$/ }).at(-1)!;
    fireEvent.click(enDialogo);

    expect(mutate).toHaveBeenCalledWith("2026-07-07");
  });

  it("no deja fechar el cierre en el futuro ni antes del período abierto", () => {
    render(<HistoricoPanel puedeGestionar />);
    fireEvent.click(screen.getByRole("button", { name: /Cerrar mes/ }));

    const fechaInput = screen.getByLabelText(/Fecha del informe/i) as HTMLInputElement;
    expect(fechaInput.max).toBe(hoyIso());
    expect(fechaInput.min).toBe("2026-07-01");   // primer día del período abierto (julio 2026)
  });

  it("el selector de revisión solo aparece si el mes se re-fotografió", () => {
    render(<HistoricoPanel puedeGestionar={false} />);
    expect(screen.queryByLabelText("Revisión")).not.toBeInTheDocument();

    vi.mocked(useCierreRevisiones).mockReturnValue(como({ isPending: false, isError: false, data: REVISIONES }));
    render(<HistoricoPanel puedeGestionar={false} />);

    const selector = screen.getByLabelText("Revisión");
    expect(selector).toBeInTheDocument();
    expect(within(selector).getByRole("option", { name: /Revisión 2 .* vigente/ })).toBeInTheDocument();
    expect(within(selector).getByRole("option", { name: /Revisión 1 · al 7\/7\/2026/ })).toBeInTheDocument();
  });

  it("el diff no se consulta hasta apretar 'Verificar cambios'", () => {
    render(<HistoricoPanel puedeGestionar={false} />);

    // La query arranca deshabilitada: es pesada, no corre sola al abrir la solapa.
    expect(vi.mocked(useCierreDiff)).toHaveBeenCalledWith(2026, 6, false);
    fireEvent.click(screen.getByRole("button", { name: /Verificar cambios/ }));
    expect(vi.mocked(useCierreDiff)).toHaveBeenLastCalledWith(2026, 6, true);
  });

  it("sin cambios confirma que el informe presentado sigue siendo exacto", () => {
    vi.mocked(useCierreDiff).mockReturnValue(como({ isPending: false, isError: false, data: SIN_CAMBIOS }));
    render(<HistoricoPanel puedeGestionar />);

    fireEvent.click(screen.getByRole("button", { name: /Verificar cambios/ }));

    expect(screen.getByText(/Sin cambios/)).toBeInTheDocument();
    // Nada que guardar: no se ofrece crear una revisión.
    expect(screen.queryByRole("button", { name: /revisión nueva/i })).not.toBeInTheDocument();
  });

  it("con retroactivos lista las cuentas y ofrece guardar una revisión nueva", () => {
    const mutate = vi.fn();
    vi.mocked(useRecerrarPeriodo).mockReturnValue(como({ mutate, isPending: false }));
    vi.mocked(useCierreDiff).mockReturnValue(como({ isPending: false, isError: false, data: DIFF_CON_CAMBIOS }));
    render(<HistoricoPanel puedeGestionar />);

    fireEvent.click(screen.getByRole("button", { name: /Verificar cambios/ }));

    expect(resumenDelDiff()).toHaveTextContent("1 cuenta cambió respecto del informe");
    expect(resumenDelDiff()).toHaveTextContent(usd(1500));   // diferencia total

    fireEvent.click(screen.getByRole("button", { name: /revisión nueva/i }));
    // Sin corte: se re-fotografía al mismo día que la revisión vigente.
    expect(mutate).toHaveBeenCalledWith({ anio: 2026, mes: 6 });
  });

  it("sin permiso de gestión se ve el diff pero no se puede re-cerrar", () => {
    vi.mocked(useCierreDiff).mockReturnValue(como({ isPending: false, isError: false, data: DIFF_CON_CAMBIOS }));
    render(<HistoricoPanel puedeGestionar={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Verificar cambios/ }));

    expect(resumenDelDiff()).toHaveTextContent("1 cuenta cambió respecto del informe");
    expect(screen.queryByRole("button", { name: /revisión nueva/i })).not.toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay meses cerrados", () => {
    vi.mocked(useCierrePeriodos).mockReturnValue(como({ isPending: false, isError: false, data: [] }));
    render(<HistoricoPanel puedeGestionar={false} />);

    expect(screen.getByText("Todavía no hay meses cerrados.")).toBeInTheDocument();
  });
});
