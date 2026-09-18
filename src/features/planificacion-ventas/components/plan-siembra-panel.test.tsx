import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanSiembraPanel } from "./plan-siembra-panel";
import { usePlanSiembra, useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useGuardarPlan, useActualizarDatosPlan } from "../queries/use-guardar-plan";
import type { ContextoPlanificacion, PlanSiembraGrilla } from "../types";

vi.mock("../queries/use-plan-siembra", () => ({
  usePlanSiembra: vi.fn(),
  useVendedoresPlanificacion: vi.fn(),
}));
vi.mock("../queries/use-guardar-plan", () => ({
  useGuardarPlan: vi.fn(),
  useActualizarDatosPlan: vi.fn(),
}));
vi.mock("@/shared/hooks/use-aviso-cambios-sin-guardar", () => ({
  confirmarCambioConBorrador: () => true,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const contexto: ContextoPlanificacion = {
  campaniaVigente: "2026-2027",
  campanias: [
    { codigo: "2026-2027", editable: true },
    { codigo: "2025-2026", editable: false },
  ],
  alcance: {
    veTodo: false,
    vendedor: { id: 1, nombre: "Vendedor Ficticio", sucursal: "Sucursal" },
  },
};
const data: PlanSiembraGrilla = {
  campania: "2026-2027",
  editable: true,
  datosMacroGestAl: "2026-09-14T10:32:00-03:00",
  marketShare: {
    soja: { costoUsdHa: 292.5, rindeTnHa: 4 },
    maiz: { costoUsdHa: 612, rindeTnHa: 8 },
    trigo: { costoUsdHa: 330, rindeTnHa: 3 },
  },
  sinVendedor: false,
  filas: [
    {
      cuit: "20111111112",
      razonSocial: "Alfa Ficticia",
      cuentas: [1],
      vendedor: { id: 1, nombre: "Vendedor Ficticio" },
      sucursal: "Sucursal",
      conMovimiento: true,
      plan: null,
      revision: 0,
      anterior: { soja: 12, maiz: null, trigo: null, otro: null },
      modificadoPor: null,
      modificadoEl: null,
    },
    {
      cuit: "20999999991",
      razonSocial: "Beta Ficticia",
      cuentas: [77],
      vendedor: { id: 1, nombre: "Vendedor Ficticio" },
      sucursal: "Sucursal",
      conMovimiento: true,
      plan: null,
      revision: 0,
      anterior: null,
      modificadoPor: null,
      modificadoEl: null,
    },
  ],
};
const guardar = vi.fn();
const recargar = vi.fn();

function errorHttp(status: number, body: object) {
  return new AxiosError("Request failed", String(status), undefined, null, {
    data: body,
    status,
    statusText: "Error",
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  guardar.mockResolvedValue({ guardados: [] });
  recargar.mockResolvedValue({ data });
  vi.mocked(usePlanSiembra).mockReturnValue({
    data,
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: recargar,
  } as unknown as ReturnType<typeof usePlanSiembra>);
  vi.mocked(useVendedoresPlanificacion).mockReturnValue({
    data: [
      {
        id: 1,
        nombre: "Vendedor Ficticio",
        sucursalId: 1,
        sucursal: "Sucursal",
        viajantes: [1],
        usuarioId: null,
        usuarioNombre: null,
        activo: true,
      },
    ],
  } as unknown as ReturnType<typeof useVendedoresPlanificacion>);
  vi.mocked(useGuardarPlan).mockReturnValue({
    mutateAsync: guardar,
    isPending: false,
  } as unknown as ReturnType<typeof useGuardarPlan>);
  vi.mocked(useActualizarDatosPlan).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useActualizarDatosPlan>);
});

describe("plan de siembra", () => {
  it("buscar por CUIT o cuenta conserva el borrador al ocultar y volver a mostrar", () => {
    render(<PlanSiembraPanel contexto={contexto} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }), {
      target: { value: "25" },
    });
    const buscar = screen.getByRole("textbox", { name: "Buscar productor" });
    fireEvent.change(buscar, { target: { value: "77" } });
    expect(screen.queryByText("Alfa Ficticia")).not.toBeInTheDocument();
    fireEvent.change(buscar, { target: { value: "20111111112" } });
    expect(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" })).toHaveValue(
      "25",
    );
    expect(screen.getByText("1 productor modificado")).toBeInTheDocument();
  });

  it("una celda inválida bloquea guardar y los cambios válidos viajan en un solo lote", async () => {
    render(<PlanSiembraPanel contexto={contexto} />);
    const celda = screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" });
    fireEvent.change(celda, { target: { value: "abc" } });
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    fireEvent.change(celda, { target: { value: "1.200" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith({
        campania: "2026-2027",
        request: {
          items: [
            {
              cuit: "20111111112",
              soja: 1200,
              maiz: null,
              trigo: null,
              otro: null,
              revisionEsperada: 0,
            },
          ],
        },
      }),
    );
  });

  it("409 marca el CUIT en conflicto y permite recargar", async () => {
    guardar.mockRejectedValue(
      errorHttp(409, { codigo: "plan_modificado", cuits: ["20111111112"] }),
    );
    render(<PlanSiembraPanel contexto={contexto} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Conflicto")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recargar estas filas" }));
    await waitFor(() => expect(recargar).toHaveBeenCalled());
  });

  it("una recarga fallida tras 409 conserva el borrador y el conflicto", async () => {
    guardar.mockRejectedValue(
      errorHttp(409, { codigo: "plan_modificado", cuits: ["20111111112"] }),
    );
    recargar.mockResolvedValueOnce({ isError: true, data });
    render(<PlanSiembraPanel contexto={contexto} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Conflicto")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recargar estas filas" }));
    expect(await screen.findByText(/Conservamos tus cambios/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" })).toHaveValue(
      "3",
    );
    expect(screen.getByText("Conflicto")).toBeInTheDocument();
  });

  it("si guardó pero falló la recarga lo informa y bloquea edición hasta reintentar", async () => {
    recargar.mockResolvedValueOnce({ isError: true, data });
    render(<PlanSiembraPanel contexto={contexto} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(
      await screen.findByText(/El plan se guardó, pero no se pudo recargar/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }),
    ).not.toBeInTheDocument();
    expect(guardar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Recargar datos" }));
    expect(
      await screen.findByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }),
    ).toBeInTheDocument();
  });

  it("refetch de B no cambia la revisión ni los otros cultivos del borrador de A", async () => {
    const inicial: PlanSiembraGrilla = {
      ...data,
      filas: [
        { ...data.filas[0], plan: { soja: 10, maiz: 5, trigo: null, otro: null }, revision: 1 },
      ],
    };
    const nuevo: PlanSiembraGrilla = {
      ...inicial,
      filas: [
        { ...inicial.filas[0], plan: { soja: 30, maiz: 9, trigo: null, otro: null }, revision: 2 },
      ],
    };
    vi.mocked(usePlanSiembra).mockReturnValue({
      data: inicial,
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof usePlanSiembra>);
    const { rerender } = render(<PlanSiembraPanel contexto={contexto} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }), {
      target: { value: "20" },
    });
    vi.mocked(usePlanSiembra).mockReturnValue({
      data: nuevo,
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof usePlanSiembra>);
    rerender(<PlanSiembraPanel contexto={contexto} />);
    expect(screen.getByRole("textbox", { name: "Hectáreas de maíz de Alfa Ficticia" })).toHaveValue(
      "5",
    );
    guardar.mockRejectedValue(
      errorHttp(409, { codigo: "plan_modificado", cuits: ["20111111112"] }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith({
        campania: "2026-2027",
        request: {
          items: [
            {
              cuit: "20111111112",
              soja: 20,
              maiz: 5,
              trigo: null,
              otro: null,
              revisionEsperada: 1,
            },
          ],
        },
      }),
    );
    expect(await screen.findByText("Conflicto")).toBeInTheDocument();
  });

  it("valor igual tras blur libera base y refleja refetch posterior", () => {
    const inicial: PlanSiembraGrilla = {
      ...data,
      filas: [
        { ...data.filas[0], plan: { soja: 10, maiz: null, trigo: null, otro: null }, revision: 1 },
      ],
    };
    const nuevo: PlanSiembraGrilla = {
      ...inicial,
      filas: [
        {
          ...inicial.filas[0],
          plan: { soja: 30, maiz: null, trigo: null, otro: null },
          revision: 2,
        },
      ],
    };
    vi.mocked(usePlanSiembra).mockReturnValue({
      data: inicial,
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof usePlanSiembra>);
    const { rerender } = render(<PlanSiembraPanel contexto={contexto} />);
    const celda = screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" });
    fireEvent.change(celda, { target: { value: "10,0" } });
    fireEvent.blur(celda);
    vi.mocked(usePlanSiembra).mockReturnValue({
      data: nuevo,
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof usePlanSiembra>);
    rerender(<PlanSiembraPanel contexto={contexto} />);
    expect(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" })).toHaveValue(
      "30",
    );
    expect(screen.queryByText("1 productor modificado")).not.toBeInTheDocument();
  });

  it("Escape libera base sin cambios y deja ver refetch posterior", () => {
    const inicial: PlanSiembraGrilla = {
      ...data,
      filas: [
        { ...data.filas[0], plan: { soja: 10, maiz: null, trigo: null, otro: null }, revision: 1 },
      ],
    };
    const nuevo: PlanSiembraGrilla = {
      ...inicial,
      filas: [
        {
          ...inicial.filas[0],
          plan: { soja: 30, maiz: null, trigo: null, otro: null },
          revision: 2,
        },
      ],
    };
    vi.mocked(usePlanSiembra).mockReturnValue({
      data: inicial,
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof usePlanSiembra>);
    const { rerender } = render(<PlanSiembraPanel contexto={contexto} />);
    const celda = screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" });
    fireEvent.change(celda, { target: { value: "20" } });
    fireEvent.keyDown(celda, { key: "Escape" });
    expect(celda).toHaveValue("10");
    vi.mocked(usePlanSiembra).mockReturnValue({
      data: nuevo,
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof usePlanSiembra>);
    rerender(<PlanSiembraPanel contexto={contexto} />);
    expect(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" })).toHaveValue(
      "30",
    );
    expect(screen.queryByText("1 productor modificado")).not.toBeInTheDocument();
  });

  it("recargar un CUIT en conflicto conserva la base congelada de otro productor", async () => {
    const inicial: PlanSiembraGrilla = {
      ...data,
      filas: data.filas.map((fila) => ({
        ...fila,
        plan: { soja: 1, maiz: null, trigo: null, otro: null },
        revision: 1,
      })),
    };
    const nuevo: PlanSiembraGrilla = {
      ...inicial,
      filas: inicial.filas.map((fila) => ({
        ...fila,
        plan: { soja: 9, maiz: 8, trigo: null, otro: null },
        revision: 2,
      })),
    };
    vi.mocked(usePlanSiembra).mockReturnValue({
      data: inicial,
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof usePlanSiembra>);
    render(<PlanSiembraPanel contexto={contexto} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Hectáreas de soja de Beta Ficticia" }), {
      target: { value: "4" },
    });
    guardar.mockRejectedValueOnce(
      errorHttp(409, { codigo: "plan_modificado", cuits: ["20111111112"] }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Conflicto")).toBeInTheDocument();
    recargar.mockResolvedValueOnce({ data: nuevo });
    vi.mocked(usePlanSiembra).mockReturnValue({
      data: nuevo,
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof usePlanSiembra>);
    fireEvent.click(screen.getByRole("button", { name: "Recargar estas filas" }));
    await waitFor(() => expect(screen.queryByText("Conflicto")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Hectáreas de soja de Beta Ficticia" })).toHaveValue(
      "4",
    );
    expect(screen.getByRole("textbox", { name: "Hectáreas de maíz de Beta Ficticia" })).toHaveValue(
      "",
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(guardar).toHaveBeenLastCalledWith({
        campania: "2026-2027",
        request: {
          items: [
            {
              cuit: "20999999991",
              soja: 4,
              maiz: null,
              trigo: null,
              otro: null,
              revisionEsperada: 1,
            },
          ],
        },
      }),
    );
  });

  it("400 asocia Items[n] con la celda del CUIT enviado", async () => {
    guardar.mockRejectedValue(
      errorHttp(400, { codigo: "validation", errors: { "Items[0].Soja": ["Valor rechazado."] } }),
    );
    render(<PlanSiembraPanel contexto={contexto} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Valor rechazado.")).toBeInTheDocument();
  });

  it("muestra placeholder de otra campaña pero bloquea la edición", () => {
    render(<PlanSiembraPanel contexto={contexto} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Campaña" }), {
      target: { value: "2025-2026" },
    });
    expect(screen.getByText(/Cargando campaña 2025-2026/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Hectáreas de soja/ })).not.toBeInTheDocument();
  });

  it("gestión consulta y guarda solamente el vendedor elegido", async () => {
    const gestion: ContextoPlanificacion = {
      ...contexto,
      alcance: { veTodo: true, vendedor: null },
    };
    render(<PlanSiembraPanel contexto={gestion} />);
    const selector = screen.getByRole("combobox", { name: "Vendedor" });
    expect(within(selector).queryByRole("option", { name: "Todos" })).not.toBeInTheDocument();
    fireEvent.change(selector, { target: { value: "1" } });
    expect(vi.mocked(usePlanSiembra).mock.lastCall).toEqual(["2026-2027", 1, true, true]);
    expect(screen.getByRole("checkbox", { name: "Incluir activos sin movimiento" })).toBeChecked();
    fireEvent.change(screen.getByRole("textbox", { name: "Hectáreas de soja de Alfa Ficticia" }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith({
        campania: "2026-2027",
        request: {
          vendedorId: 1,
          items: [
            {
              cuit: "20111111112",
              soja: 3,
              maiz: null,
              trigo: null,
              otro: null,
              revisionEsperada: 0,
            },
          ],
        },
      }),
    );
  });

  it("gestión ofrece de entrada los vendedores activos de MacroGest", () => {
    vi.mocked(useVendedoresPlanificacion).mockReturnValue({
      data: [
        { id: 1, nombre: "TRUCCO JUAN JOSE", activo: true, sucursalId: null,
          sucursal: "", viajantes: [3], usuarioId: null, usuarioNombre: null },
        { id: 2, nombre: "MOSTRADOR", activo: false, sucursalId: null,
          sucursal: "", viajantes: [1], usuarioId: null, usuarioNombre: null },
      ],
    } as unknown as ReturnType<typeof useVendedoresPlanificacion>);
    render(<PlanSiembraPanel contexto={{ ...contexto, alcance: { veTodo: true, vendedor: null } }} />);
    const selector = screen.getByRole("combobox", { name: "Vendedor" });
    expect(within(selector).getByRole("option", { name: "TRUCCO JUAN JOSE" })).toBeInTheDocument();
    expect(within(selector).queryByRole("option", { name: "MOSTRADOR" })).not.toBeInTheDocument();
  });

  it("explica cuando un vendedor activo no tiene clientes con CUIT cargable", () => {
    vi.mocked(usePlanSiembra).mockReturnValue({
      data: { ...data, filas: [] }, isPending: false, isError: false,
      isPlaceholderData: false, isFetching: false, refetch: recargar,
    } as unknown as ReturnType<typeof usePlanSiembra>);
    render(<PlanSiembraPanel contexto={{ ...contexto, alcance: { veTodo: true, vendedor: null } }} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Vendedor" }), { target: { value: "1" } });
    expect(screen.getByText(/no tiene clientes con CUIT válido para cargar el plan/i)).toBeInTheDocument();
  });

  it("gestión debe elegir vendedor; un usuario sin vendedor ve EmptyState", () => {
    const gestion: ContextoPlanificacion = {
      ...contexto,
      alcance: { veTodo: true, vendedor: null },
    };
    const { rerender } = render(<PlanSiembraPanel contexto={gestion} />);
    expect(screen.getByText(/Elegí un vendedor para cargar/)).toBeInTheDocument();
    expect(vi.mocked(usePlanSiembra).mock.lastCall?.[3]).toBe(false);
    rerender(
      <PlanSiembraPanel contexto={{ ...contexto, alcance: { veTodo: false, vendedor: null } }} />,
    );
    expect(screen.getByText(/Tu usuario no tiene cartera asignada/)).toBeInTheDocument();
  });
});
