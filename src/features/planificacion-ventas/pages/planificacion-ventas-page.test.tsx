import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { PlanificacionVentasPage } from "./planificacion-ventas-page";
import { useContextoPlanificacion, useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useConsolidado } from "../queries/use-consolidado";
import { armarLineasConsolidado } from "../lib/consolidado";
import { useActualizarDatosPlan } from "../queries/use-guardar-plan";
import type { ConsolidadoResponse, ContextoPlanificacion } from "../types";

vi.mock("../queries/use-plan-siembra", () => ({
  useContextoPlanificacion: vi.fn(),
  useVendedoresPlanificacion: vi.fn(),
}));
vi.mock("../queries/use-consolidado", () => ({ useConsolidado: vi.fn() }));
vi.mock("../queries/use-guardar-plan", () => ({ useActualizarDatosPlan: vi.fn() }));
vi.mock("../components/plan-siembra-panel", () => ({
  PlanSiembraPanel: () => {
    const [valor, setValor] = useState("");
    return <input aria-label="Borrador de prueba" value={valor} onChange={(e) => setValor(e.target.value)} />;
  },
}));

const origen = { anterior: 2, campania: 3, total: 5, sorgo: 0, girasol: 0 };
const hectareas = { soja: 10, maiz: null, trigo: null, otro: null, total: 10 };
const total = {
  hectareas,
  mercadoUsd: 100,
  facturacionLcUsd: 25,
  facturacionLcAnteriorUsd: 20,
  variacionLc: 0.25,
  participacionLc: 0.25,
  originacionTn: origen,
  potencialTn: 40,
};
const consolidado: ConsolidadoResponse = {
  campania: "2026-2027",
  datosMacroGestAl: "2026-09-14T10:32:00-03:00",
  filas: [{
    cuit: "20111111112", razonSocial: "Alfa Ficticia", vendedorId: 1,
    vendedor: "Vendedor Ficticio", sucursalId: 1, sucursal: "Sucursal Ficticia",
    hectareas, mercadoUsd: 100, facturacionLcUsd: 25,
    facturacionLcAnteriorUsd: 20, variacionLc: 0.25, participacionLc: 0.25,
    originacionTn: origen, potencialTn: 40, compraInsumos: "si",
  }],
  subtotalesSucursales: [{ id: 1, nombre: "Sucursal Ficticia", totales: total }],
  subtotalesVendedores: [{ id: 1, nombre: "Vendedor Ficticio", totales: total }],
  total,
  totalGeneral: { ...total, facturacionLcUsd: 30 },
  fueraDeCarteras: { facturacionLcUsd: 4, facturacionLcAnteriorUsd: 0, originacionTn: origen, cuits: 1, cuentasSinCuit: 1 },
  ajusteRedondeo: { campaniaUsd: 1, anteriorUsd: 0 },
  sinVendedor: false,
};
const seller: ContextoPlanificacion = {
  campaniaVigente: "2026-2027",
  campanias: [{ codigo: "2026-2027", editable: true }],
  alcance: { veTodo: false, vendedor: { id: 1, nombre: "Vendedor Ficticio", sucursal: "Sucursal Ficticia" } },
};

function preparar(contexto: ContextoPlanificacion, datos: ConsolidadoResponse = consolidado) {
  vi.mocked(useContextoPlanificacion).mockReturnValue({ data: contexto, isError: false } as ReturnType<typeof useContextoPlanificacion>);
  vi.mocked(useVendedoresPlanificacion).mockReturnValue({ data: [{ id: 1, nombre: "Vendedor Ficticio", sucursalId: 1, sucursal: "Sucursal Ficticia", viajantes: [1], usuarioId: null, usuarioNombre: null, activo: true }] } as ReturnType<typeof useVendedoresPlanificacion>);
  vi.mocked(useActualizarDatosPlan).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useActualizarDatosPlan>);
  vi.mocked(useConsolidado).mockReturnValue({ data: datos, isError: false, isPlaceholderData: false } as ReturnType<typeof useConsolidado>);
}

beforeEach(() => vi.clearAllMocks());

