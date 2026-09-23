import { http, HttpResponse } from "msw";
import { costoUsdHa, mercadoUsd, potencialTn, totalHectareas } from "@/features/planificacion-ventas/lib/calculos";
import {
  CULTIVOS_MARKET,
  type ConsolidadoResponse, type ContextoPlanificacion, type ControlPadron,
  type CultivoMarket, type FilaConsolidado, type FueraDeCarteras,
  type GuardarMarketShareRequest, type GuardarPlanRequest, type HectareasPlan,
  type MarketShareCultivoResponse, type MarketShareGrilla, type MarketShareResponse,
  type OriginacionConsolidado, type PlanSiembraFila, type PlanSiembraGrilla,
  type SucursalComercial, type TotalesConsolidado, type UsuarioAsignable,
  type VendedorComercial, type VendedorRequest, type ViajanteAsignable,
} from "@/features/planificacion-ventas/types";
import { env } from "@/lib/env";

const API = `${env.apiUrl}/planificacion-ventas`;
const formato = (anio: number) => `${anio}-${anio + 1}`;
const hoyArgentina = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "numeric",
}).formatToParts(new Date());
const anio = Number(hoyArgentina.find((parte) => parte.type === "year")?.value);
const mes = Number(hoyArgentina.find((parte) => parte.type === "month")?.value);
const VIGENTE = formato(mes >= 4 ? anio : anio - 1);
const ANTERIOR = formato(Number(VIGENTE.slice(0, 4)) - 1);
const HISTORICA = formato(Number(VIGENTE.slice(0, 4)) - 2);
const CAMPANIAS = [VIGENTE, ANTERIOR, HISTORICA];
const anteriorDe = (campania: string) => formato(Number(campania.slice(0, 4)) - 1);
const editable = (campania: string) => campania === VIGENTE || campania === ANTERIOR;
const fechaInicial = () => new Date(Date.now() - 2 * 3_600_000).toISOString();

interface Movimiento { facturacion: number; originacion: number; sorgo?: number; girasol?: number }
interface ProductorDemo {
  cuit: string;
  razonSocial: string;
  cuenta: number;
  codigoViajante: number;
  activo: boolean;
  movimientos: Record<string, Movimiento>;
}
const SIN_MOVIMIENTO: Movimiento = { facturacion: 0, originacion: 0 };
const PRODUCTORES: ProductorDemo[] = [
  { cuit: "20900000015", razonSocial: "PRODUCTOR DEMO ALFA", cuenta: 990001,
    codigoViajante: 901, activo: true, movimientos: {
      [VIGENTE]: { facturacion: 12400, originacion: 210, sorgo: 12 },
      [ANTERIOR]: { facturacion: 10500, originacion: 180 },
    } },
  { cuit: "20900000023", razonSocial: "PRODUCTOR DEMO BETA", cuenta: 990002,
    codigoViajante: 901, activo: true, movimientos: {
      [ANTERIOR]: { facturacion: 4200, originacion: 75 },
    } },
  { cuit: "20900000031", razonSocial: "PRODUCTOR DEMO GAMMA", cuenta: 990003,
    codigoViajante: 901, activo: true, movimientos: {} },
  { cuit: "20900000049", razonSocial: "PRODUCTOR DEMO DELTA", cuenta: 990004,
    codigoViajante: 901, activo: true, movimientos: {} },
  { cuit: "20900000058", razonSocial: "PRODUCTOR DEMO NORTE 05", cuenta: 990008,
    codigoViajante: 901, activo: true, movimientos: {} },
  { cuit: "20900000066", razonSocial: "PRODUCTOR DEMO NORTE 06", cuenta: 990009,
    codigoViajante: 901, activo: true, movimientos: {} },
  { cuit: "20900000074", razonSocial: "PRODUCTOR DEMO NORTE 07", cuenta: 990010,
    codigoViajante: 901, activo: true, movimientos: {} },
  { cuit: "20900000082", razonSocial: "PRODUCTOR DEMO NORTE 08", cuenta: 990011,
    codigoViajante: 901, activo: true, movimientos: {} },
  { cuit: "20900000090", razonSocial: "PRODUCTOR DEMO NORTE 09", cuenta: 990012,
    codigoViajante: 901, activo: true, movimientos: {} },
  { cuit: "20900000104", razonSocial: "PRODUCTOR DEMO NORTE 10", cuenta: 990013,
    codigoViajante: 901, activo: true, movimientos: {} },
  { cuit: "30900000010", razonSocial: "PRODUCTOR DEMO ÉPSILON", cuenta: 990005,
    codigoViajante: 902, activo: true, movimientos: {
      [VIGENTE]: { facturacion: 8900, originacion: 140, girasol: 8 },
      [ANTERIOR]: { facturacion: 7600, originacion: 120 },
    } },
  { cuit: "30900000029", razonSocial: "PRODUCTOR DEMO ZETA", cuenta: 990006,
    codigoViajante: 902, activo: true, movimientos: {
      [ANTERIOR]: { facturacion: 1900, originacion: 40 },
    } },
  { cuit: "30900000037", razonSocial: "PRODUCTOR DEMO SIN ASIGNAR", cuenta: 990007,
    codigoViajante: 903, activo: true, movimientos: {
      [VIGENTE]: { facturacion: 1300, originacion: 30 },
    } },
];
// Una cuenta inventada sin CUIT representa la línea de conciliación fuera de carteras.
const SIN_CUIT = { [VIGENTE]: { facturacion: 450, originacion: 15 },
  [ANTERIOR]: { facturacion: 300, originacion: 10 } };
