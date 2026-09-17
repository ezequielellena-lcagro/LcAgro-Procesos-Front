import { describe, expect, it } from "vitest";
import {
  cambiosDelPlan,
  cancelarCelda,
  finalizarEdicion,
  completarVaciosConAnterior,
  editarCelda,
  erroresPorCuit,
  usarAnteriorEnFila,
  validarHectareas,
  valorHectareas,
} from "./borrador-plan";
import type { PlanSiembraFila } from "../types";

const fila: PlanSiembraFila = {
  cuit: "20111111112",
  razonSocial: "Productor Ficticio",
  cuentas: [12],
  vendedor: { id: 1, nombre: "Vendedor Ficticio" },
  sucursal: "Sucursal Ficticia",
  conMovimiento: true,
  plan: { soja: 10, maiz: null, trigo: 0, otro: null },
  revision: 3,
  anterior: { soja: 8, maiz: 5, trigo: 4, otro: null },
  modificadoPor: null,
  modificadoEl: null,
};

describe("borrador del plan", () => {
  it("conserva cero distinto de vacío y manda sólo productores modificados con revisión", () => {
    expect(valorHectareas(fila, {}).trigo).toBe(0);
    expect(cambiosDelPlan([fila], {})).toEqual([]);
    const borrador = editarCelda({}, fila, "maiz", "1.200,5");
    expect(cambiosDelPlan([fila], borrador)).toEqual([
      {
        cuit: fila.cuit,
        soja: 10,
        maiz: 1200.5,
        trigo: 0,
        otro: null,
        revisionEsperada: 3,
      },
    ]);
  });

  it("valida el texto sin convertirlo silenciosamente en cero", () => {
    expect(validarHectareas("")).toBeNull();
    expect(validarHectareas("0")).toBeNull();
    expect(validarHectareas("1,13")).toBeNull();
    expect(validarHectareas("abc")).toMatch(/número/i);
    expect(validarHectareas("-1")).toMatch(/0/);
    expect(validarHectareas("100000,01")).toMatch(/100.000/);
    expect(validarHectareas("1,234")).toMatch(/decimales/i);
    expect(validarHectareas("1,001")).toMatch(/decimales/i);
  });

  it("completa sólo las celdas vacías y no pisa un valor tipeado ni el cero", () => {
    const tipeado = editarCelda({}, fila, "maiz", "7");
    const borrador = completarVaciosConAnterior([fila], tipeado);
    expect(valorHectareas(fila, borrador)).toEqual({ soja: 10, maiz: 7, trigo: 0, otro: null });
    expect(valorHectareas(fila, completarVaciosConAnterior([fila], {})).maiz).toBe(5);
  });

  it("mapea Items[n] de validación al CUIT del lote y a su cultivo", () => {
    const segunda = { ...fila, cuit: "20999999991", plan: null, revision: 0 };
    const items = cambiosDelPlan(
      [fila, segunda],
      editarCelda(editarCelda({}, fila, "soja", "11"), segunda, "trigo", "2"),
    );
    expect(erroresPorCuit(items, { "Items[1].Trigo": ["Valor rechazado."] })).toEqual({
      [segunda.cuit]: { trigo: "Valor rechazado." },
    });
  });

  it("congela base y revisión ante refetch ajeno para no mezclar campos de B", () => {
    const alEditar = { ...fila, plan: { soja: 10, maiz: 5, trigo: null, otro: null }, revision: 1 };
    const borrador = editarCelda({}, alEditar, "soja", "20");
    const trasGuardarB = {
      ...alEditar,
      plan: { soja: 30, maiz: 9, trigo: null, otro: null },
      revision: 2,
    };
    expect(valorHectareas(trasGuardarB, borrador)).toEqual({
      soja: 20,
      maiz: 5,
      trigo: null,
      otro: null,
    });
    expect(cambiosDelPlan([trasGuardarB], borrador)).toEqual([
      {
        cuit: fila.cuit,
        soja: 20,
        maiz: 5,
        trigo: null,
        otro: null,
        revisionEsperada: 1,
      },
    ]);
  });

  it("libera snapshot sin cambios al salir o cancelar, y conserva escritura intermedia", () => {
    const mismoValor = editarCelda({}, fila, "soja", "10");
    expect(mismoValor[fila.cuit]).toBeDefined();
    expect(finalizarEdicion(mismoValor, fila)).toEqual({});

    const intermedio = editarCelda({}, fila, "soja", "10,");
    expect(intermedio[fila.cuit]).toBeDefined();
    const decimal = editarCelda(intermedio, fila, "soja", "10,5");
    expect(finalizarEdicion(decimal, fila)[fila.cuit]).toBeDefined();
    expect(valorHectareas(fila, decimal).soja).toBe(10.5);

    const cambiado = editarCelda({}, fila, "soja", "20");
    expect(cancelarCelda(cambiado, fila, "soja")).toEqual({});
  });

  it("copiar anterior igual al plan no retiene snapshot y puede revertir un borrador", () => {
    const anteriorIgual: PlanSiembraFila = { ...fila, anterior: { ...fila.plan! } };
    expect(usarAnteriorEnFila(anteriorIgual, {})).toEqual({});

    const editado = editarCelda({}, anteriorIgual, "soja", "11");
    expect(cambiosDelPlan([anteriorIgual], editado)).toHaveLength(1);
    expect(usarAnteriorEnFila(anteriorIgual, editado)).toEqual({});
  });

  it("por fila copia la campaña anterior al borrador sin guardar", () => {
    const borrador = usarAnteriorEnFila(fila, {});
    expect(valorHectareas(fila, borrador)).toEqual(fila.anterior);
    expect(cambiosDelPlan([fila], borrador)).toHaveLength(1);
  });
});
