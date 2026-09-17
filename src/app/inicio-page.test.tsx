import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/features/auth/auth-context";
import type { RolNombre } from "@/features/auth/types";
import { InicioPage } from "./inicio-page";

vi.mock("@/features/auth/auth-context", () => ({ useAuth: vi.fn() }));

function conRoles(roles: RolNombre[]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 1, nombre: "Usuario Demo", email: "demo@local.test", roles },
    status: "authenticated",
    hasAnyRole: (requeridos) => requeridos.some((rol) => roles.includes(rol)),
    login: async () => {},
    logout: () => {},
  });
}

function abrirInicio() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<InicioPage dashboard={<h1>Dashboard visible</h1>} />} />
        <Route path="/posicion" element={<h1>Posición visible</h1>} />
        <Route path="/planificacion-ventas" element={<h1>Planificación visible</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("inicio según permisos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mantiene Dashboard para quien tiene esa pantalla", () => {
    conRoles(["dashboard", "planificacionventas"]);
    abrirInicio();
    expect(screen.getByRole("heading", { name: "Dashboard visible" })).toBeInTheDocument();
  });

  it("redirige al primer proceso permitido sin Dashboard", () => {
    conRoles(["planificacionventas", "posicion"]);
    abrirInicio();
    expect(screen.getByRole("heading", { name: "Posición visible" })).toBeInTheDocument();
  });

  it("permite empezar directamente en Planificación de Ventas", () => {
    conRoles(["planificacionventas"]);
    abrirInicio();
    expect(screen.getByRole("heading", { name: "Planificación visible" })).toBeInTheDocument();
  });

  it("cierra el inicio cuando no tiene ninguna pantalla", () => {
    conRoles([]);
    abrirInicio();
    expect(screen.getByRole("heading", { name: "Sin permiso" })).toBeInTheDocument();
  });
});
