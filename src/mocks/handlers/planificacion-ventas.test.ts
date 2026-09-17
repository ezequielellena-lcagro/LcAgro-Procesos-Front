import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { apiClient, setTokenBridge } from "@/lib/api-client";
import { costoUsdHa, mercadoUsd } from "@/features/planificacion-ventas/lib/calculos";
import type {
  ConsolidadoResponse, ContextoPlanificacion, ControlPadron, GuardarMarketShareRequest,
  GuardarPlanRequest, MarketShareResponse, PlanSiembraGrilla, SucursalComercial,
  VendedorComercial, ViajanteAsignable,
} from "@/features/planificacion-ventas/types";
import { planificacionVentasHandlers, reiniciarPlanificacionVentasDemo } from "./planificacion-ventas";

const server = setupServer(...planificacionVentasHandlers);
let usuarioId = 1;
const ruta = "/planificacion-ventas";
const contexto = async () =>
  (await apiClient.get<ContextoPlanificacion>(ruta + "/contexto")).data;
const plan = async (campania: string, vendedorId = 1, incluirSinMovimiento = false) =>
  (await apiClient.get<PlanSiembraGrilla>(ruta + "/plan-siembra", {
    params: { campania, vendedorId, incluirSinMovimiento },
  })).data;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  reiniciarPlanificacionVentasDemo();
  usuarioId = 1;
  setTokenBridge({
    getAccessToken: () => `mock-access-${usuarioId}`,
    refresh: async () => null,
    onAuthFailure: () => {},
  });
});
afterEach(() => {
  server.resetHandlers(...planificacionVentasHandlers);
  setTokenBridge({ getAccessToken: () => null, refresh: async () => null, onAuthFailure: () => {} });
});
afterAll(() => server.close());

