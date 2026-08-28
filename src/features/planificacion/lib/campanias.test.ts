import { describe, expect, it } from "vitest";
import { claveCampania, fechaHoraPlanificacion, ultimasCampanias } from "./campanias";

describe("campañas de planificación", () => {
  it("usa el formato canónico de la API y cambia el primero de abril", () => {
    expect(claveCampania(new Date("2026-04-01T02:59:59Z"))).toBe("2025-2026");
    expect(claveCampania(new Date("2026-04-01T03:00:00Z"))).toBe("2026-2027");
  });

  it("expone tres campañas consecutivas desde la vigente", () => {
    expect(ultimasCampanias(new Date(2026, 7, 26, 12))).toEqual([
      "2026-2027",
      "2025-2026",
      "2024-2025",
    ]);
  });

  it("formatea el selector y el banner en Buenos Aires alrededor del cambio de campaña", () => {
    expect(fechaHoraPlanificacion("2026-04-01T02:30:00Z")).toContain("31/3/26");
    expect(fechaHoraPlanificacion("2026-04-01T02:30:00Z")).toContain("23:30");
    expect(fechaHoraPlanificacion("2026-04-01T03:30:00Z")).toContain("1/4/26");
    expect(fechaHoraPlanificacion("2026-04-01T03:30:00Z")).toContain("00:30");
  });
});
