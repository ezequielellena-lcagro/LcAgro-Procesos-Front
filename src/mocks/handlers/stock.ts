import { http, HttpResponse } from "msw";
import type { DepositoFiltro, EstadoStock, EstadoVencimiento, SemaforoRotacion, StockItem, StockLote, TipoDeposito } from "@/features/stock/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

// Catálogo de depósitos (los 11 que el backend whitelistea). Espeja DepositoCatalogo.
const CATALOGO: DepositoFiltro[] = [
  { codigo: 0, nombre: "San Jorge", tipo: "Propio" },
  { codigo: 2, nombre: "Semillero", tipo: "Propio" },
  { codigo: 3, nombre: "Las Piur", tipo: "Propio" },
  { codigo: 5, nombre: "San Francisco", tipo: "Propio" },
  { codigo: 8, nombre: "Prod. Vencidos y/o Abiertos", tipo: "Propio" },
  { codigo: 43, nombre: "Monsanto / Bayer (SJ)", tipo: "Consignado" },
  { codigo: 44, nombre: "Adama", tipo: "Consignado" },
  { codigo: 45, nombre: "Sigma", tipo: "Consignado" },
  { codigo: 53, nombre: "Monsanto / Bayer (LV)", tipo: "Consignado" },
  { codigo: 55, nombre: "Bayer", tipo: "Consignado" },
  { codigo: 56, nombre: "Bayer", tipo: "Consignado" },
];

// Stock ficticio (NUNCA datos reales). La cobertura FÍSICA viene precalculada para el demo; la del
// disponible y el estado se derivan abajo, igual que en el backend.
const BASE: Omit<
  StockItem,
  | "nivelMinimo" | "bajoMinimo"
  | "estadoVenc" | "proximoVencimiento" | "unidadesVencidas" | "unidadesCriticas" | "valorUsdVencido"
  | "diasEnStockMax" | "diasEnStockPromedio" | "semaforoRotacion" | "lotes"
  | "pedidosCompras" | "ventaFacturados" | "ventaSinFacturar" | "totalDisponible"
  | "diasCoberturaDisponible" | "estado"