describe("solapa Consolidado", () => {
  it("el vendedor no ve selector de vendedor ni fuera de carteras aunque llegue en la respuesta", () => {
    preparar(seller, { ...consolidado, filas: [
      ...consolidado.filas,
      { ...consolidado.filas[0], cuit: "20999999991", razonSocial: "Fuera de la cartera de prueba", vendedorId: 2 },
    ] });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Fuera de carteras \/ sin CUIT/)).not.toBeInTheDocument();
    expect(screen.getByText("Alfa Ficticia")).toBeInTheDocument();
    expect(screen.queryByText("Fuera de la cartera de prueba")).not.toBeInTheDocument();
    expect(useConsolidado).toHaveBeenCalledWith("2026-2027", undefined, undefined, true);
  });

  it("gestión ve fila de conciliación, ajuste y TOTAL; puede agrupar por vendedor", () => {
    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    expect(screen.getByRole("combobox", { name: "Vendedor" })).toBeInTheDocument();
    expect(screen.getByText(/Fuera de carteras \/ sin CUIT/)).toBeInTheDocument();
    expect(screen.getByText("Ajuste de redondeo")).toBeInTheDocument();
    expect(screen.getByText("TOTAL")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Agrupar por" }), { target: { value: "vendedor" } });
    const grupos = screen.getAllByRole("rowgroup");
    expect(grupos.length).toBeGreaterThan(0);
    expect(screen.getByText("Subtotal Vendedor Ficticio")).toBeInTheDocument();
  });

  it("cambiar de solapa conserva el borrador de plan de siembra", () => {
    preparar(seller);
    render(<PlanificacionVentasPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Borrador de prueba" }), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    fireEvent.click(screen.getByRole("tab", { name: "Plan de siembra" }));
    expect(screen.getByRole("textbox", { name: "Borrador de prueba" })).toHaveValue("123");
  });

  it("muestra CEG al milésimo y oculta sorgo/girasol hasta pedirlos", () => {
    preparar(seller, {
      ...consolidado,
      filas: [{ ...consolidado.filas[0], originacionTn: { ...origen, campania: 53054.289, sorgo: 182.152 } }],
      totalGeneral: { ...consolidado.totalGeneral, originacionTn: { ...origen, campania: 53054.289, sorgo: 182.152 } },
    });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    expect(screen.getAllByText("53.054,289").length).toBeGreaterThan(0);
    expect(screen.queryByRole("columnheader", { name: "Sorgo tn" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver sorgo/girasol" }));
    expect(screen.getByRole("columnheader", { name: "Sorgo tn" })).toBeInTheDocument();
    expect(screen.getAllByText("182,152").length).toBeGreaterThan(0);
  });

  it("advierte sobre los 12 renglones en pesos en LC anterior 2025/26", () => {
    preparar({ ...seller, campaniaVigente: "2025-2026", campanias: [{ codigo: "2025-2026", editable: true }] },
      { ...consolidado, campania: "2025-2026" });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    expect(screen.getByText(/LC anterior 2025\/26 incluye 12 renglones facturados en pesos/)).toBeInTheDocument();
  });

  it("un error de refetch del contexto conserva el borrador montado", () => {
    preparar(seller);
    const pagina = render(<PlanificacionVentasPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Borrador de prueba" }), { target: { value: "27" } });
    vi.mocked(useContextoPlanificacion).mockReturnValue({
      data: seller, isError: true, error: new Error("Fallo temporal"), refetch: vi.fn(),
    } as unknown as ReturnType<typeof useContextoPlanificacion>);
    pagina.rerender(<PlanificacionVentasPage />);
    expect(screen.getByRole("textbox", { name: "Borrador de prueba" })).toHaveValue("27");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("concilia carteras, fuera de carteras y ajuste con el TOTAL del servidor", () => {
    const lineas = armarLineasConsolidado(consolidado, "sucursal", true, {});
    const importe = (tipo: string) => lineas.find((linea) => linea.tipo === tipo)?.facturacionLcUsd ?? 0;
    expect(importe("carteras") + importe("fuera") + importe("ajuste")).toBe(importe("total"));
    expect(lineas.find((linea) => linea.tipo === "total")?.facturacionLcUsd).toBe(consolidado.totalGeneral.facturacionLcUsd);
  });
});
