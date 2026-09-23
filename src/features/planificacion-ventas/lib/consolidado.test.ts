import { describe, expect, it } from "vitest";
import { armarLineasConsolidado, totalesDeFilas } from "./consolidado";
import type { ConsolidadoResponse, FilaConsolidado, TotalesConsolidado } from "../types";

const origen = { anterior: 1, campania: 2, total: 3, sorgo: 0, girasol: 0 };

function fila(
  parcial: Partial<FilaConsolidado> & { cuit: string; razonSocial: string },
): FilaConsolidado {
  return {
    vendedorId: 1,
    vendedor: "DEMARCHI GERMAN",
    sucursalId: 1,
    sucursal: "Central",
    hectareas: { soja: 10, maiz: 5, trigo: null, otro: null, total: 15 },
    mercadoUsd: 400,
    facturacionLcUsd: 100,
    facturacionLcAnteriorUsd: 50,
    variacionLc: 1,
    participacionLc: 0.25,
    originacionTn: origen,
    potencialTn: 60,
    compraInsumos: "si",
    ...parcial,
  };
}

// Subtotales del servidor a propósito distintos de la suma de las filas: si una línea los repite
// con la búsqueda activa, el test lo marca.
const SERVIDOR: TotalesConsolidado = {
  hectareas: { soja: 999, maiz: 999, trigo: 999, otro: 999, total: 999 },
  mercadoUsd: 9999,
  facturacionLcUsd: 9999,
  facturacionLcAnteriorUsd: 9999,
  variacionLc: 9,
  participacionLc: 9,
  originacionTn: { anterior: 9, campania: 9, total: 9, sorgo: 9, girasol: 9 },
  potencialTn: 999,
};

const datos: ConsolidadoResponse = {
  campania: "2026-2027",
  datosMacroGestAl: null,
  filas: [
    fila({ cuit: "20142575400", razonSocial: "ACTIS MILANESIO JORGE" }),
    fila({
      cuit: "30717983501",
      razonSocial: "AGRO ALMA S.R.L.",
      facturacionLcUsd: 300,
      mercadoUsd: 600,
    }),
    fila({
      cuit: "30716880067",
      razonSocial: "AGRO LEUTERT SRL",
      vendedorId: 2,
      vendedor: "FERREYRA MARIANO",
    }),
  ],
  subtotalesSucursales: [],
  subtotalesVendedores: [
    { id: 1, nombre: "DEMARCHI GERMAN", totales: SERVIDOR },
    { id: 2, nombre: "FERREYRA MARIANO", totales: SERVIDOR },
  ],
  total: SERVIDOR,
  totalGeneral: SERVIDOR,
  fueraDeCarteras: {
    facturacionLcUsd: 7,
    facturacionLcAnteriorUsd: 7,
    originacionTn: origen,
    cuits: 1,
    cuentasSinCuit: 1,
  },
  ajusteRedondeo: { campaniaUsd: 1, anteriorUsd: 1 },
  sinVendedor: false,
};

const armar = (texto?: string) =>
  armarLineasConsolidado(datos, "vendedor", true, { vendedorIds: [], texto });

describe("totalesDeFilas", () => {
  it("suma como el backend y deriva variación y participación", () => {
    const totales = totalesDeFilas([datos.filas[0], datos.filas[1]]);
    expect(totales.hectareas).toEqual({ soja: 20, maiz: 10, trigo: 0, otro: 0, total: 30 });
    expect(totales.facturacionLcUsd).toBe(400);
    expect(totales.facturacionLcAnteriorUsd).toBe(100);
    expect(totales.mercadoUsd).toBe(1000);
    expect(totales.variacionLc).toBe(3); // 400 / 100 - 1
    expect(totales.participacionLc).toBe(0.4); // 400 / 1000
    expect(totales.originacionTn).toEqual({
      anterior: 2,
      campania: 4,
      total: 6,
      sorgo: 0,
      girasol: 0,
    });
    expect(totales.potencialTn).toBe(120);
  });

  it("deja en null lo que no se puede derivar y excluye de participación lo que no tiene mercado", () => {
    const sinMercado = fila({
      cuit: "1",
      razonSocial: "Sin mercado",
      mercadoUsd: null,
      potencialTn: null,
    });
    const vacio = totalesDeFilas([sinMercado]);
    expect(vacio.mercadoUsd).toBeNull();
    expect(vacio.potencialTn).toBeNull();
    expect(vacio.participacionLc).toBeNull();

    // Con una fila con mercado y otra sin, la participación sale sólo de la que tiene mercado.
    const mezcla = totalesDeFilas([sinMercado, datos.filas[0]]);
    expect(mezcla.mercadoUsd).toBe(400);
    expect(mezcla.participacionLc).toBe(0.25); // 100 / 400, sin la fila sin mercado
  });

  it("sin facturación anterior no inventa variación", () => {
    expect(
      totalesDeFilas([fila({ cuit: "1", razonSocial: "X", facturacionLcAnteriorUsd: 0 })])
        .variacionLc,
    ).toBeNull();
  });
});

describe("armarLineasConsolidado con búsqueda", () => {
  it("sin texto conserva los subtotales y los pies que manda el servidor", () => {
    const lineas = armar();
    expect(lineas.filter((linea) => linea.tipo === "productor")).toHaveLength(3);
    expect(lineas.find((linea) => linea.tipo === "subtotal")?.facturacionLcUsd).toBe(9999);
    expect(lineas.map((linea) => linea.tipo)).toEqual(
      expect.arrayContaining(["carteras", "fuera", "ajuste", "total"]),
    );
  });

  it("filtra por nombre, recalcula el subtotal del grupo y cierra con un TOTAL filtrado", () => {
    const lineas = armar("agro");
    expect(
      lineas.filter((linea) => linea.tipo === "productor").map((linea) => linea.etiqueta),
    ).toEqual(["AGRO ALMA S.R.L.", "AGRO LEUTERT SRL"]);

    const subtotales = lineas.filter((linea) => linea.tipo === "subtotal");
    expect(subtotales.map((linea) => linea.etiqueta)).toEqual([
      "Subtotal DEMARCHI GERMAN",
      "Subtotal FERREYRA MARIANO",
    ]);
    expect(subtotales[0].facturacionLcUsd).toBe(300);
    expect(subtotales[0].participacionLc).toBe(0.5); // 300 / 600
    expect(subtotales[1].facturacionLcUsd).toBe(100);

    // Ni "Total carteras", ni "Fuera de carteras", ni el ajuste de redondeo: son de la cartera entera.
    expect(lineas.some((linea) => ["carteras", "fuera", "ajuste"].includes(linea.tipo))).toBe(
      false,
    );
    const total = lineas.at(-1)!;
    expect(total.tipo).toBe("total");
    expect(total.etiqueta).toBe("TOTAL FILTRADO");
    expect(total.facturacionLcUsd).toBe(400);
    expect(total.facturacionLcAnteriorUsd).toBe(100);
  });

  it("filtra por CUIT, que es como se busca por DNI", () => {
    const lineas = armar("14257540");
    expect(lineas.filter((linea) => linea.tipo === "productor").map((linea) => linea.cuit)).toEqual(
      ["20142575400"],
    );
  });

  it("sin coincidencias no deja ninguna línea", () => {
    expect(armar("no existe")).toEqual([]);
  });
});
