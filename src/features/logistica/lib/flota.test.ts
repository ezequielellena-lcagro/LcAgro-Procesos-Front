import { describe, expect, it } from "vitest";
import {
  cuitFlota,
  fechaFlotaValida,
  fichaFlotaValida,
  importeEntradaFlota,
  importeWireFlota,
  normalizarFichaFlota,
  patenteFlotaEquivalente,
  referenciaFlota,
} from "./flota";

const ficha = (extra: object = {}) => ({
  patenteChasis: "AA 123 BB",
  patenteAcoplado: null,
  conductor: null,
  cuitConductor: null,
  transportista: null,
  cuitTransportista: null,
  importeReferencia: null,
  moneda: null,
  vigenteDesde: null,
  ...extra,
});
describe("Flota: validación y referencia exacta", () => {
  it.each(["0", "0.0000", "00001.2300", "99999999999999.9999"])("admite importe wire %s", (s) => {
    expect(importeWireFlota(s)).toBe(true);
  });
  it.each([
    "",
    " ",
    "-1",
    "+1",
    "1e3",
    "1,25",
    "1.",
    ".1",
    "1.12345",
    "100000000000000",
    "1".repeat(65),
  ])("rechaza wire %s", (s) => {
    expect(importeWireFlota(s)).toBe(false);
  });
  it("convierte entrada humana sin coma flotante ni redondeo; cero no es ausencia", () => {
    expect(importeEntradaFlota("99999999999999,9999")).toBe("99999999999999.9999");
    expect(importeEntradaFlota("00001,2300")).toBe("1.23");
    expect(importeEntradaFlota("0")).toBe("0");
    expect(importeEntradaFlota("")).toBeNull();
    expect(importeEntradaFlota("1.000,25")).toBeUndefined();
    expect(referenciaFlota("99999999999999.9999", "USD")).toBe("USD 99.999.999.999.999,9999");
    expect(referenciaFlota("0", "ARS")).toBe("ARS 0");
    expect(referenciaFlota(null, null)).toBe("Sin referencia");
  });
  it.each(["1753-01-01", "2000-02-29", "2024-02-29", "9999-12-31"])("admite fecha %s", (s) => {
    expect(fechaFlotaValida(s)).toBe(true);
  });
  it.each([
    "1752-12-31",
    "1900-02-29",
    "2025-02-29",
    "2026-04-31",
    "10000-01-01",
    "2026-1-01",
    "2026-01-01T00:00:00Z",
  ])("rechaza fecha %s", (s) => {
    expect(fechaFlotaValida(s)).toBe(false);
  });
  it("exige moneda y fecha explícitas sólo al existir importe, incluido cero", () => {
    expect(fichaFlotaValida(ficha())).toBe(true);
    expect(fichaFlotaValida(ficha({ importeReferencia: "0" }))).toBe(false);
    expect(
      fichaFlotaValida(
        ficha({ importeReferencia: "0", moneda: "ARS", vigenteDesde: "1753-01-01" }),
      ),
    ).toBe(true);
    expect(fichaFlotaValida(ficha({ moneda: "USD" }))).toBe(false);
    expect(fichaFlotaValida(ficha({ vigenteDesde: "2026-10-04" }))).toBe(false);
  });
  it("normaliza CUIT después de validar y conserva el chasis legible", () => {
    expect(cuitFlota("20-12345678-6")).toBe("20123456786");
    expect(cuitFlota("30.12345678.1")).toBe("30123456781");
    expect(
      normalizarFichaFlota(
        ficha({
          patenteChasis: " AA-123 BB ",
          cuitConductor: "20-12345678-6",
          importeReferencia: "000.0000",
          moneda: "USD",
          vigenteDesde: "2026-10-04",
        }),
      ),
    ).toMatchObject({
      patenteChasis: "AA-123 BB",
      cuitConductor: "20123456786",
      importeReferencia: "0",
    });
    expect(patenteFlotaEquivalente(" aa-123\u00a0bb ")).toBe("AA123BB");
  });
  it.each([
    "",
    " ",
    "11111111111",
    "20123456785",
    "2012345678",
    "201234567866",
    "２０１２３４５６７８６",
    "20\t123456786",
    "22123456785",
  ])("rechaza CUIT %s", (s) => {
    expect(cuitFlota(s)).toBeNull();
  });
  it("null opcional difiere de cadena vacía; límites y controles", () => {
    for (const campo of [
      "patenteAcoplado",
      "conductor",
      "transportista",
      "cuitConductor",
      "cuitTransportista",
      "importeReferencia",
    ]) {
      expect(fichaFlotaValida(ficha({ [campo]: "" }))).toBe(false);
      expect(fichaFlotaValida(ficha({ [campo]: " " }))).toBe(false);
    }
    expect(fichaFlotaValida(ficha({ patenteChasis: " " }))).toBe(false);
    expect(fichaFlotaValida(ficha({ conductor: "Ana\nPérez" }))).toBe(false);
    for (const [campo, max] of [
      ["patenteChasis", 20],
      ["patenteAcoplado", 20],
      ["conductor", 150],
      ["transportista", 200],
    ] as const) {
      expect(fichaFlotaValida(ficha({ [campo]: "a".repeat(max) }))).toBe(true);
      expect(fichaFlotaValida(ficha({ [campo]: "a".repeat(max + 1) }))).toBe(false);
    }
  });
});