const CATALOGO_VIAJANTES = [
  { codigo: 901, nombre: "Viajante Demo Norte" },
  { codigo: 902, nombre: "Viajante Demo Sur" },
  { codigo: 903, nombre: "Viajante Demo Libre" },
];
const USUARIOS: UsuarioAsignable[] = [
  { id: 1, nombre: "Admin Demo", email: "admin@lcagro.local" },
  { id: 5, nombre: "Vendedor Demo", email: "vendedor@lcagro.local" },
];

interface PlanGuardado { plan: HectareasPlan | null; revision: number; modificadoPor: string; modificadoEl: string }
interface MarketGuardado {
  qqInsumoHa: number; precioUsdTn: number; rindeTnHa: number;
  revision: number; modificadoPor: string; modificadoEl: string;
}
interface EstadoDemo {
  sucursales: SucursalComercial[];
  vendedores: VendedorComercial[];
  planes: Map<string, Map<string, PlanGuardado>>;
  market: Map<string, Map<CultivoMarket, MarketGuardado>>;
  fechas: Map<string, string>;
}
function crearEstado(): EstadoDemo {
  const fecha = fechaInicial();
  const plan = (hectareas: HectareasPlan): PlanGuardado => ({
    plan: hectareas, revision: 1, modificadoPor: "Admin Demo", modificadoEl: fecha,
  });
  const market = (qqInsumoHa: number, precioUsdTn: number, rindeTnHa: number): MarketGuardado => ({
    qqInsumoHa, precioUsdTn, rindeTnHa, revision: 1,
    modificadoPor: "Admin Demo", modificadoEl: fecha,
  });
  return {
    sucursales: [
      { id: 1, nombre: "Sucursal Demo Norte", activa: true },
      { id: 2, nombre: "Sucursal Demo Sur", activa: true },
    ],
    vendedores: [
      { id: 1, nombre: "Vendedor Demo Norte", sucursalId: 1, sucursal: "Sucursal Demo Norte",
        viajantes: [901], usuarioId: 5, usuarioNombre: "Vendedor Demo", activo: true },
      { id: 2, nombre: "Vendedor Demo Sur", sucursalId: 2, sucursal: "Sucursal Demo Sur",
        viajantes: [902], usuarioId: null, usuarioNombre: null, activo: true },
    ],
    planes: new Map([
      [VIGENTE, new Map([
        ["20900000015", plan({ soja: 100, maiz: 30, trigo: 20, otro: 10 })],
        ["20900000049", plan({ soja: 45, maiz: null, trigo: null, otro: 5 })],
        ["30900000010", plan({ soja: 60, maiz: 40, trigo: 15, otro: null })],
      ])],
      [ANTERIOR, new Map([
        ["20900000015", plan({ soja: 90, maiz: 25, trigo: 18, otro: null })],
        ["20900000023", plan({ soja: 35, maiz: null, trigo: 10, otro: null })],
        ["30900000010", plan({ soja: 55, maiz: 35, trigo: 10, otro: null })],
      ])],
    ]),
    market: new Map([
      [VIGENTE, new Map([
        ["soja", market(2.5, 1200, 3.5)],
        ["maiz", market(4, 1000, 8)],
        ["trigo", market(2, 800, 4.5)],
      ])],
      [ANTERIOR, new Map([
        ["soja", market(2.3, 1100, 3.3)],
        ["maiz", market(3.8, 950, 7.5)],
        ["trigo", market(1.9, 780, 4.2)],
      ])],
    ]),
    fechas: new Map(CAMPANIAS.map((campania) => [campania, fecha])),
  };
}
let estado = crearEstado();
/** Los tests reinician el estado de la demo; la navegación normal conserva las escrituras. */
export function reiniciarPlanificacionVentasDemo() { estado = crearEstado(); }

