import { describe, expect, it } from "vitest";
import { planificacionKeys } from "./keys";
import { esMismaCampaniaTablero } from "./use-tablero-planificacion";

describe("placeholder del tablero", () => {
  it("conserva la página previa sólo dentro de la misma campaña", () => {
    const anterior = planificacionKeys.tablero({
      campania: "2025-2026",
      vendedorCodigo: 8,
      page: 2,
    });

    expect(esMismaCampaniaTablero(anterior, "2025-2026")).toBe(true);
    expect(esMismaCampaniaTablero(anterior, "2024-2025")).toBe(false);
  });

  it("no reutiliza datos cuando todavía no existe una consulta anterior", () => {
    expect(esMismaCampaniaTablero(undefined, "2025-2026")).toBe(false);
  });
});