describe("Flota: espacios del contrato .NET", () => {
  it("conserva FEFF como carácter, recorta espacios Unicode y rechaza todos los controles C1", () => {
    expect(fichaFlotaValida(ficha({ patenteChasis: "\uFEFF" }))).toBe(true);
    expect(
      normalizarFichaFlota(ficha({ patenteChasis: "\u00A0AA 123 BB\u2003" })).patenteChasis,
    ).toBe("AA 123 BB");
    expect(normalizarFichaFlota(ficha({ patenteChasis: "\uFEFFAA" })).patenteChasis).toBe(
      "\uFEFFAA",
    );
    for (let code = 0x7f; code <= 0x9f; code++) {
      expect(fichaFlotaValida(ficha({ conductor: "Ana" + String.fromCharCode(code) }))).toBe(false);
    }
    expect(importeEntradaFlota("\uFEFF")).toBeUndefined();
  });
});

describe("Flota: final exacto de cadenas HTTP", () => {
  it("rechaza newline final aunque el ancla regex pueda coincidir antes del salto", () => {
    expect(importeWireFlota("1\n")).toBe(false);
    expect(fechaFlotaValida("2026-10-04\n")).toBe(false);
  });
});

describe("SPEC: entrada opcional y casing invariante", () => {
  it.each([" ", "\u00A0", "\t", "\u0085", "1\u0085", "\t0"])(
    "rechaza importe no vacío con espacios o controles %j",
    (valor) => {
      expect(importeEntradaFlota(valor)).toBeUndefined();
    },
  );
  it.each([
    ["Aß-123", "Aß123"],
    ["ASS123", "ASS123"],
    ["ab-123 cd", "AB123CD"],
    ["ﬃ-123", "ﬃ123"],
    ["ı-123", "ı123"],
    ["ᾀ-123", "ᾈ123"],
  ])("normaliza %s como .NET ToUpperInvariant", (valor, esperado) => {
    expect(patenteFlotaEquivalente(valor)).toBe(esperado);
  });
});

describe("SPEC: excepciones Unicode verificadas en runtime .NET local", () => {
  it("conserva los mappings más nuevos que .NET 10.0.11 local aún no aplica", () => {
    const puntos = [0x0131, 0x019b, 0x0264, 0x1c8a, 0xa7cd, 0xa7cf, 0xa7d3, 0xa7d5, 0xa7db];
    for (let cp = 0x10d70; cp <= 0x10d85; cp++) puntos.push(cp);
    for (let cp = 0x16ebb; cp <= 0x16ed3; cp++) puntos.push(cp);
    for (const cp of puntos)
      expect(patenteFlotaEquivalente(String.fromCodePoint(cp))).toBe(String.fromCodePoint(cp));
  });
  it("usa mapping simple de prosgegrammeni incluso cuando JS full casing expande", () => {
    for (const inicio of [0x1f80, 0x1f90, 0x1fa0]) {
      for (let cp = inicio; cp <= inicio + 7; cp++)
        expect(patenteFlotaEquivalente(String.fromCodePoint(cp))).toBe(
          String.fromCodePoint(cp + 8),
        );
    }
    for (const cp of [0x1fb3, 0x1fc3, 0x1ff3])
      expect(patenteFlotaEquivalente(String.fromCodePoint(cp))).toBe(String.fromCodePoint(cp + 9));
  });
});
