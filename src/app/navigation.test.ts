import { describe, expect, it } from "vitest";
import { ETIQUETA_PANTALLA } from "@/features/auth/types";
import { NAV, procesosVisibles } from "./navigation";

const areaComercial = NAV.find((area) => area.id === "comercial");

if (!areaComercial) {
  throw new Error("No se encontró el área Comercial · Insumos en la navegación.");
}

describe("navegación de Planificación de Ventas", () => {
  it("usa el permiso propio y la etiqueta productiva exacta", () => {
    const proceso = areaComercial.procesos.find(
      (item) => item.kind === "activo" && item.to === "/planificacion-vendedores",
    );

    expect(proceso).toMatchObject({
      kind: "activo",
      label: "Planificación de Ventas",
      title: "Planificación de Ventas",
      roles: ["planificacion-vendedores"],
    });
    expect(ETIQUETA_PANTALLA["planificacion-vendedores"]).toBe("Planificación de Ventas");
  });

  it("se muestra sólo a quienes tienen el permiso de planificación", () => {
    const rutasConPermiso = procesosVisibles(areaComercial, ["planificacion-vendedores"])
      .filter((item) => item.kind === "activo")
      .map((item) => item.to);
    const rutasSoloDashboard = procesosVisibles(areaComercial, ["dashboard"])
      .filter((item) => item.kind === "activo")
      .map((item) => item.to);

    expect(rutasConPermiso).toContain("/planificacion-vendedores");
    expect(rutasSoloDashboard).not.toContain("/planificacion-vendedores");
  });
});
