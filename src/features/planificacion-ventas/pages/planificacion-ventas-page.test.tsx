import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { PlanificacionVentasPage } from "./planificacion-ventas-page";
import { useContextoPlanificacion, useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useConsolidado } from "../queries/use-consolidado";
import { armarLineasConsolidado } from "../lib/consolidado";
import { useActualizarDatosPlan } from "../queries/use-guardar-plan";
import { useAvisoCambiosSinGuardar } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import type { ConsolidadoResponse, ContextoPlanificacion } from "../types";

vi.mock("../queries/use-plan-siembra", () => ({
  useContextoPlanificacion: vi.fn(),
  useVendedoresPlanificacion: vi.fn(),
}));
vi.mock("../queries/use-consolidado", () => ({ useConsolidado: vi.fn() }));
vi.mock("../queries/use-guardar-plan", () => ({ useActualizarDatosPlan: vi.fn() }));
vi.mock("@/shared/hooks/use-aviso-cambios-sin-guardar", () => ({
  useAvisoCambiosSinGuardar: vi.fn(),
}));
vi.mock("../components/plan-siembra-panel", () => ({
  PlanSiembraPanel: ({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) => {
    const [valor, setValor] = useState("");
    useEffect(() => onDirtyChange(valor !== ""), [valor, onDirtyChange]);
    return (
      <input
        aria-label="Borrador de prueba"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
    );
  },
}));
vi.mock("../components/market-share-form", () => ({
  MarketShareForm: ({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) => {
    const [valor, setValor] = useState("");
    useEffect(() => onDirtyChange(valor !== ""), [valor, onDirtyChange]);
    return (
      <input
        aria-label="Borrador Market Share"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
    );
  },
}));

vi.mock("../components/vendedores-dialog", () => ({
  VendedoresDialog: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      Diálogo de vendedores
    </button>
  ),
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
  filas: [
    {
      cuit: "20111111112",
      razonSocial: "Alfa Ficticia",
      vendedorId: 1,
      vendedor: "Vendedor Ficticio",
      sucursalId: 1,
      sucursal: "Sucursal Ficticia",
      hectareas,
      mercadoUsd: 100,
      facturacionLcUsd: 25,
      facturacionLcAnteriorUsd: 20,
      variacionLc: 0.25,
      participacionLc: 0.25,
      originacionTn: origen,
      potencialTn: 40,
      compraInsumos: "si",
    },
  ],
  subtotalesSucursales: [{ id: 1, nombre: "Sucursal Ficticia", totales: total }],
  subtotalesVendedores: [{ id: 1, nombre: "Vendedor Ficticio", totales: total }],
  total,
  totalGeneral: { ...total, facturacionLcUsd: 30 },
  fueraDeCarteras: {
    facturacionLcUsd: 4,
    facturacionLcAnteriorUsd: 0,
    originacionTn: origen,
    cuits: 1,
    cuentasSinCuit: 1,
  },
  ajusteRedondeo: { campaniaUsd: 1, anteriorUsd: 0 },
  sinVendedor: false,
};
const seller: ContextoPlanificacion = {
  campaniaVigente: "2026-2027",
  campanias: [{ codigo: "2026-2027", editable: true }],
  alcance: {
    veTodo: false,
    vendedor: { id: 1, nombre: "Vendedor Ficticio", sucursal: "Sucursal Ficticia" },
  },
};

function preparar(contexto: ContextoPlanificacion, datos: ConsolidadoResponse = consolidado) {
  vi.mocked(useContextoPlanificacion).mockReturnValue({
    data: contexto,
    isError: false,
  } as ReturnType<typeof useContextoPlanificacion>);
  vi.mocked(useVendedoresPlanificacion).mockReturnValue({
    data: [
      {
        id: 1,
        nombre: "Vendedor Ficticio",
        sucursalId: 1,
        sucursal: "Sucursal Ficticia",
        viajantes: [1],
        usuarioId: null,
        usuarioNombre: null,
        activo: true,
      },
    ],
  } as ReturnType<typeof useVendedoresPlanificacion>);
  vi.mocked(useActualizarDatosPlan).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useActualizarDatosPlan>);
  vi.mocked(useConsolidado).mockReturnValue({
    data: datos,
    isError: false,
    isPlaceholderData: false,
  } as ReturnType<typeof useConsolidado>);
}

beforeEach(() => vi.clearAllMocks());

describe("ajustes de vendedores", () => {
  it("es exclusivo de gestión y ya no ocupa una solapa", () => {
    preparar(seller);
    const primera = render(<PlanificacionVentasPage />);
    expect(screen.queryByRole("tab", { name: "Vendedores" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajustes" })).not.toBeInTheDocument();
    primera.unmount();

    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } });
    render(<PlanificacionVentasPage />);
    expect(screen.queryByRole("tab", { name: "Vendedores" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Diálogo de vendedores" })).not.toBeInTheDocument();
  });

  it("el botón del encabezado abre y cierra el diálogo", () => {
    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    const dialogo = screen.getByRole("button", { name: "Diálogo de vendedores" });
    // Elegir vendedores guarda al toque: abrirlo no puede encender el aviso de salida.
    expect(useAvisoCambiosSinGuardar).toHaveBeenLastCalledWith(false);
    fireEvent.click(dialogo);
    expect(screen.queryByRole("button", { name: "Diálogo de vendedores" })).not.toBeInTheDocument();
  });
});

describe("solapa Consolidado", () => {
  it("buscar deja sólo al productor y reemplaza los pies por un TOTAL filtrado", () => {
    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } }, {
      ...consolidado,
      filas: [
        ...consolidado.filas,
        { ...consolidado.filas[0], cuit: "30999999991", razonSocial: "Beta Ficticia" },
      ],
    });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    expect(screen.getByText("Alfa Ficticia")).toBeInTheDocument();
    expect(screen.getByText("Beta Ficticia")).toBeInTheDocument();

    const buscar = screen.getByRole("textbox", { name: "Buscar productor" });
    fireEvent.change(buscar, { target: { value: "beta" } });
    expect(screen.queryByText("Alfa Ficticia")).not.toBeInTheDocument();
    expect(screen.getByText("Beta Ficticia")).toBeInTheDocument();
    expect(screen.getByText("TOTAL FILTRADO")).toBeInTheDocument();
    expect(screen.queryByText("Total carteras")).not.toBeInTheDocument();
    expect(screen.queryByText("Ajuste de redondeo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Fuera de carteras/)).not.toBeInTheDocument();

    fireEvent.change(buscar, { target: { value: "no existe ningún productor así" } });
    expect(screen.getByText(/Ningún productor coincide/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Consolidado de clientes" })).not.toBeInTheDocument();

    fireEvent.change(buscar, { target: { value: "" } });
    expect(screen.getByText("Alfa Ficticia")).toBeInTheDocument();
    expect(screen.getByText("Ajuste de redondeo")).toBeInTheDocument();
  });

  it("el vendedor no ve selector de vendedor ni fuera de carteras aunque llegue en la respuesta", () => {
    preparar(seller, {
      ...consolidado,
      filas: [
        ...consolidado.filas,
        {
          ...consolidado.filas[0],
          cuit: "20999999991",
          razonSocial: "Fuera de la cartera de prueba",
          vendedorId: 2,
        },
      ],
    });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    expect(screen.queryByRole("button", { name: "Vendedor" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Fuera de carteras \/ sin CUIT/)).not.toBeInTheDocument();
    expect(screen.getByText("Alfa Ficticia")).toBeInTheDocument();
    expect(screen.queryByText("Fuera de la cartera de prueba")).not.toBeInTheDocument();
    expect(useConsolidado).toHaveBeenCalledWith("2026-2027", [], undefined, true);
  });

  it("gestión ve la conciliación, el ajuste y el TOTAL agrupados por vendedor", () => {
    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    expect(screen.getByRole("button", { name: "Vendedor" })).toBeInTheDocument();
    expect(screen.getByText(/Fuera de carteras \/ sin CUIT/)).toBeInTheDocument();
    expect(screen.getByText("Ajuste de redondeo")).toBeInTheDocument();
    expect(screen.getByText("TOTAL")).toBeInTheDocument();
    const grupos = screen.getAllByRole("rowgroup");
    expect(grupos.length).toBeGreaterThan(0);
    expect(screen.getByText("Subtotal Vendedor Ficticio")).toBeInTheDocument();
  });

  it("gestión elige varios vendedores y la consulta los pide juntos", () => {
    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } });
    vi.mocked(useVendedoresPlanificacion).mockReturnValue({
      data: [
        { id: 1, nombre: "Vendedor Ficticio", sucursalId: 1, sucursal: "Sucursal Ficticia",
          viajantes: [1], usuarioId: null, usuarioNombre: null, activo: true },
        { id: 2, nombre: "Vendedor Segundo", sucursalId: 1, sucursal: "Sucursal Ficticia",
          viajantes: [2], usuarioId: null, usuarioNombre: null, activo: true },
      ],
    } as ReturnType<typeof useVendedoresPlanificacion>);
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));

    expect(useConsolidado).toHaveBeenLastCalledWith("2026-2027", [], undefined, true);
    fireEvent.click(screen.getByRole("button", { name: "Vendedor" }));
    fireEvent.click(screen.getByLabelText("Vendedor Ficticio"));
    expect(useConsolidado).toHaveBeenLastCalledWith("2026-2027", [1], undefined, true);
    fireEvent.click(screen.getByLabelText("Vendedor Segundo"));
    expect(useConsolidado).toHaveBeenLastCalledWith("2026-2027", [1, 2], undefined, true);
    fireEvent.click(screen.getByText("Limpiar"));
    expect(useConsolidado).toHaveBeenLastCalledWith("2026-2027", [], undefined, true);
  });

  it("plegar un vendedor esconde su detalle y deja sus totales en el renglón del grupo", () => {
    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));

    const grupo = screen.getByRole("button", { name: /Vendedor: Vendedor Ficticio/ });
    expect(grupo).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Alfa Ficticia")).toBeInTheDocument();

    fireEvent.click(grupo);
    expect(screen.queryByText("Alfa Ficticia")).not.toBeInTheDocument();
    expect(screen.queryByText("Subtotal Vendedor Ficticio")).not.toBeInTheDocument();
    const renglon = screen.getByRole("button", { name: /Vendedor: Vendedor Ficticio/ }).closest("tr");
    expect(renglon).toHaveTextContent("US$ 25,00");
    // El TOTAL y el ajuste no viven en ningún grupo: no se pliegan con él.
    expect(screen.getByText("TOTAL")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Vendedor: Vendedor Ficticio/ }));
    expect(screen.getByText("Alfa Ficticia")).toBeInTheDocument();
  });

  it("«Colapsar todo» pliega los grupos y el mismo botón los despliega", () => {
    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));

    fireEvent.click(screen.getByRole("button", { name: "Colapsar todo" }));
    expect(screen.queryByText("Alfa Ficticia")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desplegar todo" }));
    expect(screen.getByText("Alfa Ficticia")).toBeInTheDocument();
  });

  it("cambiar de solapa conserva el borrador de plan de siembra", () => {
    preparar(seller);
    render(<PlanificacionVentasPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Borrador de prueba" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    fireEvent.click(screen.getByRole("tab", { name: "Plan de siembra" }));
    expect(screen.getByRole("textbox", { name: "Borrador de prueba" })).toHaveValue("123");
  });

  it("conserva los dos borradores al cambiar solapas y usa un guard combinado", () => {
    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } });
    render(<PlanificacionVentasPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Borrador de prueba" }), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Market Share" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Borrador Market Share" }), {
      target: { value: "9" },
    });
    expect(useAvisoCambiosSinGuardar).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("tab", { name: "Plan de siembra" }));
    expect(screen.getByRole("textbox", { name: "Borrador de prueba" })).toHaveValue("12");
    fireEvent.click(screen.getByRole("tab", { name: "Market Share" }));
    expect(screen.getByRole("textbox", { name: "Borrador Market Share" })).toHaveValue("9");
    fireEvent.change(screen.getByRole("textbox", { name: "Borrador Market Share" }), {
      target: { value: "" },
    });
    expect(useAvisoCambiosSinGuardar).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("tab", { name: "Plan de siembra" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Borrador de prueba" }), {
      target: { value: "" },
    });
    expect(useAvisoCambiosSinGuardar).toHaveBeenLastCalledWith(false);
  });

  it("muestra CEG al milésimo y oculta sorgo/girasol hasta pedirlos", () => {
    preparar(seller, {
      ...consolidado,
      filas: [
        {
          ...consolidado.filas[0],
          originacionTn: { ...origen, campania: 53054.289, sorgo: 182.152 },
        },
      ],
      totalGeneral: {
        ...consolidado.totalGeneral,
        originacionTn: { ...origen, campania: 53054.289, sorgo: 182.152 },
      },
    });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    expect(screen.getAllByText("53.054,289").length).toBeGreaterThan(0);
    expect(screen.queryByRole("columnheader", { name: "Sorgo tn" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver sorgo/girasol" }));
    expect(screen.getByRole("columnheader", { name: "Sorgo tn" })).toBeInTheDocument();
    expect(screen.getAllByText("182,152").length).toBeGreaterThan(0);
  });

  it("no repite el criterio de cálculo en pantalla: sólo la fuente de datos y «Actualizar»", () => {
    preparar(
      {
        ...seller,
        campaniaVigente: "2025-2026",
        campanias: [{ codigo: "2025-2026", editable: true }],
      },
      { ...consolidado, campania: "2025-2026" },
    );
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));
    // Las leyendas viven sólo en el PDF (ver lib/leyendas.ts).
    expect(screen.queryByText(/Facturación LC: comprobantes del 1-abr/)).not.toBeInTheDocument();
    expect(screen.queryByText(/diferencia entre importes por CUIT/)).not.toBeInTheDocument();
    expect(screen.queryByText(/LC anterior 2025\/26 incluye 12 renglones/)).not.toBeInTheDocument();
    expect(screen.getByText(/Datos de MacroGest al/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
  });

  it("manda la fuente de datos al encabezado, arriba a la derecha del título", () => {
    preparar({ ...seller, alcance: { veTodo: true, vendedor: null } });
    render(<PlanificacionVentasPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Consolidado" }));

    const encabezado = screen.getByRole("heading", { name: "Planificación de Ventas" })
      .parentElement?.parentElement;
    expect(encabezado).toContainElement(screen.getByText(/Datos de MacroGest al/));
    expect(encabezado).toContainElement(screen.getByRole("button", { name: "Actualizar" }));
  });

  it("un error de refetch del contexto conserva el borrador montado", () => {
    preparar(seller);
    const pagina = render(<PlanificacionVentasPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Borrador de prueba" }), {
      target: { value: "27" },
    });
    vi.mocked(useContextoPlanificacion).mockReturnValue({
      data: seller,
      isError: true,
      error: new Error("Fallo temporal"),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useContextoPlanificacion>);
    pagina.rerender(<PlanificacionVentasPage />);
    expect(screen.getByRole("textbox", { name: "Borrador de prueba" })).toHaveValue("27");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("concilia carteras, fuera de carteras y ajuste con el TOTAL del servidor", () => {
    const lineas = armarLineasConsolidado(consolidado, "sucursal", true, {});
    // La cabecera de grupo no repite números: el subtotal viaja aparte, para la vista plegada.
    expect(lineas.find((linea) => linea.tipo === "grupo")?.facturacionLcUsd).toBeUndefined();
    const importe = (tipo: string) =>
      lineas.find((linea) => linea.tipo === tipo)?.facturacionLcUsd ?? 0;
    expect(importe("carteras") + importe("fuera") + importe("ajuste")).toBe(importe("total"));
    expect(lineas.find((linea) => linea.tipo === "total")?.facturacionLcUsd).toBe(
      consolidado.totalGeneral.facturacionLcUsd,
    );
  });
});
