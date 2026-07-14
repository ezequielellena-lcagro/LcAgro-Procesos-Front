import { describe, expect, it } from "vitest";
import { desdeConfig, haciaConfig } from "./campania-format";

describe("campania-format", () => {
  it("desdeConfig convierte 8 dígitos consecutivos", () => {
    expect(desdeConfig("20232024")).toBe("2023-2024");
    expect(desdeConfig(" 20242025 ")).toBe("2024-2025");
    expect(desdeConfig("2023-2024")).toBe("2023-2024");
  });

  it("desdeConfig rechaza lo inválido", () => {
    expect(desdeConfig(null)).toBeNull();
    expect(desdeConfig("")).toBeNull();
    expect(desdeConfig("2023")).toBeNull();
    expect(desdeConfig("20232025")).toBeNull(); // no consecutivos
    expect(desdeConfig("abcdefgh")).toBeNull();
  });

  it("haciaConfig normaliza a 8 dígitos", () => {
    expect(haciaConfig("2023-2024")).toBe("20232024");
    expect(haciaConfig("20232024")).toBe("20232024");
    expect(haciaConfig("2023-2025")).toBeNull();
    expect(haciaConfig("2023")).toBeNull();
  });
});