describe("mocks de demo: planificación de ventas", () => {
  it("sirve CUIT válidos y sintéticos, respeta filtro de movimiento y alcance vendedor", async () => {
    const ctx = await contexto();
    expect(ctx.alcance.veTodo).toBe(true);
    const normal = await plan(ctx.campaniaVigente);
    const ampliado = await plan(ctx.campaniaVigente, 1, true);
    expect(normal.filas.length).toBeGreaterThan(0);
    expect(ampliado.filas.length).toBeGreaterThan(normal.filas.length);
    for (const fila of ampliado.filas) {
      expect(fila.razonSocial).toContain("DEMO");
      expect(fila.cuit).toMatch(/^(20|30)\d{9}$/);
      const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
      const suma = pesos.reduce((total, peso, i) => total + Number(fila.cuit[i]) * peso, 0);
      const resto = 11 - (suma % 11);
      expect(Number(fila.cuit[10])).toBe(resto === 11 ? 0 : resto === 10 ? 9 : resto);
    }
    usuarioId = 5;
    const vendedor = await contexto();
    expect(vendedor.alcance).toMatchObject({ veTodo: false, vendedor: { id: 1 } });
    expect((await plan(ctx.campaniaVigente, 1)).filas.every((f) => f.vendedor?.id === 1))
      .toBe(true);
    const ajeno = await apiClient.get(ruta + "/plan-siembra", {
      params: { campania: ctx.campaniaVigente, vendedorId: 2 },
    }).catch((error) => error.response);
    expect(ajeno.status).toBe(403);
    const consolidadoAjeno = await apiClient.get(ruta + "/consolidado", {
      params: { campania: ctx.campaniaVigente, vendedorId: 2 },
    }).catch((error) => error.response);
    expect(consolidadoAjeno.status).toBe(403);
  });

  it("muestra diez productores Norte sólo al incluir activos sin movimiento", async () => {
    const campania = (await contexto()).campaniaVigente;
    const normal = await plan(campania);
    const ampliado = await plan(campania, 1, true);
    expect(normal.filas).toHaveLength(3);
    expect(ampliado.filas).toHaveLength(10);
    const adicionales = ampliado.filas.filter((fila) =>
      !normal.filas.some((visible) => visible.cuit === fila.cuit));
    expect(adicionales).toHaveLength(7);
    expect(adicionales.every((fila) => !fila.conMovimiento && fila.plan === null)).toBe(true);
    const control = (await apiClient.get<ControlPadron>(ruta + "/control-padron", {
      params: { campania },
    })).data;
    expect(control.productoresPorVendedor).toContainEqual({ vendedorId: 1, productores: 10 });
    const consolidado = (await apiClient.get<ConsolidadoResponse>(ruta + "/consolidado", {
      params: { campania, vendedorId: 1 },
    })).data;
    expect(consolidado.filas).toHaveLength(3);
    expect(consolidado.total.hectareas.total).toBe(210);
  });

  it("guarda plan en memoria, refleja mercado y consolidado y refresca fecha", async () => {
    const { campaniaVigente: campania } = await contexto();
    const inicial = await plan(campania);
    const fila = inicial.filas.find((item) => item.plan)!;
    const nuevo = { soja: (fila.plan?.soja ?? 0) + 10, maiz: 0, trigo: null, otro: null };
    const request: GuardarPlanRequest = {
      vendedorId: 1, items: [{ cuit: fila.cuit, ...nuevo, revisionEsperada: fila.revision }],
    };
    const guardado = await apiClient.put(ruta + "/plan-siembra/" + campania, request);
    expect(guardado.data.guardados).toEqual([{ cuit: fila.cuit, revision: fila.revision + 1 }]);
    const recargado = await plan(campania);
    expect(recargado.filas.find((item) => item.cuit === fila.cuit)?.plan).toEqual(nuevo);
    const consolidado = (await apiClient.get<ConsolidadoResponse>(ruta + "/consolidado", {
      params: { campania, vendedorId: 1 },
    })).data;
    expect(consolidado.filas.find((item) => item.cuit === fila.cuit)?.mercadoUsd)
      .toBe(mercadoUsd(nuevo, recargado.marketShare));
    await apiClient.post(ruta + "/datos-macrogest/actualizar", null, { params: { campania } });
    expect((await plan(campania)).datosMacroGestAl).not.toBe(inicial.datosMacroGestAl);
  });

  it("un 409 por revisión vieja no guarda ninguna fila del lote", async () => {
    const { campaniaVigente: campania } = await contexto();
    const filas = (await plan(campania)).filas;
    const primera = filas.find((fila) => fila.plan)!;
    const segunda = filas.find((fila) => fila.cuit !== primera.cuit)!;
    const cambio = { cuit: primera.cuit, soja: 110, maiz: null, trigo: null, otro: null,
      revisionEsperada: primera.revision };
    await apiClient.put(ruta + "/plan-siembra/" + campania, {
      vendedorId: 1, items: [cambio],
    } satisfies GuardarPlanRequest);
    const respuesta = await apiClient.put(ruta + "/plan-siembra/" + campania, {
      vendedorId: 1, items: [cambio, { cuit: segunda.cuit, soja: 20, maiz: null,
        trigo: null, otro: null, revisionEsperada: segunda.revision }],
    } satisfies GuardarPlanRequest).catch((error) => error.response);
    expect(respuesta.status).toBe(409);
    expect(respuesta.data).toMatchObject({ codigo: "plan_modificado", cuits: [primera.cuit] });
    expect((await plan(campania)).filas.find((fila) => fila.cuit === segunda.cuit)?.plan)
      .toEqual(segunda.plan);
  });

  it("Market Share recalcula costo, resumen y consolidado; revisión vieja devuelve 409", async () => {
    const { campaniaVigente: campania } = await contexto();
    const antes = (await apiClient.get<MarketShareResponse>(ruta + "/market-share/" + campania)).data;
    const soja = antes.cultivos.find((item) => item.cultivo === "soja")!;
    const pedido: GuardarMarketShareRequest = { cultivos: [{
      cultivo: "soja", qqInsumoHa: soja.qqInsumoHa! + 1,
      precioUsdTn: soja.precioUsdTn!, rindeTnHa: soja.rindeTnHa!,
      revisionEsperada: soja.revision,
    }] };
    await apiClient.put(ruta + "/market-share/" + campania, pedido);
    const despues = (await apiClient.get<MarketShareResponse>(ruta + "/market-share/" + campania)).data;
    const sojaNueva = despues.cultivos.find((item) => item.cultivo === "soja")!;
    expect(sojaNueva.costoUsdHa).toBe(costoUsdHa(pedido.cultivos[0].qqInsumoHa,
      pedido.cultivos[0].precioUsdTn));
    expect(despues.resumen.soja.mercadoUsd).toBe(
      despues.resumen.soja.hectareas * sojaNueva.costoUsdHa!,
    );
    expect(despues.resumen.mercadoUsd).toBeGreaterThan(antes.resumen.mercadoUsd!);
    const consolidado = (await apiClient.get<ConsolidadoResponse>(ruta + "/consolidado", {
      params: { campania },
    })).data;
    expect(consolidado.total.mercadoUsd).toBe(despues.resumen.mercadoUsd);
    const viejo = await apiClient.put(ruta + "/market-share/" + campania, pedido)
      .catch((error) => error.response);
    expect(viejo.status).toBe(409);
  });

  it("campaña histórica sin movimiento no inventa cuentas sin CUIT", async () => {
    const historica = (await contexto()).campanias.find((item) => !item.editable)!.codigo;
    const control = (await apiClient.get<ControlPadron>(ruta + "/control-padron", {
      params: { campania: historica },
    })).data;
    expect(control.facturacionSinCuitUsd).toEqual({ cuentas: 0, total: 0 });
    expect(control.originacionSinCuitTn).toEqual({ cuentas: 0, total: 0 });
    const consolidado = (await apiClient.get<ConsolidadoResponse>(ruta + "/consolidado", {
      params: { campania: historica },
    })).data;
    expect(consolidado.fueraDeCarteras?.cuentasSinCuit).toBe(0);
  });
  it("rechaza vendedor activo en sucursal inactiva al crear o editar", async () => {
    const sucursal = (await apiClient.post<SucursalComercial>(ruta + "/sucursales", {
      nombre: "Sucursal Demo Inactiva", activa: false,
    })).data;
    const alta = await apiClient.post(ruta + "/vendedores", {
      nombre: "Vendedor Demo Invalido", sucursalId: sucursal.id,
      viajantes: [903], usuarioId: null, activo: true,
    }).catch((error) => error.response);
    expect(alta.status).toBe(400);
    const edicion = await apiClient.put(ruta + "/vendedores/2", {
      nombre: "Vendedor Demo Sur", sucursalId: sucursal.id,
      viajantes: [902], usuarioId: null, activo: true,
    }).catch((error) => error.response);
    expect(edicion.status).toBe(400);
  });
  it("ABM de vendedores reasigna código libre y actualiza control del padrón", async () => {
    const { campaniaVigente: campania } = await contexto();
    const viajantes = (await apiClient.get<ViajanteAsignable[]>(ruta + "/viajantes-macrogest")).data;
    const libre = viajantes.find((item) => item.vendedorId === null)!;
    const controlAntes = (await apiClient.get<ControlPadron>(ruta + "/control-padron", {
      params: { campania },
    })).data;
    expect(controlAntes.codigosSinVendedorConMovimiento.some((item) => item.codigo === libre.codigo))
      .toBe(true);
    const sucursal = (await apiClient.post<SucursalComercial>(ruta + "/sucursales", {
      nombre: "Sucursal Demo Nueva", activa: true,
    })).data;
    const nuevo = (await apiClient.post<VendedorComercial>(ruta + "/vendedores", {
      nombre: "Vendedor Demo Nuevo", sucursalId: sucursal.id, viajantes: [libre.codigo],
      usuarioId: null, activo: true,
    })).data;
    expect(nuevo.sucursal).toBe(sucursal.nombre);
    const control = (await apiClient.get<ControlPadron>(ruta + "/control-padron", {
      params: { campania },
    })).data;
    expect(control.codigosSinVendedorConMovimiento.some((item) => item.codigo === libre.codigo))
      .toBe(false);
    expect(control.productoresPorVendedor).toContainEqual({ vendedorId: nuevo.id, productores: 1 });
    const renombrada = (await apiClient.put<SucursalComercial>(ruta + "/sucursales/" + sucursal.id, {
      nombre: "Sucursal Demo Renovada", activa: true,
    })).data;
    const actualizado = (await apiClient.put<VendedorComercial>(ruta + "/vendedores/" + nuevo.id, {
      nombre: "Vendedor Demo Actualizado", sucursalId: renombrada.id,
      viajantes: [libre.codigo], usuarioId: null, activo: true,
    })).data;
    expect(actualizado.sucursal).toBe(renombrada.nombre);
    const ocupado = await apiClient.post(ruta + "/vendedores", {
      nombre: "Vendedor Demo Invalido", sucursalId: renombrada.id,
      viajantes: [libre.codigo], usuarioId: null, activo: true,
    }).catch((error) => error.response);
    expect(ocupado.status).toBe(409);
  });
});
