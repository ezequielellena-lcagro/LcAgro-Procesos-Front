import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VendedoresPanel } from "./vendedores-panel";
import { useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useCambiarActivoVendedor } from "../queries/use-vendedores";
import type { ContextoPlanificacion } from "../types";

vi.mock("../queries/use-plan-siembra", () => ({ useVendedoresPlanificacion: vi.fn() }));
vi.mock("../queries/use-vendedores", () => ({ useCambiarActivoVendedor: vi.fn() }));

const contexto: ContextoPlanificacion = {
  campaniaVigente: "2026-2027",
  campanias: [{ codigo: "2026-2027", editable: true }],
  alcance: { veTodo: true, vendedor: null },
};
const cambiar = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  cambiar.mockResolvedValue(undefined);
  vi.mocked(useVendedoresPlanificacion).mockReturnValue({
    data: [
      { id: 1, nombre: "TRUCCO JUAN JOSE", sucursalId: null, sucursal: "",
        viajantes: [3], usuarioId: null, usuarioNombre: null, activo: true },
      { id: 2, nombre: "ASL", sucursalId: null, sucursal: "",
        viajantes: [20], usuarioId: null, usuarioNombre: null, activo: false },
    ], isError: false,
  } as ReturnType<typeof useVendedoresPlanificacion>);
  vi.mocked(useCambiarActivoVendedor).mockReturnValue({
    mutateAsync: cambiar, isPending: false,
  } as unknown as ReturnType<typeof useCambiarActivoVendedor>);
});

describe("solapa Vendedores", () => {
  it("muestra el catálogo completo sin pedir nombre ni sucursal", () => {
    render(<VendedoresPanel contexto={contexto} activo onDirtyChange={vi.fn()} />);
    expect(screen.queryByText("Sucursales comerciales")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurar" })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /TRUCCO JUAN JOSE/ })).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /ASL/ }))
      .getByRole("checkbox", { name: "Mostrar ASL" })).not.toBeChecked();
    expect(screen.queryByRole("textbox", { name: "Buscar vendedor" })).not.toBeInTheDocument();
  });

  it("habilita un viajante para que aparezca en el plan", async () => {
    render(<VendedoresPanel contexto={contexto} activo onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar ASL" }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith({ id: 2, activo: true }));
  });

  it("sólo consulta el catálogo con permiso de gestión", () => {
    render(<VendedoresPanel contexto={{ ...contexto, alcance: {
      veTodo: false, vendedor: null,
    } }} activo onDirtyChange={vi.fn()} />);
    expect(screen.queryByText("Vendedores")).not.toBeInTheDocument();
    expect(useVendedoresPlanificacion).toHaveBeenCalledWith(false);
  });
});
