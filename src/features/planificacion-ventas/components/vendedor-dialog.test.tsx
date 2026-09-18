import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VendedorDialog } from "./vendedor-dialog";
import type { SucursalComercial, ViajanteAsignable, UsuarioAsignable, VendedorComercial } from "../types";

const sucursales: SucursalComercial[] = [
  { id: 1, nombre: "Sucursal de prueba", activa: true },
];
const viajantes: ViajanteAsignable[] = [
  { codigo: 10, nombre: "Viajante propio", vendedorId: 3, vendedorNombre: "Vendedor A" },
  { codigo: 20, nombre: "Viajante ajeno", vendedorId: 4, vendedorNombre: "Vendedor B" },
  { codigo: 30, nombre: "Viajante libre", vendedorId: null, vendedorNombre: null },
];
const usuarios: UsuarioAsignable[] = [{ id: 7, nombre: "Usuario Prueba", email: "usuario@example.test" }];

describe("diálogo de vendedor", () => {
  it("busca por nombre o código y no permite elegir viajantes de otro vendedor", () => {
    render(
      <VendedorDialog vendedor={null} viajanteInicial={viajantes[2]} sucursales={sucursales} viajantes={viajantes}
        usuarios={usuarios} vendedores={[]} guardando={false}
        onClose={vi.fn()} onGuardar={vi.fn()} onDirtyChange={vi.fn()} />,
    );
    const ajeno = screen.getByRole("checkbox", { name: /20 Viajante ajeno/ });
    expect(ajeno).toBeDisabled();
    expect(screen.getByText(/Asignado a Vendedor B/)).toBeInTheDocument();
    fireEvent.click(ajeno);
    expect(ajeno).not.toBeChecked();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar viajante" }), {
      target: { value: "30" },
    });
    const lista = screen.getByRole("group", { name: "Códigos de viajante" });
    expect(within(lista).getByRole("checkbox", { name: /30 Viajante libre/ })).toBeInTheDocument();
    expect(within(lista).queryByRole("checkbox", { name: /20 Viajante ajeno/ })).not.toBeInTheDocument();
  });

  it("identifica usuarios ocupados y permite desvincular uno que perdió el permiso", () => {
    const propio: VendedorComercial = {
      id: 3, nombre: "Vendedor A", sucursalId: 1, sucursal: "Sucursal de prueba",
      viajantes: [10], usuarioId: 8, usuarioNombre: "Usuario anterior", activo: true,
    };
    const otro: VendedorComercial = {
      ...propio, id: 4, nombre: "Vendedor B", viajantes: [20],
      usuarioId: 7, usuarioNombre: "Usuario Prueba",
    };
    render(
      <VendedorDialog vendedor={propio} viajanteInicial={null} sucursales={sucursales} viajantes={viajantes}
        usuarios={usuarios} vendedores={[propio, otro]} guardando={false}
        onClose={vi.fn()} onGuardar={vi.fn()} onDirtyChange={vi.fn()} />,
    );
    expect(screen.getByRole("option", { name: /Usuario anterior.*ya no asignable/ }))
      .toBeDisabled();
    expect(screen.getByRole("option", { name: /Usuario Prueba.*asignado a Vendedor B/ }))
      .toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Usuario de la app" }), {
      target: { value: "" },
    });
    expect(screen.getByRole("combobox", { name: "Usuario de la app" })).toHaveValue("");
  });

  it("permite quitar un código asignado que ya no existe y no lo reenvía", () => {
    const guardar = vi.fn().mockResolvedValue(undefined);
    const propio: VendedorComercial = {
      id: 3, nombre: "Vendedor A", sucursalId: 1, sucursal: "Sucursal de prueba",
      viajantes: [10, 40], usuarioId: null, usuarioNombre: null, activo: true,
    };
    render(
      <VendedorDialog vendedor={propio} viajanteInicial={null} sucursales={sucursales} viajantes={viajantes}
        usuarios={usuarios} vendedores={[propio]} guardando={false}
        onClose={vi.fn()} onGuardar={guardar} onDirtyChange={vi.fn()} />,
    );
    const faltante = screen.getByRole("checkbox", {
      name: "Código 40 (ya no existe en MacroGest)",
    });
    expect(faltante).toBeChecked();
    fireEvent.click(faltante);
    expect(screen.queryByRole("checkbox", {
      name: "Código 40 (ya no existe en MacroGest)",
    })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar viajante" }), {
      target: { value: "40" },
    });
    expect(screen.queryByRole("checkbox", { name: /Código 40/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar vendedor" }));
    expect(guardar).toHaveBeenCalledWith({
      nombre: "Vendedor A", sucursalId: 1, viajantes: [10], usuarioId: null, activo: true,
    });
  });

  it("permite quitar un código que ahora pertenece a otro vendedor sin volver a elegirlo", () => {
    const guardar = vi.fn().mockResolvedValue(undefined);
    const propio: VendedorComercial = {
      id: 3, nombre: "Vendedor A", sucursalId: 1, sucursal: "Sucursal de prueba",
      viajantes: [10, 20], usuarioId: null, usuarioNombre: null, activo: true,
    };
    render(
      <VendedorDialog vendedor={propio} viajanteInicial={null} sucursales={sucursales} viajantes={viajantes}
        usuarios={usuarios} vendedores={[propio]} guardando={false}
        onClose={vi.fn()} onGuardar={guardar} onDirtyChange={vi.fn()} />,
    );
    const ajeno = screen.getByRole("checkbox", { name: /20 Viajante ajeno/ });
    expect(ajeno).toBeChecked();
    expect(ajeno).toBeEnabled();
    fireEvent.click(ajeno);
    expect(ajeno).not.toBeChecked();
    expect(ajeno).toBeDisabled();
    fireEvent.click(ajeno);
    expect(ajeno).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Guardar vendedor" }));
    expect(guardar).toHaveBeenCalledWith({
      nombre: "Vendedor A", sucursalId: 1, viajantes: [10], usuarioId: null, activo: true,
    });
  });

  it("toma nombre y código de MacroGest y sólo exige la sucursal", async () => {
    const guardar = vi.fn().mockResolvedValue(undefined);
    render(
      <VendedorDialog vendedor={null} viajanteInicial={viajantes[2]} sucursales={sucursales} viajantes={viajantes}
        usuarios={usuarios} vendedores={[]} guardando={false}
        onClose={vi.fn()} onGuardar={guardar} onDirtyChange={vi.fn()} />,
    );
    expect(screen.getByRole("textbox", { name: "Nombre del vendedor" })).toHaveValue("Viajante libre");
    expect(screen.getByRole("textbox", { name: "Nombre del vendedor" })).toHaveAttribute("readonly");
    expect(screen.getByRole("checkbox", { name: /30 Viajante libre/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /30 Viajante libre/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    expect(screen.getByText("Elegí una sucursal.")).toBeInTheDocument();
    expect(guardar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "Sucursal" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    expect(guardar).toHaveBeenCalledWith({
      nombre: "Viajante libre", sucursalId: 1, viajantes: [30], usuarioId: null, activo: true,
    });
  });
});
