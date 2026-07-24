import { describe, expect, it } from "vitest";
import { estadoFijoDeTab, presetDeTab, TABS_STOCK } from "./tabs";

describe("presetDeTab", () => {
  it("Stock: sin drill-down, ordenado por depósito", () => {
    expect(presetDeTab("stock")).toEqual({ orden: "Deposito" });
  });

  it("Stock global: consolida por artículo y muestra primero la plata más grande", () => {
    expect(presetDeTab("global")).toEqual({ consolidado: true, orden: "Valor" });
  });

  it("solo la solapa global consolida (las demás muestran artículo × depósito)", () => {
    for (const { value } of TABS_STOCK.filter((t) => t.value !== "global")) {
      expect(presetDeTab(value).consolidado).toBeUndefined();
    }
  });

  it("Vencimientos: vencido + crítico + alerta, ordenado por urgencia", () => {
    expect(presetDeTab("vencimientos")).toEqual({
      estadosVenc: ["Vencido", "Critico", "Alerta"],
      orden: "Vencimiento",
    });
  });

  it("Inmovilizado: filtra por estado y ordena por valor", () => {
    expect(presetDeTab("inmovilizado")).toEqual({ estado: "Inmovilizado", orden: "Valor" });
  });

  it("Por rubro: sin preset (se dibuja con porRubro)", () => {
    expect(presetDeTab("rubro")).toEqual({});
  });

  it("ninguna solapa toca los filtros compartidos", () => {
    for (const { value } of TABS_STOCK) {
      const preset = presetDeTab(value);
      expect(preset).not.toHaveProperty("q");
      expect(preset).not.toHaveProperty("deposito");
      expect(preset).not.toHaveProperty("soloBajoMinimo");
    }
  });

  it("devuelve un objeto nuevo por llamada (no comparte estado mutable)", () => {
    const a = presetDeTab("vencimientos");
    a.estadosVenc?.push("Normal");
    expect(presetDeTab("vencimientos").estadosVenc).toEqual(["Vencido", "Critico", "Alerta"]);
  });
});

describe("estadoFijoDeTab", () => {
  it("Inmovilizado impone su estado: el filtro de arriba tiene que mostrarse fijo", () => {
    expect(estadoFijoDeTab("inmovilizado")).toBe("Inmovilizado");
  });

  it("las demás solapas respetan lo que elija el usuario", () => {
    for (const { value } of TABS_STOCK.filter((t) => t.value !== "inmovilizado")) {
      expect(estadoFijoDeTab(value)).toBeUndefined();
    }
  });

  it("sale del propio preset: lo que se muestra fijo es exactamente lo que se va a mandar", () => {
    for (const { value } of TABS_STOCK) {
      expect(estadoFijoDeTab(value)).toBe(presetDeTab(value).estado);
    }
  });
});