function problema(status: number, codigo: string, detail: string, extra = {}) {
  return HttpResponse.json({ status, title: "Error", detail, codigo, ...extra }, { status });
}
function acceso(request: Request, gestion = false):
  { id: number; veTodo: boolean } | { error: Response } {
  const token = /^Bearer mock-access-(\d+)$/.exec(request.headers.get("authorization") ?? "");
  const id = Number(token?.[1]);
  if (!id) return { error: problema(401, "unauthorized", "Iniciá sesión.") };
  const veTodo = id === 1 || id === 6;
  if (!veTodo && (gestion || id !== 5))
    return { error: problema(403, "forbidden", "No tenés permiso para esta pantalla.") };
  return { id, veTodo };
}
function vendedorDeUsuario(id: number) {
  return estado.vendedores.find((vendedor) => vendedor.activo && vendedor.usuarioId === id);
}
function vendedorDe(productor: ProductorDemo) {
  return estado.vendedores.find((vendedor) => vendedor.viajantes.includes(productor.codigoViajante));
}
function movimiento(productor: ProductorDemo, campania: string): Movimiento {
  return productor.movimientos[campania] ?? SIN_MOVIMIENTO;
}
function tieneMovimiento(productor: ProductorDemo, campania: string) {
  const periodos = [campania, anteriorDe(campania)];
  return periodos.some((periodo) => {
    const dato = movimiento(productor, periodo);
    return dato.facturacion !== 0 || dato.originacion !== 0 || !!dato.sorgo || !!dato.girasol;
  });
}
function planGuardado(campania: string, cuit: string) {
  const guardado = estado.planes.get(campania)?.get(cuit);
  return guardado?.plan ? guardado : undefined;
}
function parametros(campania: string): MarketShareGrilla | null {
  const filas = estado.market.get(campania);
  if (!CULTIVOS_MARKET.every((cultivo) => filas?.has(cultivo))) return null;
  const cultivo = (clave: CultivoMarket) => {
    const fila = filas!.get(clave)!;
    return { costoUsdHa: costoUsdHa(fila.qqInsumoHa, fila.precioUsdTn),
      rindeTnHa: fila.rindeTnHa };
  };
  return { soja: cultivo("soja"), maiz: cultivo("maiz"), trigo: cultivo("trigo") };
}
function nombreUsuario(id: number) {
  return id === 6 ? "Gestión Demo" : USUARIOS.find((usuario) => usuario.id === id)?.nombre ?? "Usuario Demo";
}
function valido(campania: string) { return /^\d{4}-\d{4}$/.test(campania) &&
  Number(campania.slice(5)) === Number(campania.slice(0, 4)) + 1; }
function verificarCampania(campania: string) {
  return valido(campania) ? null : problema(400, "validation", "Campaña inválida.");
}
function porcentaje(numerador: number, denominador: number | null) {
  return denominador !== null && denominador > 0 ? numerador / denominador : null;
}
function variacion(actual: number, anterior: number) {
  return anterior === 0 ? null : actual / anterior - 1;
}
function esHectarea(valor: number | null) {
  return valor === null || Number.isFinite(valor) && valor >= 0 && valor <= 99_999_999.99 &&
    Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-7;
}

