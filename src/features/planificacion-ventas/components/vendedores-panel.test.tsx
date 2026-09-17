import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VendedoresPanel } from "./vendedores-panel";
import { useActualizarDatosPlan } from "../queries/use-guardar-plan";
import { useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import {
  useControlPadron, useGuardarSucursal, useGuardarVendedor, useSucursales,
  useUsuariosAsignables, useViajantesMacroGest,
} from "../queries/use-vendedores";
import type { ContextoPlanificacion, ControlPadron } from "../types";

vi.mock("../queries/use-plan-siembra", () => ({ useVendedoresPlanificacion: vi.fn() }));
vi.mock("../queries/use-guardar-plan", () => ({ useActualizarDatosPlan: vi.fn() }));
vi.mock("../queries/use-vendedores", () => ({
  useControlPadron: vi.fn(), useGuardarSucursal: vi.fn(), useGuardarVendedor: vi.fn(),
  useSucursales: vi.fn(), useUsuariosAsignables: vi.fn(), useViajantesMacroGest: vi.fn(),
}));

const contexto: ContextoPlanificacion = {
  campaniaVigente: "2026-2027",
  campanias: [{ codigo: "2026-2027", editable: true }],
  alcance: { veTodo: true, vendedor: null },
};
const control: ControlPadron = {
  campania: "2026-2027",
  datosMacroGestAl: "2026-09-17T12:00:00-03:00",
  codigosSinVendedorConMovimiento: [{ codigo: 99, cuentas: 3 }],
  cuitsAmbiguos: 2,
  productoresPorVendedor: [],
  cuentasSinCuitValidoPorVendedor: [{ vendedorId: 1, cuentas: 4 }],
  cuentasSinClienteConMovimiento: 1,
  facturacionSinCuitUsd: { cuentas: 2, total: 50 },
  originacionSinCuitTn: { cuentas: 1, total: 3 },
};
const guardarSucursal = vi.fn().mockResolvedValue(undefined);
const retryControl = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  guardarSucursal.mockResolvedValue(undefined);
  vi.mocked(useSucursales).mockReturnValue({
    data: [{ id: 1, nombre: "Sucursal A", activa: true }],
    isError: false,
  } as ReturnType<typeof useSucursales>);
  vi.mocked(useVendedoresPlanificacion).mockReturnValue({
    data: [{
      id: 1, nombre: "Vendedor A", sucursalId: 1, sucursal: "Sucursal A",
      viajantes: [10], usuarioId: null, usuarioNombre: null, activo: true,
    }],
    isError: false,
  } as ReturnType<typeof useVendedoresPlanificacion>);
  vi.mocked(useViajantesMacroGest).mockReturnValue({
    data: [{ codigo: 10, nombre: "Viajante de prueba", vendedorId: 1, vendedorNombre: "Vendedor A" }],
    isError: false,
  } as ReturnType<typeof useViajantesMacroGest>);
  vi.mocked(useUsuariosAsignables).mockReturnValue({
    data: [], isError: false,
  } as unknown as ReturnType<typeof useUsuariosAsignables>);
  vi.mocked(useControlPadron).mockReturnValue({
    data: control, isError: false, isFetching: false, isStale: false, refetch: retryControl,
  } as unknown as ReturnType<typeof useControlPadron>);
  vi.mocked(useGuardarSucursal).mockReturnValue({
    mutateAsync: guardarSucursal, isPending: false,
  } as unknown as ReturnType<typeof useGuardarSucursal>);
  vi.mocked(useGuardarVendedor).mockReturnValue({
    mutateAsync: vi.fn(), isPending: false,
  } as unknown as ReturnType<typeof useGuardarVendedor>);
  vi.mocked(useActualizarDatosPlan).mockReturnValue({
    mutateAsync: vi.fn(), isPending: false,
  } as unknown as ReturnType<typeof useActualizarDatosPlan>);
});

describe("solapa Vendedores", () => {
  it("crea, renombra y desactiva sucursales desde el ABM", async () => {
    render(<VendedoresPanel contexto={contexto} activo onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Nueva sucursal" }), {
      target: { value: "Sucursal B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar sucursal" }));
    await waitFor(() => expect(guardarSucursal).toHaveBeenCalledWith({
      nombre: "Sucursal B", activa: true,
    }));

    const seccion = screen.getByText("Sucursales comerciales").closest("section")!;
    fireEvent.click(within(seccion).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
      target: { value: "Sucursal Renombrada" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Activa" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(guardarSucursal).toHaveBeenCalledWith({
      id: 1, nombre: "Sucursal Renombrada", activa: false,
    }));
  });

  it("muestra código y nombre, espera el control antes de dar cero y permite reintentar", () => {
    vi.mocked(useControlPadron).mockReturnValue({
      data: undefined, isError: false, isFetching: true, isStale: true, refetch: retryControl,
    } as unknown as ReturnType<typeof useControlPadron>);
    const { rerender } = render(
      <VendedoresPanel contexto={contexto} activo onDirtyChange={vi.fn()} />,
    );
    const fila = screen.getByRole("row", { name: /Vendedor A/ });
    expect(within(fila).getAllByRole("cell")[2]).toHaveTextContent("10 Viajante de prueba");
    expect(within(fila).getAllByRole("cell")[5]).toHaveTextContent("—");

    vi.mocked(useControlPadron).mockReturnValue({
      data: control, isError: false, isFetching: false, isStale: false, refetch: retryControl,
    } as unknown as ReturnType<typeof useControlPadron>);
    rerender(<VendedoresPanel contexto={contexto} activo onDirtyChange={vi.fn()} />);
    expect(within(fila).getAllByRole("cell")[5]).toHaveTextContent("0");
    expect(screen.getByText("Código 99")).toBeInTheDocument();

    vi.mocked(useControlPadron).mockReturnValue({
      data: control, isError: true, error: new Error("Falla"), isFetching: false,
      isStale: true, refetch: retryControl,
    } as unknown as ReturnType<typeof useControlPadron>);
    rerender(<VendedoresPanel contexto={contexto} activo onDirtyChange={vi.fn()} />);
    expect(within(fila).getAllByRole("cell")[5]).toHaveTextContent("—");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retryControl).toHaveBeenCalledOnce();
  });

  it("un diálogo con borrador impide abrir otro desde el fondo con teclado", () => {
    render(<VendedoresPanel contexto={contexto} activo onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo vendedor" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre del vendedor" }), {
      target: { value: "Borrador pendiente" },
    });
    const dialogo = screen.getByRole("dialog", { name: "Nuevo vendedor" });
    const editarFondo = within(screen.getByRole("row", { name: /Vendedor A/ }))
      .getByRole("button", { name: "Editar" });
    expect(editarFondo).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nuevo vendedor" })).toBeDisabled();
    fireEvent.keyDown(editarFondo, { key: "Tab" });
    fireEvent.click(editarFondo);
    expect(screen.getByRole("dialog", { name: "Nuevo vendedor" })).toBe(dialogo);
    expect(screen.getByRole("textbox", { name: "Nombre del vendedor" }))
      .toHaveValue("Borrador pendiente");
  });

  it("no consulta ni muestra el panel sin permiso de gestión", () => {
    render(<VendedoresPanel contexto={{ ...contexto, alcance: {
      veTodo: false, vendedor: null,
    } }} activo onDirtyChange={vi.fn()} />);
    expect(screen.queryByText("Sucursales comerciales")).not.toBeInTheDocument();
    expect(useControlPadron).toHaveBeenCalledWith("2026-2027", false);
  });
});
