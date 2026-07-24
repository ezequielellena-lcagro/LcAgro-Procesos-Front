import { describe, expect, it } from "vitest";
import { FILTROS_INICIALES, filtrosAQuery } from "./filtros";

describe("filtrosAQuery", () => {
  it("omite los filtros de texto vacíos", () => {
    const q = filtrosAQuery(FILTROS_INICIALES);
    expect(q.q).toBeUndefined();
    expect(q.tipo).toBeUndefined();
  });

  it("convierte la ventana a número y la omite si está vacía", () => {
    expect(filtrosAQuery({ ...FILTROS_INICIALES, ventanaDias: "30" }).ventanaDias).toBe(30);
    expect(filtrosAQuery({ ...FILTROS_INICIALES, ventanaDias: "" }).ventanaDias).toBeUndefined();
  });

  it("pasa los multi-select y el checkbox tal cual", () => {
    const q = filtrosAQuery({
      ...FILTROS_INICIALES,
      q: "glifo",
      deposito: [0, 5],
      rubro: [200],
      tipo: "Propio",
      soloBajoMinimo: true,
    });
    expect(q).toMatchObject({
      q: "glifo",
      deposito: [0, 5],
      rubro: [200],
      tipo: "Propio",
      soloBajoMinimo: true,
    });
  });

  it("manda el estado elegido y lo omite cuando es 'Todos'", () => {
    expect(filtrosAQuery({ ...FILTROS_INICIALES, estado: "RiesgoQuiebre" }).estado).toBe("RiesgoQuiebre");
    expect(filtrosAQuery(FILTROS_INICIALES).estado).toBeUndefined();
  });

  it("no arrastra el drill-down que pone la solapa (eso lo agrega presetDeTab)", () => {
    const q = filtrosAQuery(FILTROS_INICIALES);
    expect(q).not.toHaveProperty("estadosVenc");
    expect(q).not.toHaveProperty("orden");
    expect(q).not.toHaveProperty("consolidado");
  });
});