function grilla(campania: string, vendedorId: number, incluirSinMovimiento: boolean): PlanSiembraGrilla {
  const vendedor = estado.vendedores.find((item) => item.id === vendedorId);
  const filas: PlanSiembraFila[] = PRODUCTORES.filter((productor) =>
    vendedorDe(productor)?.id === vendedorId &&
    (tieneMovimiento(productor, campania) || !!planGuardado(campania, productor.cuit) ||
      incluirSinMovimiento && productor.activo)).map((productor) => {
    const guardado = planGuardado(campania, productor.cuit);
    return {
      cuit: productor.cuit, razonSocial: productor.razonSocial, cuentas: [productor.cuenta],
      vendedor: vendedor ? { id: vendedor.id, nombre: vendedor.nombre } : null,
      sucursal: vendedor?.sucursal ?? null,
      conMovimiento: tieneMovimiento(productor, campania),
      plan: guardado?.plan ?? null, revision: guardado?.revision ?? 0,
      anterior: planGuardado(anteriorDe(campania), productor.cuit)?.plan ?? null,
      modificadoPor: guardado?.modificadoPor ?? null,
      modificadoEl: guardado?.modificadoEl ?? null,
    };
  });
  return { campania, editable: editable(campania), datosMacroGestAl: estado.fechas.get(campania) ?? fechaInicial(),
    marketShare: parametros(campania), filas, sinVendedor: false };
}
function origen(anterior: number, campania: number, sorgo = 0, girasol = 0): OriginacionConsolidado {
  return { anterior, campania, total: anterior + campania, sorgo, girasol };
}
function filaConsolidado(productor: ProductorDemo, campania: string): FilaConsolidado {
  const vendedor = vendedorDe(productor);
  const plan = planGuardado(campania, productor.cuit)?.plan ?? null;
  const actual = movimiento(productor, campania);
  const previo = movimiento(productor, anteriorDe(campania));
  const facturacionLcUsd = vendedor ? actual.facturacion : 0;
  const facturacionLcAnteriorUsd = vendedor ? previo.facturacion : 0;
  const origenActual = vendedor ? actual.originacion : 0;
  const origenPrevio = vendedor ? previo.originacion : 0;
  const mercado = mercadoUsd(plan, parametros(campania));
  return {
    cuit: productor.cuit, razonSocial: productor.razonSocial,
    vendedorId: vendedor?.id ?? null, vendedor: vendedor?.nombre ?? null,
    sucursalId: vendedor?.sucursalId ?? null, sucursal: vendedor?.sucursal ?? null,
    hectareas: plan ? { ...plan, total: totalHectareas(plan) } : null,
    mercadoUsd: mercado, facturacionLcUsd, facturacionLcAnteriorUsd,
    variacionLc: variacion(facturacionLcUsd, facturacionLcAnteriorUsd),
    participacionLc: porcentaje(facturacionLcUsd, mercado),
    originacionTn: origen(origenPrevio, origenActual,
      vendedor ? actual.sorgo ?? 0 : 0, vendedor ? actual.girasol ?? 0 : 0),
    potencialTn: potencialTn(plan, parametros(campania)),
    compraInsumos: actual.originacion || previo.originacion
      ? facturacionLcUsd > 0 ? "si" : "no" : "sin_originacion",
  };
}
function totales(filas: FilaConsolidado[]): TotalesConsolidado {
  const sumar = (selector: (fila: FilaConsolidado) => number) =>
    filas.reduce((total, fila) => total + selector(fila), 0);
  const conMercado = filas.filter((fila) => (fila.mercadoUsd ?? 0) > 0);
  const mercado = filas.some((fila) => fila.mercadoUsd !== null)
    ? sumar((fila) => fila.mercadoUsd ?? 0) : null;
  const potencial = filas.some((fila) => fila.potencialTn !== null)
    ? sumar((fila) => fila.potencialTn ?? 0) : null;
  const facturacionLcUsd = sumar((fila) => fila.facturacionLcUsd);
  const facturacionLcAnteriorUsd = sumar((fila) => fila.facturacionLcAnteriorUsd);
  return {
    hectareas: { soja: sumar((fila) => fila.hectareas?.soja ?? 0),
      maiz: sumar((fila) => fila.hectareas?.maiz ?? 0),
      trigo: sumar((fila) => fila.hectareas?.trigo ?? 0),
      otro: sumar((fila) => fila.hectareas?.otro ?? 0),
      total: sumar((fila) => fila.hectareas?.total ?? 0) },
    mercadoUsd: mercado, facturacionLcUsd, facturacionLcAnteriorUsd,
    variacionLc: variacion(facturacionLcUsd, facturacionLcAnteriorUsd),
    participacionLc: porcentaje(conMercado.reduce((suma, fila) => suma + fila.facturacionLcUsd, 0),
      conMercado.reduce((suma, fila) => suma + (fila.mercadoUsd ?? 0), 0)),
    originacionTn: origen(sumar((fila) => fila.originacionTn.anterior),
      sumar((fila) => fila.originacionTn.campania),
      sumar((fila) => fila.originacionTn.sorgo), sumar((fila) => fila.originacionTn.girasol)),
    potencialTn: potencial,
  };
}
function fueraDeCarteras(campania: string): FueraDeCarteras {
  const sinAsignar = PRODUCTORES.filter((productor) => !vendedorDe(productor));
  const suma = (periodo: string, campo: "facturacion" | "originacion") =>
    sinAsignar.reduce((total, productor) => total + movimiento(productor, periodo)[campo], 0) +
    (SIN_CUIT[periodo as keyof typeof SIN_CUIT]?.[campo] ?? 0);
  return { facturacionLcUsd: suma(campania, "facturacion"),
    facturacionLcAnteriorUsd: suma(anteriorDe(campania), "facturacion"),
    originacionTn: origen(suma(anteriorDe(campania), "originacion"),
      suma(campania, "originacion")),
    cuits: sinAsignar.filter((productor) => tieneMovimiento(productor, campania)).length,
    cuentasSinCuit: [campania, anteriorDe(campania)].some((periodo) => {
      const dato = SIN_CUIT[periodo as keyof typeof SIN_CUIT];
      return dato && (dato.facturacion !== 0 || dato.originacion !== 0);
    }) ? 1 : 0 };
}
/** `vendedorIds` vacío = todas las carteras del alcance; con uno o varios, recorta la hoja. */
function consolidado(campania: string, veTodo: boolean, vendedorIds: number[] = [],
  sucursalId?: number): ConsolidadoResponse {
  const filas = PRODUCTORES.filter((productor) =>
    (vendedorDe(productor) || planGuardado(campania, productor.cuit) ||
      planGuardado(anteriorDe(campania), productor.cuit)) &&
    (tieneMovimiento(productor, campania) || !!planGuardado(campania, productor.cuit) ||
      !!planGuardado(anteriorDe(campania), productor.cuit)))
    .map((productor) => filaConsolidado(productor, campania))
    .filter((fila) => (veTodo || vendedorIds.length > 0) &&
      (vendedorIds.length === 0 ||
        (fila.vendedorId !== null && vendedorIds.includes(fila.vendedorId))) &&
      (sucursalId === undefined || fila.sucursalId === sucursalId));
  const carteras = filas.filter((fila) => fila.vendedorId !== null);
  const subtotal = (campo: "vendedor" | "sucursal") => {
    const ids = [...new Set(carteras.map((fila) => campo === "vendedor"
      ? fila.vendedorId! : fila.sucursalId!))];
    return ids.map((id) => {
      const filasGrupo = carteras.filter((fila) => (campo === "vendedor"
        ? fila.vendedorId : fila.sucursalId) === id);
      return { id, nombre: (campo === "vendedor" ? filasGrupo[0].vendedor : filasGrupo[0].sucursal)!,
        totales: totales(filasGrupo) };
    });
  };
  const total = totales(carteras);
  const base = totales(filas);
  const fuera = veTodo && vendedorIds.length === 0 && sucursalId === undefined
    ? fueraDeCarteras(campania) : null;
  const facturacionLcUsd = base.facturacionLcUsd + (fuera?.facturacionLcUsd ?? 0);
  const facturacionLcAnteriorUsd = base.facturacionLcAnteriorUsd +
    (fuera?.facturacionLcAnteriorUsd ?? 0);
  const o = fuera?.originacionTn;
  const totalGeneral: TotalesConsolidado = {
    ...base, facturacionLcUsd, facturacionLcAnteriorUsd,
    variacionLc: variacion(facturacionLcUsd, facturacionLcAnteriorUsd),
    originacionTn: o ? origen(base.originacionTn.anterior + o.anterior,
      base.originacionTn.campania + o.campania,
      base.originacionTn.sorgo + o.sorgo, base.originacionTn.girasol + o.girasol)
      : base.originacionTn,
  };
  return { campania, datosMacroGestAl: estado.fechas.get(campania) ?? fechaInicial(), filas,
    subtotalesSucursales: subtotal("sucursal"), subtotalesVendedores: subtotal("vendedor"),
    total, totalGeneral, fueraDeCarteras: fuera,
    ajusteRedondeo: { campaniaUsd: 0, anteriorUsd: 0 }, sinVendedor: false };
}
function marketShare(campania: string, veTodo: boolean, vendedorId?: number): MarketShareResponse {
  const filas = estado.market.get(campania);
  const cultivos: MarketShareCultivoResponse[] = CULTIVOS_MARKET.map((cultivo) => {
    const fila = filas?.get(cultivo);
    return { cultivo, qqInsumoHa: fila?.qqInsumoHa ?? null,
      precioUsdTn: fila?.precioUsdTn ?? null,
      costoUsdHa: fila ? costoUsdHa(fila.qqInsumoHa, fila.precioUsdTn) : null,
      rindeTnHa: fila?.rindeTnHa ?? null, revision: fila?.revision ?? 0,
      modificadoPor: fila?.modificadoPor ?? null, modificadoEl: fila?.modificadoEl ?? null };
  });
  const planes = [...(estado.planes.get(campania)?.entries() ?? [])]
    .filter(([cuit, guardado]) => guardado.plan && (veTodo ||
      vendedorDe(PRODUCTORES.find((productor) => productor.cuit === cuit)!)?.id === vendedorId))
    .map(([, guardado]) => guardado.plan!);
  const porCultivo = (cultivo: CultivoMarket) => {
    const hectareas = planes.reduce((total, plan) => total + (plan[cultivo] ?? 0), 0);
    const fila = filas?.get(cultivo);
    const costo = fila ? costoUsdHa(fila.qqInsumoHa, fila.precioUsdTn) : null;
    return { hectareas, costoUsdHa: costo, mercadoUsd: costo === null ? null : hectareas * costo,
      rindeTnHa: fila?.rindeTnHa ?? null,
      potencialTn: fila ? hectareas * fila.rindeTnHa : null };
  };
  const soja = porCultivo("soja");
  const maiz = porCultivo("maiz");
  const trigo = porCultivo("trigo");
  const completos = [soja, maiz, trigo].every((item) => item.mercadoUsd !== null);
  const mercado = completos ? soja.mercadoUsd! + maiz.mercadoUsd! + trigo.mercadoUsd! : null;
  const potencial = completos ? soja.potencialTn! + maiz.potencialTn! + trigo.potencialTn! : null;
  const visibles = PRODUCTORES.filter((productor) => veTodo || vendedorDe(productor)?.id === vendedorId);
  const facturacion = visibles.reduce((suma, productor) => suma + movimiento(productor, campania).facturacion, 0);
  const originacion = visibles.reduce((suma, productor) => suma + movimiento(productor, campania).originacion, 0);
  const conDatos = [...estado.market.entries()].filter(([clave, datos]) => clave < campania && datos.size)
    .sort(([a], [b]) => b.localeCompare(a))[0]?.[0] ?? null;
  return { campania, editable: editable(campania), copiarDe: filas?.size ? null : conDatos,
    datosMacroGestAl: estado.fechas.get(campania) ?? fechaInicial(), cultivos,
    resumen: { soja, maiz, trigo, hectareasOtro: planes.reduce((suma, plan) => suma + (plan.otro ?? 0), 0),
      mercadoUsd: mercado, potencialTn: potencial, facturacionLcUsd: facturacion,
      participacionLc: porcentaje(facturacion, mercado), originacionTn: originacion,
      participacionOriginacion: porcentaje(originacion, potencial) },
    sinVendedor: false };
}
function controlPadron(campania: string): ControlPadron {
  const codigosSinVendedor = CATALOGO_VIAJANTES.filter((item) =>
    !estado.vendedores.some((vendedor) => vendedor.viajantes.includes(item.codigo)))
    .map((item) => ({ codigo: item.codigo,
      cuentas: PRODUCTORES.filter((productor) => productor.codigoViajante === item.codigo &&
        tieneMovimiento(productor, campania)).length }))
    .filter((item) => item.cuentas > 0);
  return { campania, datosMacroGestAl: estado.fechas.get(campania) ?? fechaInicial(),
    codigosSinVendedorConMovimiento: codigosSinVendedor, cuitsAmbiguos: 0,
    productoresPorVendedor: estado.vendedores.map((vendedor) => ({ vendedorId: vendedor.id,
      productores: PRODUCTORES.filter((productor) => vendedorDe(productor)?.id === vendedor.id &&
        (productor.activo || tieneMovimiento(productor, campania))).length })),
    cuentasSinCuitValidoPorVendedor: [], cuentasSinClienteConMovimiento: 0,
    facturacionSinCuitUsd: {
      cuentas: SIN_CUIT[campania as keyof typeof SIN_CUIT]?.facturacion ? 1 : 0,
      total: SIN_CUIT[campania as keyof typeof SIN_CUIT]?.facturacion ?? 0,
    },
    originacionSinCuitTn: {
      cuentas: SIN_CUIT[campania as keyof typeof SIN_CUIT]?.originacion ? 1 : 0,
      total: SIN_CUIT[campania as keyof typeof SIN_CUIT]?.originacion ?? 0,
    } };
}