>[] = [
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10001, nombreProducto: "GLIFOSATO 48% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 1200, precioUsd: 4.5, valorUsd: 5400, ventaDiaria: 12.3, diasCobertura: 97 },
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10002, nombreProducto: "ATRAZINA 50% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 80, precioUsd: 6.2, valorUsd: 496, ventaDiaria: 9.0, diasCobertura: 9 },
  // Caso testigo de la feature: hay 870 litros en el galpón pero 840 ya están vendidos → 30 disponibles.
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10003, nombreProducto: "DICAMBA 57% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 870, precioUsd: 12.0, valorUsd: 10440, ventaDiaria: 43.5, diasCobertura: 20 },
  // Agotado pero con mercadería en camino: sin la columna "Por llegar" parece un quiebre total.
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10004, nombreProducto: "GLUFOSINATO 15% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 0, precioUsd: 9.0, valorUsd: 0, ventaDiaria: 15.0, diasCobertura: 0 },
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10010, nombreProducto: "CIPERMETRINA 25% X 5L", rubro: 201, rubroDesc: "INSECTICIDAS", unidad: "LT", stockActual: 300, precioUsd: 8.0, valorUsd: 2400, ventaDiaria: 0, diasCobertura: null },
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10020, nombreProducto: "FOSFATO DIAMONICO X 50KG", rubro: 207, rubroDesc: "FERTILIZANTES", unidad: "KG", stockActual: 25000, precioUsd: 0.85, valorUsd: 21250, ventaDiaria: 140, diasCobertura: 178 },
  { deposito: 5, depositoNombre: "San Francisco", tipoDeposito: "Propio", codigoArticulo: 10001, nombreProducto: "GLIFOSATO 48% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 400, precioUsd: 4.5, valorUsd: 1800, ventaDiaria: 12.3, diasCobertura: 97 },
  { deposito: 5, depositoNombre: "San Francisco", tipoDeposito: "Propio", codigoArticulo: 10030, nombreProducto: "2,4-D 100% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 60, precioUsd: 5.5, valorUsd: 330, ventaDiaria: 6.0, diasCobertura: 10 },
  { deposito: 5, depositoNombre: "San Francisco", tipoDeposito: "Propio", codigoArticulo: 10040, nombreProducto: "UREA GRANULADA X 50KG", rubro: 207, rubroDesc: "FERTILIZANTES", unidad: "KG", stockActual: 60000, precioUsd: 0.6, valorUsd: 36000, ventaDiaria: 0, diasCobertura: null },
  { deposito: 2, depositoNombre: "Semillero", tipoDeposito: "Propio", codigoArticulo: 10060, nombreProducto: "CURASEMILLA X 5L", rubro: 203, rubroDesc: "CURASEMILLAS", unidad: "LT", stockActual: 220, precioUsd: 11.0, valorUsd: 2420, ventaDiaria: 4.0, diasCobertura: 55 },
  { deposito: 3, depositoNombre: "Las Piur", tipoDeposito: "Propio", codigoArticulo: 10050, nombreProducto: "FUNGICIDA TRIAZOL X 5L", rubro: 202, rubroDesc: "FUNGICIDAS", unidad: "LT", stockActual: 150, precioUsd: 14.0, valorUsd: 2100, ventaDiaria: 3.0, diasCobertura: 50 },
  { deposito: 44, depositoNombre: "Adama", tipoDeposito: "Consignado", codigoArticulo: 10070, nombreProducto: "INSECTICIDA ADAMA X 5L", rubro: 201, rubroDesc: "INSECTICIDAS", unidad: "LT", stockActual: 500, precioUsd: 9.5, valorUsd: 4750, ventaDiaria: 8.0, diasCobertura: 62 },
  { deposito: 45, depositoNombre: "Sigma", tipoDeposito: "Consignado", codigoArticulo: 10080, nombreProducto: "HERBICIDA SIGMA X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 90, precioUsd: 7.0, valorUsd: 630, ventaDiaria: 9.0, diasCobertura: 10 },
  { deposito: 55, depositoNombre: "Bayer", tipoDeposito: "Consignado", codigoArticulo: 10090, nombreProducto: "FUNGICIDA BAYER X 5L", rubro: 202, rubroDesc: "FUNGICIDAS", unidad: "LT", stockActual: 700, precioUsd: 16.0, valorUsd: 11200, ventaDiaria: 0, diasCobertura: null },
  { deposito: 56, depositoNombre: "Bayer", tipoDeposito: "Consignado", codigoArticulo: 10091, nombreProducto: "SEMILLA BAYER MAIZ X BOLSA", rubro: 207, rubroDesc: "FERTILIZANTES", unidad: "KG", stockActual: 3000, precioUsd: 2.0, valorUsd: 6000, ventaDiaria: 20, diasCobertura: 150 },
];

// Mínimos de demo (espeja articulo.nivel_minimo). Los que tienen stock por debajo quedan "bajo mínimo".
const MINIMOS: Record<number, number> = { 10002: 100, 10030: 100, 10080: 100 };

/**
 * Pedidos de demo por `depósito-artículo`: compras por llegar (suman) y ventas todavía en el
 * galpón (restan). Sin entrada → todo en cero. Los tres casos que la feature existe para mostrar:
 * 10003 vendido casi entero (30 disponibles con 20 días de "cobertura"), 10004 agotado pero con
 * mercadería en camino, 10080 en SOBREVENTA (disponible negativo, igual que lo muestra MacroGest).
 */
const PEDIDOS_DEMO: Record<string, { compras?: number; facturados?: number; sinFacturar?: number }> = {
  "0-10001": { facturados: 100, sinFacturar: 50 },
  "0-10003": { facturados: 600, sinFacturar: 240 },
  "0-10004": { compras: 800 },
  "0-10020": { compras: 5000, facturados: 2000 },
  "5-10001": { sinFacturar: 40 },
  "44-10070": { sinFacturar: 50 },
  "45-10080": { facturados: 120, sinFacturar: 30 },
  "56-10091": { compras: 1000 },
};
// Días hasta vencer de CADA lote del artículo. Sin entrada → un solo lote que vence lejos (Normal).
// Cubre las 4 solapas del demo: 10001 tiene dos lotes (uno vencido, uno normal) para que la solapa
// Vencimientos muestre solo el problemático; 10002 tiene DOS lotes accionables (vencido + crítico)
// para que la solapa muestre más filas que artículos paginados; 10030/10010 Crítico, 10090 Alerta.
const LOTES_DEMO: Record<number, number[]> = {
  10001: [-5, 500],
  10002: [-20, 30],
  10030: [60],
  10010: [150],
  10090: [250],
};
// Antigüedad de demo: los inmovilizados son los más viejos (semáforo Rojo).
const ANTIGUEDAD_DEMO: Record<number, number> = { 10010: 300, 10040: 300, 10090: 300 };

// Severidad de peor a mejor: el estado del artículo es el peor de sus lotes.
const SEVERIDAD: EstadoVencimiento[] = ["Vencido", "Critico", "Alerta", "Normal", "SinFecha"];

function hoyMas(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
function estadoVencDe(dias: number): EstadoVencimiento {
  if (dias < 0) return "Vencido";
  if (dias <= 180) return "Critico";
  if (dias <= 360) return "Alerta";
  return "Normal";
}
function semaforoRotDe(dias: number): SemaforoRotacion {
  if (dias <= 90) return "Verde";
  if (dias <= 180) return "Amarillo";
  return "Rojo";
}
function peorEstadoVenc(lotes: StockLote[]): EstadoVencimiento {
  return lotes.reduce<EstadoVencimiento>(
    (peor, l) => (SEVERIDAD.indexOf(l.estadoVenc) < SEVERIDAD.indexOf(peor) ? l.estadoVenc : peor),
    "SinFecha",
  );
}
function unidadesEn(lotes: StockLote[], estado: EstadoVencimiento): number {
  return lotes.filter((l) => l.estadoVenc === estado).reduce((s, l) => s + l.stockActual, 0);
}

/** Antigüedad promedio ponderada por unidades (null si ningún lote tiene ingreso). Espeja PromedioPonderado. */
function antiguedadPromedio(lotes: StockLote[]): number | null {
  const conIngreso = lotes.filter((l) => l.diasEnStock !== null);
  if (!conIngreso.length) return null;
  const peso = conIngreso.reduce((s, l) => s + l.stockActual, 0);
  if (peso <= 0) return null;
  return Math.round(conIngreso.reduce((s, l) => s + (l.diasEnStock as number) * l.stockActual, 0) / peso);
}

// Umbrales de cobertura del backend (StockOptions): < 15 días = riesgo de quiebre, > 180 = inmovilizado.
const COBERTURA_MIN = 15;
const COBERTURA_MAX = 180;

/** Espeja ClasificarEstado del backend: se alimenta de la cobertura del DISPONIBLE, no de la física. */
function clasificarEstado(cobertura: number | null): EstadoStock {
  if (cobertura === null) return "Inmovilizado";
  if (cobertura < COBERTURA_MIN) return "RiesgoQuiebre";
  if (cobertura > COBERTURA_MAX) return "Inmovilizado";
  return "Ok";
}

/** Fila armada, antes de lo que se calcula a nivel ARTÍCULO (cobertura del disponible, estado, mínimo). */
type FilaSinDerivar = Omit<StockItem, "diasCoberturaDisponible" | "estado" | "bajoMinimo">;

const SIN_DERIVAR: FilaSinDerivar[] = BASE.map((r) => {
  const nivelMinimo = MINIMOS[r.codigoArticulo] ?? 0;
  const diasEnStock = ANTIGUEDAD_DEMO[r.codigoArticulo] ?? 120;
  const diasVenc = LOTES_DEMO[r.codigoArticulo] ?? [500];
  // El stock del artículo se reparte en partes iguales entre sus lotes.
  const stockLote = Math.round(r.stockActual / diasVenc.length);
  const lotes: StockLote[] = diasVenc.map((dias, i) => ({
    serie: `L-${r.codigoArticulo}-${i + 1}`,
    stockActual: stockLote,
    fechaIngreso: hoyMas(-diasEnStock),
    fechaVencimiento: hoyMas(dias),
    diasParaVencer: dias,
    estadoVenc: estadoVencDe(dias),
    diasEnStock,
    semaforoRotacion: semaforoRotDe(diasEnStock),
  }));
  const unidadesVencidas = unidadesEn(lotes, "Vencido");
  const unidadesCriticas = unidadesEn(lotes, "Critico");
  const pedidos = PEDIDOS_DEMO[`${r.deposito}-${r.codigoArticulo}`] ?? {};
  const pedidosCompras = pedidos.compras ?? 0;
  const ventaFacturados = pedidos.facturados ?? 0;
  const ventaSinFacturar = pedidos.sinFacturar ?? 0;
  return {
    ...r,
    pedidosCompras,
    ventaFacturados,
    ventaSinFacturar,
    // Igual que el backend: puede quedar NEGATIVO (sobreventa) y no se pisa en 0.
    totalDisponible: r.stockActual + pedidosCompras - ventaFacturados - ventaSinFacturar,
    nivelMinimo,
    estadoVenc: peorEstadoVenc(lotes),
    // El más temprano de los lotes (los días de demo pueden venir desordenados).
    proximoVencimiento: hoyMas(Math.min(...diasVenc)),
    unidadesVencidas,
    unidadesCriticas,
    valorUsdVencido: Math.round(unidadesVencidas * r.precioUsd * 100) / 100,
    diasEnStockMax: diasEnStock,
    diasEnStockPromedio: diasEnStock,
    semaforoRotacion: semaforoRotDe(diasEnStock),
    lotes,
  };
});

/** Disponible por ARTÍCULO (todos los depósitos): la base de la cobertura y del mínimo. */
const DISPONIBLE_POR_ARTICULO = SIN_DERIVAR.reduce((acc, r) => {
  acc.set(r.codigoArticulo, (acc.get(r.codigoArticulo) ?? 0) + r.totalDisponible);
  return acc;
}, new Map<number, number>());

/**
 * Cobertura, semáforo y "bajo mínimo" miran el DISPONIBLE del artículo, no el stock físico: con el
 * físico, DICAMBA (10003) salía "Ok, 20 días de cobertura" teniendo 840 de sus 870 litros vendidos.
 * Al revés, 10004 está agotado pero con 800 en camino, así que no es un quiebre.
 */
const STOCK: StockItem[] = SIN_DERIVAR.map((r) => {
  const disponible = DISPONIBLE_POR_ARTICULO.get(r.codigoArticulo) ?? 0;
  const diasCoberturaDisponible = r.ventaDiaria > 0 ? Math.round(disponible / r.ventaDiaria) : null;
  return {
    ...r,
    diasCoberturaDisponible,
    estado: clasificarEstado(diasCoberturaDisponible),
    bajoMinimo: r.nivelMinimo > 0 && disponible <= r.nivelMinimo,
  };
});

/**
 * Filtros COMPARTIDOS (los del FilterBar): definen el SET BASE. Igual que el backend, los KPIs
 * (`totales`/`porRubro`) se calculan acá, NO sobre el drill-down de la solapa.
 */
function setBase(rows: StockItem[], u: URL): StockItem[] {
  const depositos = u.searchParams.getAll("deposito").map(Number);
  const rubros = u.searchParams.getAll("rubro").map(Number);
  const tipo = u.searchParams.get("tipo") as TipoDeposito | null;
  const q = (u.searchParams.get("q") ?? "").toLowerCase();
  let out = rows;
  if (depositos.length) out = out.filter((r) => depositos.includes(r.deposito));
  if (rubros.length) out = out.filter((r) => rubros.includes(r.rubro));
  if (tipo) out = out.filter((r) => r.tipoDeposito === tipo);
  if (q) out = out.filter((r) => r.nombreProducto.toLowerCase().includes(q) || String(r.codigoArticulo).includes(q));
  if (u.searchParams.get("soloBajoMinimo") === "true") out = out.filter((r) => r.bajoMinimo);
  return out;
}

/** Drill-down de la solapa: afecta `items`/`total`, nunca los totales. */
function drillDown(rows: StockItem[], u: URL): StockItem[] {
  const estado = u.searchParams.get("estado") as EstadoStock | null;
  const estadosVenc = u.searchParams.getAll("estadoVenc") as EstadoVencimiento[];
  let out = rows;
  if (estado) out = out.filter((r) => r.estado === estado);
  if (estadosVenc.length) out = out.filter((r) => estadosVenc.includes(r.estadoVenc));
  return out;
}

/** `proximoVencimiento` asc con nulls al final, desempate por valor desc. */
function porVencimiento(a: StockItem, b: StockItem): number {
  if (a.proximoVencimiento === null || b.proximoVencimiento === null) {
    if (a.proximoVencimiento === b.proximoVencimiento) return b.valorUsd - a.valorUsd;
    return a.proximoVencimiento === null ? 1 : -1;
  }
  const cmp = a.proximoVencimiento.localeCompare(b.proximoVencimiento);
  return cmp !== 0 ? cmp : b.valorUsd - a.valorUsd;
}

function porDeposito(a: StockItem, b: StockItem): number {
  return a.deposito - b.deposito || a.rubro - b.rubro || a.codigoArticulo - b.codigoArticulo;
}

/** Espeja OrdenStock: ausente/inválido → Deposito. */
function ordenar(rows: StockItem[], orden: string | null): StockItem[] {
  switch (orden) {
    case "Vencimiento":
      return [...rows].sort(porVencimiento);
    case "Valor":
      return [...rows].sort((a, b) => b.valorUsd - a.valorUsd);
    default:
      return [...rows].sort(porDeposito);
  }
}

/** Depósito ficticio de las filas consolidadas (espeja DepositoConsolidado del backend). */
const DEPOSITO_CONSOLIDADO = 0;

/** Suma las filas de un artículo en un solo renglón sin depósito. Espeja ConsolidarArticulo. */
function consolidarArticulo(filas: StockItem[]): StockItem {
  const suma = (f: (r: StockItem) => number) => filas.reduce((s, r) => s + f(r), 0);
  const lotes = filas.flatMap((r) => r.lotes);
  const conIngreso = lotes.filter((l) => l.diasEnStock !== null);
  const promedio = antiguedadPromedio(lotes);
  return {
    // Lo no sumable (nombre, rubro, unidad, cobertura, estado) sale de la primera fila: son de nivel
    // artículo. La antigüedad y la rotación NO lo son —salen de los lotes de cada depósito—, así que
    // se recalculan sobre los lotes ya fusionados.
    ...filas[0],
    deposito: DEPOSITO_CONSOLIDADO,
    depositoNombre: "Todos los depósitos",
    tipoDeposito: filas.some((r) => r.tipoDeposito === "Propio") ? "Propio" : "Consignado",
    stockActual: suma((r) => r.stockActual),
    valorUsd: suma((r) => r.valorUsd),
    pedidosCompras: suma((r) => r.pedidosCompras),
    ventaFacturados: suma((r) => r.ventaFacturados),
    ventaSinFacturar: suma((r) => r.ventaSinFacturar),
    totalDisponible: suma((r) => r.totalDisponible),
    unidadesVencidas: suma((r) => r.unidadesVencidas),
    unidadesCriticas: suma((r) => r.unidadesCriticas),
    valorUsdVencido: suma((r) => r.valorUsdVencido),
    estadoVenc: peorEstadoVenc(lotes),
    diasEnStockMax: conIngreso.length ? Math.max(...conIngreso.map((l) => l.diasEnStock as number)) : null,
    diasEnStockPromedio: promedio,
    semaforoRotacion: promedio === null ? "SinDato" : semaforoRotDe(promedio),
    lotes,
  };
}

/** Una fila por artículo sumando todos los depósitos (solapa "Stock global"). */
function consolidar(rows: StockItem[]): StockItem[] {
  const map = new Map<number, StockItem[]>();
  for (const r of rows) map.set(r.codigoArticulo, [...(map.get(r.codigoArticulo) ?? []), r]);
  return [...map.values()]
    .map(consolidarArticulo)
    .sort((a, b) => a.rubro - b.rubro || a.codigoArticulo - b.codigoArticulo);
}

/**
 * El set que se muestra/exporta. Espeja FilasDeLaSolapa: la consolidación va sobre el SET BASE,
 * antes del drill-down y del orden, y los totales se siguen calculando sobre el set sin consolidar.
 */
function filasDeLaSolapa(base: StockItem[], u: URL): StockItem[] {
  const filas = u.searchParams.get("consolidado") === "true" ? consolidar(base) : base;
  return ordenar(drillDown(filas, u), u.searchParams.get("orden"));
}

function totales(rows: StockItem[]) {
  const valorUsdTotal = rows.reduce((s, r) => s + r.valorUsd, 0);
  const valorUsdPropio = rows.filter((r) => r.tipoDeposito === "Propio").reduce((s, r) => s + r.valorUsd, 0);
  const valorUsdConsignado = rows.filter((r) => r.tipoDeposito === "Consignado").reduce((s, r) => s + r.valorUsd, 0);
  const valorUsdInmovilizado = rows.filter((r) => r.estado === "Inmovilizado").reduce((s, r) => s + r.valorUsd, 0);
  // Plata que está en el galpón pero ya tiene dueño: facturado + sin facturar, al precio del artículo.
  const valorUsdComprometido = rows.reduce(
    (s, r) => s + (r.ventaFacturados + r.ventaSinFacturar) * r.precioUsd,
    0,
  );
  const articulos = new Set(rows.map((r) => r.codigoArticulo));
  const riesgo = new Set(rows.filter((r) => r.estado === "RiesgoQuiebre").map((r) => r.codigoArticulo));
  return {
    cantidadArticulos: articulos.size,
    valorUsdTotal,
    valorUsdPropio,
    valorUsdConsignado,
    valorUsdInmovilizado,
    valorUsdComprometido: Math.round(valorUsdComprometido * 100) / 100,
    pctInmovilizado: valorUsdTotal > 0 ? Math.round((valorUsdInmovilizado / valorUsdTotal) * 1000) / 10 : 0,
    cantidadRiesgoQuiebre: riesgo.size,
    cantidadBajoMinimo: new Set(rows.filter((r) => r.bajoMinimo).map((r) => r.codigoArticulo)).size,
    valorUsdVencido: rows.reduce((s, r) => s + r.valorUsdVencido, 0),
    valorUsdPorVencer: rows.reduce((s, r) => s + r.valorUsdVencido + r.unidadesCriticas * r.precioUsd, 0),
    cantidadPorVencer: new Set(
      rows.filter((r) => r.estadoVenc === "Vencido" || r.estadoVenc === "Critico").map((r) => r.codigoArticulo),
    ).size,
    antiguedadPromedioDias: antiguedadPromedio(rows.flatMap((r) => r.lotes)),
  };
}

function porRubro(rows: StockItem[]) {
  const map = new Map<number, { rubro: number; rubroDesc: string; valorUsd: number }>();
  for (const r of rows) {
    const g = map.get(r.rubro) ?? { rubro: r.rubro, rubroDesc: r.rubroDesc, valorUsd: 0 };
    g.valorUsd += r.valorUsd;
    map.set(r.rubro, g);
  }
  return [...map.values()].sort((a, b) => b.valorUsd - a.valorUsd);
}

export const stockHandlers = [
  http.get(`${API}/stock`, ({ request }) => {
    const u = new URL(request.url);
    const page = Number(u.searchParams.get("page") ?? "1");
    const pageSize = Number(u.searchParams.get("pageSize") ?? "50");
    const base = setBase(STOCK, u);
    const rows = filasDeLaSolapa(base, u);
    const total = rows.length;
    const totalPages = pageSize <= 0 ? 0 : Math.ceil(total / pageSize);
    const items = rows.slice((page - 1) * pageSize, page * pageSize);
    return HttpResponse.json({
      items, total, page, pageSize, totalPages,
      hasNext: page < totalPages, hasPrevious: page > 1,
      // Totales/porRubro sobre el SET BASE: los KPIs no cambian al cambiar de solapa.
      totales: totales(base), porRubro: porRubro(base),
    });
  }),

  http.get(`${API}/stock/filtros`, () => {
    // Los 8 depósitos del catálogo siempre, aunque alguno tenga 0 stock.
    const depositos = [...CATALOGO].sort((a, b) => a.codigo - b.codigo);
    const rubrosMap = new Map<number, { rubro: number; rubroDesc: string; valorUsd: number }>();
    for (const r of STOCK) rubrosMap.set(r.rubro, { rubro: r.rubro, rubroDesc: r.rubroDesc, valorUsd: 0 });
    const rubros = [...rubrosMap.values()].sort((a, b) => a.rubro - b.rubro);
    return HttpResponse.json({ depositos, rubros });
  }),

  // Export .xlsx (demo): el backend real arma el Excel jerárquico; acá generamos un .xlsx plano válido.
  // Respeta la solapa activa (drill-down + orden), igual que el backend.
  http.get(`${API}/stock/export`, async ({ request }) => {
    const u = new URL(request.url);
    const rows = filasDeLaSolapa(setBase(STOCK, u), u);
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const FMT = '#,##0.00;(#,##0.00);"-"';
    const num = (value: number) => ({ type: Number, value, format: FMT });
    const blob = await writeXlsxFile(rows, {
      sheet: "Stock Insumos",
      columns: [
        { header: "Depósito", width: 10, cell: (r: StockItem) => ({ type: Number, value: r.deposito }) },
        { header: "Código", width: 10, cell: (r: StockItem) => ({ type: Number, value: r.codigoArticulo }) },
        { header: "Producto", width: 38, cell: (r: StockItem) => ({ type: String, value: r.nombreProducto }) },
        { header: "Rubro", width: 18, cell: (r: StockItem) => ({ type: String, value: r.rubroDesc }) },
        { header: "Unidad", width: 8, cell: (r: StockItem) => ({ type: String, value: r.unidad }) },
        { header: "Stock", width: 12, cell: (r: StockItem) => num(r.stockActual) },
        { header: "Por llegar", width: 12, cell: (r: StockItem) => num(r.pedidosCompras) },
        { header: "Facturado", width: 12, cell: (r: StockItem) => num(r.ventaFacturados) },
        { header: "Sin facturar", width: 12, cell: (r: StockItem) => num(r.ventaSinFacturar) },
        { header: "Disponible", width: 12, cell: (r: StockItem) => num(r.totalDisponible) },
        { header: "Valor USD", width: 14, cell: (r: StockItem) => num(r.valorUsd) },
        // La cobertura del DISPONIBLE, que es la que muestra la tabla y con la que se clasifica el Estado.
        { header: "Días cob.", width: 10, cell: (r: StockItem) => ({ type: Number, value: r.diasCoberturaDisponible ?? undefined }) },
        { header: "Estado", width: 16, cell: (r: StockItem) => ({ type: String, value: r.estado }) },
      ],
    }).toBlob();
    return new HttpResponse(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Stock_Insumos_demo.xlsx"',
      },
    });
  }),
];
