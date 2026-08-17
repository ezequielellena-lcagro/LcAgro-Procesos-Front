import { describe, expect, it } from "vitest";
import type { AFijarDetalleDto } from "../types";
import { porCanal, porComprador, porRiesgo } from "./a-fijar";

function fila(p: Partial<AFijarDetalleDto> & Pick<AFijarDetalleDto, "comprador" | "aFijarTn">): AFijarDetalleDto {
  return {
    cereal: "Soja",
    contrato: "C-1",
    campania: "20252026",
    vtoFijacion: null,
    diasParaVto: null,
    estado: "Verde",
    directo: true,
    ...p,
  };
}

describe("porComprador", () => {
  it("agrupa por comprador, suma toneladas y marca lo vencido, de mayor a menor", () => {
    const r = porComprador([
      fila({ comprador: "TRADER", aFijarTn: 4281, estado: "Vencido", contrato: "A" }),
      fila({ comprador: "TRADER", aFijarTn: 1500, estado: "Vencido", contrato: "B" }),
      fila({ comprador: "EXPORTADORA", aFijarTn: 10000, estado: "Verde", contrato: "C" }),
    ]);

    expect(r[0]).toMatchObject({ comprador: "EXPORTADORA", tn: 10000, contratos: 1, vencidoTn: 0 });
    expect(r[1]).toMatchObject({ comprador: "TRADER", tn: 5781, contratos: 2, vencidoTn: 5781 });
  });
});

describe("porCanal", () => {
  it("reparte las toneladas entre venta directa y por corredor", () => {
    const r = porCanal([
      fila({ comprador: "A", aFijarTn: 10000, directo: true }),
      fila({ comprador: "B", aFijarTn: 6100, directo: true }),
      fila({ comprador: "C", aFijarTn: 5552, directo: false }),
    ]);
    expect(r).toEqual({ directoTn: 16100, corredorTn: 5552 });
  });
});

describe("porRiesgo", () => {
  it("ordena primero lo vencido, después por semáforo, y a igualdad más tn primero", () => {
    const orden = porRiesgo([
      fila({ comprador: "verde", aFijarTn: 8000, estado: "Verde" }),
      fila({ comprador: "vencido-chico", aFijarTn: 100, estado: "Vencido" }),
      fila({ comprador: "naranja", aFijarTn: 6000, estado: "Naranja" }),
      fila({ comprador: "vencido-grande", aFijarTn: 4000, estado: "Vencido" }),
    ]).map((f) => f.comprador);

    expect(orden).toEqual(["vencido-grande", "vencido-chico", "naranja", "verde"]);
  });
});
