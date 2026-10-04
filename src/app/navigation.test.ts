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
    const futuros = semillero()!
      .procesos.filter((p) => p.kind === "futuro")
      .map((p) => p.label);
    expect(futuros).toEqual([
      "Trazabilidad por lote",
      "Pedidos pendientes vs. stock",
      "Traspasos a acopio",
    ]);
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

describe("menú Planificación de Ventas", () => {
  const comercial = () => NAV.find((a) => a.id === "comercial")!;

  it("navega con cualquiera de las dos pantallas y se oculta sin ellas", () => {
    const proceso = comercial().procesos.find((p) => p.label === "Planificación de Ventas");
    expect(proceso).toMatchObject({
      kind: "activo",
      to: "/planificacion-ventas",
      roles: ["planificacionventas", "planificacionventasgestion"],
    });
    expect(procesosVisibles(comercial(), ["planificacionventas"])).toContain(proceso);
    expect(procesosVisibles(comercial(), ["planificacionventasgestion"])).toContain(proceso);
    expect(procesosVisibles(comercial(), ["comisiones"])).not.toContain(proceso);
    expect(areaActivaPorPath("/planificacion-ventas")?.id).toBe("comercial");
    expect(tituloProcesoPorPath(comercial(), "/planificacion-ventas")).toBe(
      "Planificación de Ventas",
    );
  });
});

describe("grupo Logística", () => {
  const acopio = () => NAV.find((a) => a.id === "acopio")!;
  it("mantiene cuatro entradas y deriva visibilidad de hijas autorizadas", () => {
    expect(procesosVisibles(acopio(), ["dashboard"]).some((p) => p.label === "Logística")).toBe(
      false,
    );
    const lectura = procesosVisibles(acopio(), ["logistica-lectura"]).find(
      (p) => p.kind === "grupo",
    );
    expect(lectura?.kind === "grupo" && lectura.procesos.map((p) => p.label)).toEqual([
      "Pedidos",
      "Cupos",
      "Cargas a puerto",
      "Flete y camiones",
    ]);
    const pedidos = procesosVisibles(acopio(), ["logistica-pedidos"]).find(
      (p) => p.kind === "grupo",
    );
    expect(
      pedidos?.kind === "grupo" &&
        pedidos.procesos.some((p) => p.kind === "activo" && p.label === "Cupos"),
    ).toBe(false);
    expect(areaActivaPorPath("/logistica/cupos")?.id).toBe("acopio");
    expect(tituloProcesoPorPath(acopio(), "/logistica/pedidos")).toBe("Logística / Pedidos");
    expect(areaActivaPorPath("/logistica/cargas")?.id).toBe("acopio");
    expect(tituloProcesoPorPath(acopio(), "/logistica/cargas")).toBe("Logística / Cargas a puerto");
    expect(
      pedidos?.kind === "grupo" && pedidos.procesos.some((p) => p.label === "Cargas a puerto"),
    ).toBe(false);
    for (const rol of ["logistica-lectura", "logistica-cupos", "logistica-cargas"] as const) {
      const grupo = procesosVisibles(acopio(), [rol]).find((p) => p.kind === "grupo");
      expect(
        grupo?.kind === "grupo" &&
          grupo.procesos.some((p) => p.kind === "activo" && p.to === "/logistica/cargas"),
      ).toBe(true);
    }
  });
});

describe("Flete propio en navegación", () => {
  it("habilita sólo Flete para su permiso y no extiende otros gestores", () => {
    const acopio = NAV.find((a) => a.id === "acopio")!;
    const grupo = procesosVisibles(acopio, ["logistica-flete"]).find((p) => p.kind === "grupo");
    expect(grupo?.kind === "grupo" && grupo.procesos).toEqual([
      expect.objectContaining({
        kind: "activo",
        label: "Flete y camiones",
        to: "/logistica/flete",
        roles: ["logistica-lectura", "logistica-flete"],
      }),
    ]);
    expect(areaActivaPorPath("/logistica/flete")?.id).toBe("acopio");
    expect(tituloProcesoPorPath(acopio, "/logistica/flete")).toBe("Logística / Flete y camiones");
    for (const rol of ["logistica-pedidos", "logistica-cupos", "logistica-cargas"] as const) {
      const g = procesosVisibles(acopio, [rol]).find((p) => p.kind === "grupo");
      expect(g?.kind === "grupo" && g.procesos.some((p) => p.label === "Flete y camiones")).toBe(
        false,
      );
    }
  });
});
