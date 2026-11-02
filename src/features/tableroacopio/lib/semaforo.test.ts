import { describe, expect, it } from "vitest";
import type { CampaniaTablero } from "../types";
import { estadoIndicador } from "./semaforo";

const base = {
  campania: "2025-2026",
  preCorte: false,
  enCurso: false,
  objetivos: {
    gananciaPosicionPct: 1.5,
    comisionPct: 1,
    rotacion: 1.5,
    tnPreventas: 100_000,
    tnAcopiadas: null,
    nuevosClientes: null,
  },
} as unknown as CampaniaTablero;

describe("semáforo", () => {
  it("cumple o no cumple contra el objetivo", () => {
    expect(estadoIndicador({ ...base, gananciaPosicionPct: 1.6 }, "gananciaPosicionPct")).toBe(
      "cumple",
    );
    expect(estadoIndicador({ ...base, comisionPctNeta: 0.76 }, "comisionPct")).toBe("no-cumple");
  });

  it("un indicador que acumula, en la campaña en curso, está en curso; un porcentaje no", () => {
    const enCurso = { ...base, enCurso: true, tnPreventas: 80_000, gananciaPosicionPct: 0.6 };
    expect(estadoIndicador(enCurso, "tnPreventas")).toBe("en-curso");
    expect(estadoIndicador(enCurso, "gananciaPosicionPct")).toBe("no-cumple");
  });

  it("antes del corte, o sin objetivo, no se juzga", () => {
    expect(estadoIndicador({ ...base, preCorte: true, tnPreventas: 1 }, "tnPreventas")).toBe(
      "sin-objetivo",
    );
    expect(estadoIndicador({ ...base, tnAcopiadas: 120_000 }, "tnAcopiadas")).toBe("sin-objetivo");
  });
});
