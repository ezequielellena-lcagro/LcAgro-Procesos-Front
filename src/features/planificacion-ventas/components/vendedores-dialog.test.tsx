import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VendedoresDialog } from "./vendedores-dialog";
import { useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useCambiarActivoVendedor } from "../queries/use-vendedores";
import type { VendedorComercial } from "../types";

vi.mock("../queries/use-plan-siembra", () => ({ useVendedoresPlanificacion: vi.fn() }));
vi.mock("../queries/use-vendedores", () => ({ useCambiarActivoVendedor: vi.fn() }));

const cambiar = vi.fn().mockResolvedValue(undefined);

function vendedor(id: number, nombre: string, activo: boolean): VendedorComercial {
  return {
    id,
    nombre,
    sucursalId: null,
    sucursal: "",
    viajantes: [id],
    usuarioId: null,
    usuarioNombre: null,
    activo,
  };
}

/** 12 nombres: con 10 por página hacen falta dos para ver el paginado. */
const catalogo = [
  vendedor(1, "TRUCCO JUAN JOSE", true),
  vendedor(2, "ASL", false),
  ...Array.from({ length: 10 }, (_, i) =>
    vendedor(i + 3, "VENDEDOR " + String(i + 1).padStart(2, "0"), i % 2 === 0),
  ),
];

function preparar(data: VendedorComercial[] | undefined = catalogo) {
  vi.mocked(useVendedoresPlanificacion).mockReturnValue({
    data,
    isError: false,
  } as ReturnType<typeof useVendedoresPlanificacion>);
}

beforeEach(() => {
  vi.clearAllMocks();
  cambiar.mockResolvedValue(undefined);
  preparar();
  vi.mocked(useCambiarActivoVendedor).mockReturnValue({
    mutateAsync: cambiar,
    isPending: false,
  } as unknown as ReturnType<typeof useCambiarActivoVendedor>);
});

describe("diálogo de vendedores", () => {
  it("lista el catálogo alfabético y sin pedir nombre ni sucursal", () => {
    render(<VendedoresDialog open onClose={vi.fn()} />);
    expect(screen.queryByText("Sucursales comerciales")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurar" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /ASL/ })).getByRole("checkbox", {
        name: "Mostrar ASL",
      }),
    ).not.toBeChecked();
    const nombres = screen
      .getAllByRole("row")
      .slice(1)
      .map((fila) => fila.textContent ?? "");
    expect(nombres[0]).toMatch(/^ASL/);
  });

  it("habilita un viajante para que aparezca en el plan", async () => {
    render(<VendedoresDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar ASL" }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith({ id: 2, activo: true }));
  });

  it("sólo consulta el catálogo mientras está abierto", () => {
    render(<VendedoresDialog open={false} onClose={vi.fn()} />);
    expect(useVendedoresPlanificacion).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("el filtro deja sólo los seleccionados y vuelve a la primera página", () => {
    render(<VendedoresDialog open onClose={vi.fn()} />);
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "activos" } });
    // 6 activos entran en una sola página: el paginado se esconde y no queda página huérfana.
    expect(screen.queryByText(/Página 2/)).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mostrar TRUCCO JUAN JOSE" })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Mostrar ASL" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "inactivos" } });
    expect(screen.getByRole("checkbox", { name: "Mostrar ASL" })).not.toBeChecked();
    expect(
      screen.queryByRole("checkbox", { name: "Mostrar TRUCCO JUAN JOSE" }),
    ).not.toBeInTheDocument();
  });

  it("el filtro cuenta cuántos hay de cada lado", () => {
    render(<VendedoresDialog open onClose={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Todos (12)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Activos (6)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Inactivos (6)" })).toBeInTheDocument();
  });
});
