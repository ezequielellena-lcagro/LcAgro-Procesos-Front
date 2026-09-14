import { describe, expect, it } from "vitest";
import { envaseCantidad, fechaHora, kg, toneladas, unidades } from "./format";

describe("format del semillero", () => {
  it("las unidades admiten decimales porque un bigbag puede quedar a medias", () => {
    expect(unidades(11.1)).toBe("11,1");
    expect(unidades(1500)).toBe("1.500");
  });

  it("kilos sin decimales y toneladas con uno", () => {
    expect(kg(8880)).toBe("8.880 kg");
    expect(toneladas(185400)).toBe("185,4 t");
  });

  it("la fecha-hora se muestra en hora argentina aunque venga en UTC", () => {
    const texto = fechaHora("2026-10-06T01:00:00Z");
    expect(texto).toContain("05/10/2026");
    expect(texto).toContain("22:00");
  });

  it("nombra el envase según la cantidad", () => {
    expect(envaseCantidad("BigBag", 3)).toBe("3 BB");
    expect(envaseCantidad("Bolsa", 1)).toBe("1 bolsa");
    expect(envaseCantidad("Bolsa", 20)).toBe("20 bolsas");
  });
});
