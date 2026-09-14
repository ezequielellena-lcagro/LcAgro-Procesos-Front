import { describe, expect, it } from "vitest";
import { NAV, areaActivaPorPath, procesosVisibles, tituloProcesoPorPath } from "./navigation";

const semillero = () => NAV.find((a) => a.id === "semillero");

describe("menú Semillero", () => {
  it("existe como área propia con Stock y Órdenes de Carga", () => {
    const area = semillero();
    expect(area?.label).toBe("Semillero");
    expect(area?.procesos[0]).toMatchObject({
      kind: "activo",
      label: "Stock y Órdenes de Carga",
      to: "/semillero",
      roles: ["semillero"],
    });
  });

  it("muestra lo que viene como próximo", () => {
    const futuros = semillero()!.procesos.filter((p) => p.kind === "futuro").map((p) => p.label);
    expect(futuros).toEqual(["Trazabilidad por lote", "Pedidos pendientes vs. stock", "Traspasos a acopio"]);
  });

  it("sin el permiso sólo se ven los próximos", () => {
    const visibles = procesosVisibles(semillero()!, ["dashboard", "semilla"]);
    expect(visibles.every((p) => p.kind === "futuro")).toBe(true);
  });

  it("la ruta activa el área y el título del topbar", () => {
    expect(areaActivaPorPath("/semillero")?.id).toBe("semillero");
    expect(tituloProcesoPorPath(semillero()!, "/semillero")).toBe("Stock y Órdenes de Carga");
  });
});
