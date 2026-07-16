import { http, HttpResponse } from "msw";
import type { DepositoFiltro, EstadoStock, EstadoVencimiento, SemaforoRotacion, StockItem, StockLote, TipoDeposito } from "@/features/stock/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

// Catálogo de depósitos (los 8 reales que el backend whitelistea). Espeja DepositoCatalogo.
const CATALOGO: DepositoFiltro[] = [
  { codigo: 0, nombre: "San Jorge", tipo: "Propio" },
  { codigo: 2, nombre: "Semillero", tipo: "Propio" },
  { codigo: 3, nombre: "Las Piur", tipo: "Propio" },
  { codigo: 5, nombre: "San Francisco", tipo: "Propio" },
  { codigo: 44, nombre: "Adama", tipo: "Consignado" },
  { codigo: 45, nombre: "Sigma", tipo: "Consignado" },
  { codigo: 55, nombre: "Bayer", tipo: "Consignado" },
  { codigo: 56, nombre: "Bayer", tipo: "Consignado" },
];

// Stock ficticio (NUNCA datos reales). Cobertura/estado precalculados para el demo.
const BASE: Omit<
  StockItem,
  | "nivelMinimo" | "bajoMinimo"
  | "estadoVenc" | "proximoVencimiento" | "unidadesVencidas" | "unidadesCriticas" | "valorUsdVencido"
  | "diasEnStockMax" | "diasEnStockPromedio" | "semaforoRotacion" | "lotes"