export const planificacionVentasHandlers = [
  http.get(`${API}/contexto`, ({ request }) => {
    const auth = acceso(request);
    if ("error" in auth) return auth.error;
    const vendedor = auth.veTodo ? null : vendedorDeUsuario(auth.id);
    const contexto: ContextoPlanificacion = {
      campaniaVigente: VIGENTE,
      campanias: CAMPANIAS.map((codigo) => ({ codigo, editable: editable(codigo) })),
      alcance: { veTodo: auth.veTodo, vendedor: vendedor ? {
        id: vendedor.id, nombre: vendedor.nombre, sucursal: vendedor.sucursal,
      } : null },
    };
    return HttpResponse.json(contexto);
  }),

  http.get(`${API}/plan-siembra`, ({ request }) => {
    const auth = acceso(request);
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const campania = url.searchParams.get("campania") ?? "";
    const error = verificarCampania(campania);
    if (error) return error;
    const pedido = Number(url.searchParams.get("vendedorId"));
    const propio = vendedorDeUsuario(auth.id);
    if (!auth.veTodo && pedido && pedido !== propio?.id)
      return problema(403, "forbidden", "El vendedor no pertenece a tu cartera.");
    const vendedorId = auth.veTodo ? pedido : propio?.id;
    if (auth.veTodo && !vendedorId)
      return problema(400, "validation", "Elegí un vendedor.");
    if (!vendedorId) return HttpResponse.json({ ...grilla(campania, 0, false),
      filas: [], sinVendedor: true, datosMacroGestAl: null } satisfies PlanSiembraGrilla);
    return HttpResponse.json(grilla(campania, vendedorId,
      url.searchParams.get("incluirSinMovimiento") === "true"));
  }),

  http.put(`${API}/plan-siembra/:campania`, async ({ request, params }) => {
    const auth = acceso(request);
    if ("error" in auth) return auth.error;
    const campania = String(params.campania);
    const error = verificarCampania(campania);
    if (error) return error;
    if (!editable(campania)) return problema(403, "forbidden", "La campaña no admite cambios.");
    const body = await request.json() as GuardarPlanRequest;
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 200)
      return problema(400, "validation", "El lote debe tener entre 1 y 200 productores.");
    const vendedorId = auth.veTodo ? body.vendedorId : vendedorDeUsuario(auth.id)?.id;
    if (!vendedorId) return problema(403, "forbidden", "No tenés vendedor asignado.");
    const errores: Record<string, string[]> = {};
    const vistos = new Set<string>();
    body.items.forEach((item, i) => {
      if (vistos.has(item.cuit)) errores[`Items[${i}].Cuit`] = ["CUIT duplicado."];
      vistos.add(item.cuit);
      for (const campo of ["soja", "maiz", "trigo", "otro"] as const)
        if (!esHectarea(item[campo])) errores[`Items[${i}].${campo}`] = ["Hectáreas inválidas."];
    });
    if (Object.keys(errores).length) return problema(400, "validation", "Revisá las hectáreas.",
      { errors: errores });
    if (body.items.some((item) => {
      const productor = PRODUCTORES.find((p) => p.cuit === item.cuit);
      return !productor || vendedorDe(productor)?.id !== vendedorId;
    })) return problema(403, "forbidden", "Hay productores fuera de la cartera.");
    const cuits = body.items.filter((item) =>
      (planGuardado(campania, item.cuit)?.revision ?? 0) !== item.revisionEsperada)
      .map((item) => item.cuit);
    if (cuits.length) return HttpResponse.json({ codigo: "plan_modificado", cuits }, { status: 409 });
    let porCuit = estado.planes.get(campania);
    if (!porCuit) { porCuit = new Map(); estado.planes.set(campania, porCuit); }
    const guardados = body.items.map((item) => {
      const anterior = porCuit!.get(item.cuit);
      const plan: HectareasPlan = { soja: item.soja, maiz: item.maiz,
        trigo: item.trigo, otro: item.otro };
      const vacio = Object.values(plan).every((valor) => valor === null);
      if ((!anterior?.plan && vacio) || JSON.stringify(anterior?.plan) === JSON.stringify(plan))
        return { cuit: item.cuit, revision: anterior?.plan ? anterior.revision : 0 };
      const revision = (anterior?.revision ?? 0) + 1;
      porCuit!.set(item.cuit, { plan: vacio ? null : plan, revision,
        modificadoPor: nombreUsuario(auth.id), modificadoEl: new Date().toISOString() });
      return { cuit: item.cuit, revision: vacio ? 0 : revision };
    });
    return HttpResponse.json({ guardados });
  }),

  http.get(`${API}/consolidado`, ({ request }) => {
    const auth = acceso(request);
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const campania = url.searchParams.get("campania") ?? "";
    const error = verificarCampania(campania);
    if (error) return error;
    const propio = vendedorDeUsuario(auth.id);
    // Clave repetible: `?vendedorId=3&vendedorId=7`.
    const pedidos = [...new Set(url.searchParams.getAll("vendedorId").map(Number))]
      .filter((id) => id > 0);
    if (!auth.veTodo && (pedidos.some((id) => id !== propio?.id) ||
      url.searchParams.has("sucursalId")))
      return problema(403, "forbidden", "No podés acceder a otra cartera.");
    const sucursalId = auth.veTodo ? Number(url.searchParams.get("sucursalId")) || undefined : undefined;
    if (!auth.veTodo && !propio) return HttpResponse.json({
      ...consolidado(campania, false, [0]), sinVendedor: true, datosMacroGestAl: null,
    } satisfies ConsolidadoResponse);
    const vendedorIds = auth.veTodo ? pedidos : [propio!.id];
    return HttpResponse.json(consolidado(campania, auth.veTodo, vendedorIds, sucursalId));
  }),

  http.get(`${API}/market-share/:campania`, ({ request, params }) => {
    const auth = acceso(request);
    if ("error" in auth) return auth.error;
    const campania = String(params.campania);
    const error = verificarCampania(campania);
    if (error) return error;
    const propio = vendedorDeUsuario(auth.id);
    if (!auth.veTodo && !propio) return HttpResponse.json({
      ...marketShare(campania, false, 0), sinVendedor: true, datosMacroGestAl: null,
    } satisfies MarketShareResponse);
    return HttpResponse.json(marketShare(campania, auth.veTodo, propio?.id));
  }),

  http.put(`${API}/market-share/:campania`, async ({ request, params }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    const campania = String(params.campania);
    const error = verificarCampania(campania);
    if (error) return error;
    if (!editable(campania)) return problema(403, "forbidden", "La campaña no admite cambios.");
    const body = await request.json() as GuardarMarketShareRequest;
    if (!Array.isArray(body.cultivos) || body.cultivos.length < 1 || body.cultivos.length > 3 ||
      new Set(body.cultivos.map((fila) => fila.cultivo)).size !== body.cultivos.length ||
      body.cultivos.some((fila) => !CULTIVOS_MARKET.includes(fila.cultivo) ||
        ![fila.qqInsumoHa, fila.precioUsdTn, fila.rindeTnHa].every((valor) =>
          Number.isFinite(valor) && valor >= 0)))
      return problema(400, "validation", "Revisá los parámetros de Market Share.");
    const filas = estado.market.get(campania) ?? new Map<CultivoMarket, MarketGuardado>();
    if (body.cultivos.some((fila) => (filas.get(fila.cultivo)?.revision ?? 0) !== fila.revisionEsperada))
      return problema(409, "conflict", "Market Share fue modificado por otra persona.");
    const guardados = body.cultivos.map((fila) => {
      const anterior = filas.get(fila.cultivo);
      if (anterior && anterior.qqInsumoHa === fila.qqInsumoHa &&
        anterior.precioUsdTn === fila.precioUsdTn && anterior.rindeTnHa === fila.rindeTnHa)
        return { cultivo: fila.cultivo, revision: anterior.revision };
      const revision = (anterior?.revision ?? 0) + 1;
      filas.set(fila.cultivo, { qqInsumoHa: fila.qqInsumoHa, precioUsdTn: fila.precioUsdTn,
        rindeTnHa: fila.rindeTnHa, revision,
        modificadoPor: nombreUsuario(auth.id), modificadoEl: new Date().toISOString() });
      return { cultivo: fila.cultivo, revision };
    });
    estado.market.set(campania, filas);
    return HttpResponse.json({ cultivos: guardados });
  }),

  http.post(`${API}/datos-macrogest/actualizar`, ({ request }) => {
    const auth = acceso(request);
    if ("error" in auth) return auth.error;
    const campania = new URL(request.url).searchParams.get("campania") ?? "";
    const error = verificarCampania(campania);
    if (error) return error;
    const ultima = estado.fechas.get(campania);
    if (!ultima || Date.now() - new Date(ultima).getTime() >= 60_000)
      estado.fechas.set(campania, new Date().toISOString());
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/sucursales`, ({ request }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    return HttpResponse.json(estado.sucursales);
  }),

  http.post(`${API}/sucursales`, async ({ request }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    const body = await request.json() as { nombre: string; activa: boolean };
    const nombre = body.nombre?.trim();
    if (!nombre || nombre.length > 60) return problema(400, "validation", "Ingresá una sucursal válida.");
    if (estado.sucursales.some((item) => item.nombre.toLocaleLowerCase("es-AR") ===
      nombre.toLocaleLowerCase("es-AR")))
      return problema(409, "conflict", "Ya existe una sucursal con ese nombre.");
    const nueva: SucursalComercial = { id: Math.max(0, ...estado.sucursales.map((item) => item.id)) + 1,
      nombre, activa: body.activa };
    estado.sucursales.push(nueva);
    return HttpResponse.json(nueva, { status: 201 });
  }),

  http.put(`${API}/sucursales/:id`, async ({ request, params }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    const sucursal = estado.sucursales.find((item) => item.id === Number(params.id));
    if (!sucursal) return problema(404, "not_found", "Sucursal no encontrada.");
    const body = await request.json() as { nombre: string; activa: boolean };
    const nombre = body.nombre?.trim();
    if (!nombre || nombre.length > 60) return problema(400, "validation", "Ingresá una sucursal válida.");
    if (estado.sucursales.some((item) => item.id !== sucursal.id &&
      item.nombre.toLocaleLowerCase("es-AR") === nombre.toLocaleLowerCase("es-AR")))
      return problema(409, "conflict", "Ya existe una sucursal con ese nombre.");
    Object.assign(sucursal, { nombre, activa: body.activa });
    estado.vendedores.filter((item) => item.sucursalId === sucursal.id)
      .forEach((item) => { item.sucursal = nombre; });
    return HttpResponse.json(sucursal);
  }),

  http.get(`${API}/vendedores`, ({ request }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    return HttpResponse.json(estado.vendedores);
  }),

  http.post(`${API}/vendedores`, async ({ request }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    const body = await request.json() as VendedorRequest;
    return guardarVendedor(body);
  }),

  http.put(`${API}/vendedores/:id`, async ({ request, params }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    const existente = estado.vendedores.find((item) => item.id === Number(params.id));
    if (!existente) return problema(404, "not_found", "Vendedor no encontrado.");
    const body = await request.json() as VendedorRequest;
    return guardarVendedor(body, existente);
  }),

  http.get(`${API}/viajantes-macrogest`, ({ request }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    const viajantes: ViajanteAsignable[] = CATALOGO_VIAJANTES.map((item) => {
      const vendedor = estado.vendedores.find((actual) => actual.viajantes.includes(item.codigo));
      return { ...item, vendedorId: vendedor?.id ?? null, vendedorNombre: vendedor?.nombre ?? null };
    });
    return HttpResponse.json(viajantes);
  }),

  http.get(`${API}/usuarios-asignables`, ({ request }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    return HttpResponse.json(USUARIOS);
  }),

  http.get(`${API}/control-padron`, ({ request }) => {
    const auth = acceso(request, true);
    if ("error" in auth) return auth.error;
    const campania = new URL(request.url).searchParams.get("campania") ?? "";
    const error = verificarCampania(campania);
    return error ?? HttpResponse.json(controlPadron(campania));
  }),
];

function guardarVendedor(body: VendedorRequest, existente?: VendedorComercial) {
  const nombre = body.nombre?.trim();
  const sucursal = estado.sucursales.find((item) => item.id === body.sucursalId);
  if (!nombre || nombre.length > 120 || !sucursal || !Array.isArray(body.viajantes) ||
    !body.viajantes.length || new Set(body.viajantes).size !== body.viajantes.length ||
    body.viajantes.some((codigo) => !CATALOGO_VIAJANTES.some((item) => item.codigo === codigo)))
    return problema(400, "validation", "Ingresá nombre, sucursal y códigos válidos.");
  if (body.activo && !sucursal.activa)
    return problema(400, "validation", "Un vendedor activo necesita una sucursal activa.");
  if (estado.vendedores.some((item) => item.id !== existente?.id &&
    item.nombre.toLocaleLowerCase("es-AR") === nombre.toLocaleLowerCase("es-AR")))
    return problema(409, "conflict", "Ya existe un vendedor con ese nombre.");
  if (estado.vendedores.some((item) => item.id !== existente?.id &&
    item.viajantes.some((codigo) => body.viajantes.includes(codigo))))
    return problema(409, "conflict", "Un código ya pertenece a otro vendedor.");
  if (body.usuarioId !== null && estado.vendedores.some((item) =>
    item.id !== existente?.id && item.usuarioId === body.usuarioId))
    return problema(409, "conflict", "El usuario ya pertenece a otro vendedor.");
  const vendedor: VendedorComercial = {
    id: existente?.id ?? Math.max(0, ...estado.vendedores.map((item) => item.id)) + 1,
    nombre, sucursalId: sucursal.id, sucursal: sucursal.nombre,
    viajantes: [...body.viajantes].sort((a, b) => a - b), usuarioId: body.usuarioId,
    usuarioNombre: USUARIOS.find((item) => item.id === body.usuarioId)?.nombre ?? null,
    activo: body.activo,
  };
  if (existente) Object.assign(existente, vendedor);
  else estado.vendedores.push(vendedor);
  return HttpResponse.json(vendedor, { status: existente ? 200 : 201 });
}
