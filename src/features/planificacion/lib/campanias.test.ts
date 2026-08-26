import { describe, expect, it } from "vitest";
import { claveCampania, ultimasCampanias } from "./campanias";

describe("campañas de planificación", () => {
  it("usa el formato canónico de la API y cambia el primero de abril", () => {
    expect(claveCampania(new Date(2026, 2, 31, 12))).toBe("2025-2026");
    expect(claveCampania(new Date(2026, 3, 1, 12))).toBe("2026-2027");
  });

  it("expone tres campañas consecutivas desde la vigente", () => {
    expect(ultimasCampanias(new Date(2026, 7, 26, 12))).toEqual([
      "2026-2027",
      "2025-2026",
      "2024-2025",
    ]);
  });
});
