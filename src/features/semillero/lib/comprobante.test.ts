import { describe, expect, it } from "vitest";
import { normalizarComprobante } from "./comprobante";

describe("normalizarComprobante", () => {
  it("completa con ceros a la izquierda", () => {
    expect(normalizarComprobante("6-123")).toBe("06-00123");
    expect(normalizarComprobante("06-00123")).toBe("06-00123");
    expect(normalizarComprobante(" 6-123 ")).toBe("06-00123");
  });

  it("vacío o sin valor es válido como opcional: no hay comprobante", () => {
    expect(normalizarComprobante(null)).toBeNull();
    expect(normalizarComprobante(undefined)).toBeNull();
    expect(normalizarComprobante("")).toBeNull();
    expect(normalizarComprobante("   ")).toBeNull();
  });

  it("rechaza lo que no respeta NN-NNNNN", () => {
    expect(normalizarComprobante("06-PRUEBA")).toBeNull();
    expect(normalizarComprobante("123-1")).toBeNull();
    expect(normalizarComprobante("06-123456")).toBeNull();
    expect(normalizarComprobante("06123")).toBeNull();
  });
});
