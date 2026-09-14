import { describe, expect, it } from "vitest";
import type { EstadoCopiaClientesDto } from "../types";
import { avisoCopiaClientes } from "./copia-clientes";

function estado(over: Partial<EstadoCopiaClientesDto> = {}): EstadoCopiaClientesDto {
  return {
    ultimaSincronizacion: "2026-09-12T10:00:00Z",
    ultimoIntentoFallido: null,
    ultimoError: null,
    desactualizada: false,
    sinCopia: false,
    cantidad: 5794,
    ...over,
  };
}

describe("avisoCopiaClientes", () => {
  it("ok: copia fresca, con la fecha absoluta de la última sincronización", () => {
    const aviso = avisoCopiaClientes(estado());
    expect(aviso.nivel).toBe("ok");
    expect(aviso.mensaje).toContain("actualizados");
    expect(aviso.mensaje).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("desactualizada: avisa con la fecha absoluta de la última sincronización exitosa", () => {
    const aviso = avisoCopiaClientes(estado({ desactualizada: true }));
    expect(aviso.nivel).toBe("desactualizada");
    expect(aviso.mensaje).toContain("desactualizados");
    expect(aviso.mensaje).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("sinCopia: explica que nunca hubo sincronización, sin fecha absoluta que mostrar", () => {
    const aviso = avisoCopiaClientes(
      estado({ sinCopia: true, desactualizada: true, ultimaSincronizacion: null, cantidad: 0 }),
    );
    expect(aviso.nivel).toBe("sinCopia");
    expect(aviso.mensaje).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("sinCopia con MacroGest caído incluye el motivo del último intento fallido", () => {
    const aviso = avisoCopiaClientes(
      estado({ sinCopia: true, ultimaSincronizacion: null, ultimoError: "MacroGest no respondió." }),
    );
    expect(aviso.mensaje).toContain("MacroGest no respondió.");
  });
});
