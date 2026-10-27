import { describe, expect, it } from "vitest";
import type { PlanCarga } from "../types";
import { cuit, generarPlanCargaPdf, nombreArchivoPlanCarga } from "./plan-carga-pdf";

const plan: PlanCarga = {
  contrato: "V-DEMO/1",
  plan: 2,
  viajes: 4,
  toneladas: 120,
  fecha: "2026-10-23",
  cereal: { codigo: 2, nombre: "Cereal ficticio" },
  campania: 20262027,
  titular: { codigo: 1, nombre: "Titular ficticio" },
  numeroEstablecimiento: 12345,
  destino: { codigo: 101, nombre: "Terminal ficticia", cuit: "30000000001" },
  destinoDomicilio: "Calle 1 - (2000) - Localidad - Provincia",
  planta: { codigo: 10, nombre: "DIRECTA" },
  destinatario: { codigo: 7, nombre: "Comprador ficticio", cuit: "30000000002" },
  corredorVentaSecundaria: { codigo: 8, nombre: "Corredor ficticio", cuit: null },
  mercadoTermino: null,
  corredorVentaPrimaria: { codigo: 8, nombre: "Corredor ficticio", cuit: null },
  entregador: { codigo: 45, nombre: "Entregador ficticio", cuit: "30000000003" },
  observaciones: null,
  cupos: [
    { cupo: 1, fechaCarga: "2026-10-23", codigoOtorgado: "COD-DEMO-1", cartaPorte: null },
    {
      cupo: 2,
      fechaCarga: "2026-10-23",
      codigoOtorgado: "COD-DEMO-2",
      cartaPorte: "0101-35740000",
    },
  ],
  destinatarioApp: "Cliente ficticio",
  datosAl: "2026-10-27T12:00:00Z",
};

describe("Plan de Carga en PDF", () => {
  it("formatea el CUIT como MacroGest y deja el vacío con guiones", () => {
    expect(cuit("30000000001")).toBe("30-00000000-1");
    expect(cuit(null)).toBe("-   -");
  });

  it("arma el documento con los rótulos, datos y cupos del impreso de MacroGest", async () => {
    const texto = (await generarPlanCargaPdf(plan)).output();
    for (const esperado of [
      "Plan de Carga",
      "LA CLEMENTINA S.A.",
      "Titular Carta Porte:",
      "Establecimiento:",
      "12345",
      "Corredor Venta Secundaria:",
      "Representante/Entregador:",
      "30-00000000-1",
      "COD-DEMO-2",
      "0101-35740000",
      "20262027",
    ])
      expect(texto).toContain(esperado);
    expect(nombreArchivoPlanCarga(plan)).toBe("plan-de-carga-V-DEMO-1-plan-2.pdf");
  });
});