>[] = [
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10001, nombreProducto: "GLIFOSATO 48% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 1200, precioUsd: 4.5, valorUsd: 5400, ventaDiaria: 12.3, diasCobertura: 97, estado: "Ok" },
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10002, nombreProducto: "ATRAZINA 50% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 80, precioUsd: 6.2, valorUsd: 496, ventaDiaria: 9.0, diasCobertura: 9, estado: "RiesgoQuiebre" },
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10010, nombreProducto: "CIPERMETRINA 25% X 5L", rubro: 201, rubroDesc: "INSECTICIDAS", unidad: "LT", stockActual: 300, precioUsd: 8.0, valorUsd: 2400, ventaDiaria: 0, diasCobertura: null, estado: "Inmovilizado" },
  { deposito: 0, depositoNombre: "San Jorge", tipoDeposito: "Propio", codigoArticulo: 10020, nombreProducto: "FOSFATO DIAMONICO X 50KG", rubro: 207, rubroDesc: "FERTILIZANTES", unidad: "KG", stockActual: 25000, precioUsd: 0.85, valorUsd: 21250, ventaDiaria: 140, diasCobertura: 178, estado: "Ok" },
  { deposito: 5, depositoNombre: "San Francisco", tipoDeposito: "Propio", codigoArticulo: 10001, nombreProducto: "GLIFOSATO 48% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 400, precioUsd: 4.5, valorUsd: 1800, ventaDiaria: 12.3, diasCobertura: 97, estado: "Ok" },
  { deposito: 5, depositoNombre: "San Francisco", tipoDeposito: "Propio", codigoArticulo: 10030, nombreProducto: "2,4-D 100% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 60, precioUsd: 5.5, valorUsd: 330, ventaDiaria: 6.0, diasCobertura: 10, estado: "RiesgoQuiebre" },
  { deposito: 5, depositoNombre: "San Francisco", tipoDeposito: "Propio", codigoArticulo: 10040, nombreProducto: "UREA GRANULADA X 50KG", rubro: 207, rubroDesc: "FERTILIZANTES", unidad: "KG", stockActual: 60000, precioUsd: 0.6, valorUsd: 36000, ventaDiaria: 0, diasCobertura: null, estado: "Inmovilizado" },
  { deposito: 2, depositoNombre: "Semillero", tipoDeposito: "Propio", codigoArticulo: 10060, nombreProducto: "CURASEMILLA X 5L", rubro: 203, rubroDesc: "CURASEMILLAS", unidad: "LT", stockActual: 220, precioUsd: 11.0, valorUsd: 2420, ventaDiaria: 4.0, diasCobertura: 55, estado: "Ok" },
  { deposito: 3, depositoNombre: "Las Piur", tipoDeposito: "Propio", codigoArticulo: 10050, nombreProducto: "FUNGICIDA TRIAZOL X 5L", rubro: 202, rubroDesc: "FUNGICIDAS", unidad: "LT", stockActual: 150, precioUsd: 14.0, valorUsd: 2100, ventaDiaria: 3.0, diasCobertura: 50, estado: "Ok" },
  { deposito: 44, depositoNombre: "Adama", tipoDeposito: "Consignado", codigoArticulo: 10070, nombreProducto: "INSECTICIDA ADAMA X 5L", rubro: 201, rubroDesc: "INSECTICIDAS", unidad: "LT", stockActual: 500, precioUsd: 9.5, valorUsd: 4750, ventaDiaria: 8.0, diasCobertura: 62, estado: "Ok" },
  { deposito: 45, depositoNombre: "Sigma", tipoDeposito: "Consignado", codigoArticulo: 10080, nombreProducto: "HERBICIDA SIGMA X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 90, precioUsd: 7.0, valorUsd: 630, ventaDiaria: 9.0, diasCobertura: 10, estado: "RiesgoQuiebre" },
  { deposito: 55, depositoNombre: "Bayer", tipoDeposito: "Consignado", codigoArticulo: 10090, nombreProducto: "FUNGICIDA BAYER X 5L", rubro: 202, rubroDesc: "FUNGICIDAS", unidad: "LT", stockActual: 700, precioUsd: 16.0, valorUsd: 11200, ventaDiaria: 0, diasCobertura: null, estado: "Inmovilizado" },
  { deposito: 56, depositoNombre: "Bayer", tipoDeposito: "Consignado", codigoArticulo: 10091, nombreProducto: "SEMILLA BAYER MAIZ X BOLSA", rubro: 207, rubroDesc: "FERTILIZANTES", unidad: "KG", stockActual: 3000, precioUsd: 2.0, valorUsd: 6000, ventaDiaria: 20, diasCobertura: 150, estado: "Ok" },
];

// Mínimos de demo (espeja articulo.nivel_minimo). Los que tienen stock por debajo quedan "bajo mínimo".
const MINIMOS: Record<number, number> = { 10002: 100, 10030: 100, 10080: 100 };
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

const STOCK: StockItem[] = BASE.map((r) => {
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
  return {
    ...r,
    nivelMinimo,
    bajoMinimo: nivelMinimo > 0 && r.stockActual <= nivelMinimo,
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

/** El set que se pagina/exporta: base + drill-down + orden. */
function setVisible(u: URL): StockItem[] {
  return ordenar(drillDown(setBase(STOCK, u), u), u.searchParams.get("orden"));
}

function totales(rows: StockItem[]) {
  const valorUsdTotal = rows.reduce((s, r) => s + r.valorUsd, 0);
  const valorUsdPropio = rows.filter((r) => r.tipoDeposito === "Propio").reduce((s, r) => s + r.valorUsd, 0);
  const valorUsdConsignado = rows.filter((r) => r.tipoDeposito === "Consignado").reduce((s, r) => s + r.valorUsd, 0);
  const valorUsdInmovilizado = rows.filter((r) => r.estado === "Inmovilizado").reduce((s, r) => s + r.valorUsd, 0);
  const articulos = new Set(rows.map((r) => r.codigoArticulo));
  const riesgo = new Set(rows.filter((r) => r.estado === "RiesgoQuiebre").map((r) => r.codigoArticulo));
  return {
    cantidadArticulos: articulos.size,
    valorUsdTotal,
    valorUsdPropio,
    valorUsdConsignado,
    valorUsdInmovilizado,
    pctInmovilizado: valorUsdTotal > 0 ? Math.round((valorUsdInmovilizado / valorUsdTotal) * 1000) / 10 : 0,
    cantidadRiesgoQuiebre: riesgo.size,
    cantidadBajoMinimo: new Set(rows.filter((r) => r.bajoMinimo).map((r) => r.codigoArticulo)).size,
    valorUsdVencido: rows.reduce((s, r) => s + r.valorUsdVencido, 0),
    valorUsdPorVencer: rows.reduce((s, r) => s + r.valorUsdVencido + r.unidadesCriticas * r.precioUsd, 0),
    cantidadPorVencer: new Set(
      rows.filter((r) => r.estadoVenc === "Vencido" || r.estadoVenc === "Critico").map((r) => r.codigoArticulo),
    ).size,
    antiguedadPromedioDias: (() => {
      const ls = rows.flatMap((r) => r.lotes).filter((l) => l.diasEnStock !== null);
      if (!ls.length) return null;
      const peso = ls.reduce((s, l) => s + l.stockActual, 0);
      return peso > 0
        ? Math.round(ls.reduce((s, l) => s + (l.diasEnStock as number) * l.stockActual, 0) / peso)
        : null;
    })(),
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
    const rows = ordenar(drillDown(base, u), u.searchParams.get("orden"));
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
    const rows = setVisible(new URL(request.url));
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
        { header: "Valor USD", width: 14, cell: (r: StockItem) => num(r.valorUsd) },
        { header: "Días cob.", width: 10, cell: (r: StockItem) => ({ type: Number, value: r.diasCobertura ?? undefined }) },
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
