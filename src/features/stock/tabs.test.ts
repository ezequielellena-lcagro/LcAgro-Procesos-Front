import { describe, expect, it } from "vitest";
import { presetDeTab, TABS_STOCK } from "./tabs";

describe("presetDeTab", () => {
  it("Stock: sin drill-down, ordenado por depósito", () => {
    expect(presetDeTab("stock")).toEqual({ orden: "Deposito" });
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
