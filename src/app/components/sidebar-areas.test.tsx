import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { NAV } from "../navigation";
import { SidebarAreas } from "./sidebar-areas";

function Ubicacion() {
  const { pathname } = useLocation();
  return <output data-testid="ruta">{pathname}</output>;
}

function mostrarAreas(roles: RolNombre[]) {
  render(
    <MemoryRouter initialEntries={["/planificacion-ventas"]}>
      <SidebarAreas
        areas={NAV}
        areaActivaId="comercial"
        collapsed={false}
        onToggle={vi.fn()}
        roles={roles}
        mobileOpen={false}
        onNavigate={vi.fn()}
      />
      <Ubicacion />
    </MemoryRouter>,
  );
}

describe("áreas del sidebar", () => {
  it("muestra sin enlace las áreas que no tienen procesos autorizados", () => {
    mostrarAreas(["planificacionventas"]);

    const acopio = screen.getByTitle("Acopio");
    expect(acopio).toHaveAttribute("aria-disabled", "true");
    expect(acopio).toHaveClass("text-white/35");
    expect(screen.queryByRole("link", { name: "Acopio" })).not.toBeInTheDocument();
    expect(acopio).not.toHaveAttribute("href");
    fireEvent.click(acopio);
    expect(screen.getByTestId("ruta")).toHaveTextContent("/planificacion-ventas");
  });

  it("conserva el enlace al primer proceso autorizado", () => {
    mostrarAreas(["posicion"]);

    const acopio = screen.getByRole("link", { name: "Acopio" });
    expect(acopio).toHaveAttribute("href", "/posicion");
    fireEvent.click(acopio);
    expect(screen.getByTestId("ruta")).toHaveTextContent("/posicion");
  });
});
