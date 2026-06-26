import { http, HttpResponse } from "msw";
import type { StockItem } from "@/features/stock/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

// Stock ficticio (NUNCA datos reales). Cobertura/estado precalculados para el demo.
const STOCK: StockItem[] = [
  { deposito: 0, codigoArticulo: 10001, nombreProducto: "GLIFOSATO 48% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 1200, precioUsd: 4.5, valorUsd: 5400, ventaDiaria: 12.3, diasCobertura: 97, estado: "Ok" },
  { deposito: 0, codigoArticulo: 10002, nombreProducto: "ATRAZINA 50% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 80, precioUsd: 6.2, valorUsd: 496, ventaDiaria: 9.0, diasCobertura: 9, estado: "RiesgoQuiebre" },
  { deposito: 0, codigoArticulo: 10010, nombreProducto: "CIPERMETRINA 25% X 5L", rubro: 201, rubroDesc: "INSECTICIDAS", unidad: "LT", stockActual: 300, precioUsd: 8.0, valorUsd: 2400, ventaDiaria: 0, diasCobertura: null, estado: "Inmovilizado" },
  { deposito: 0, codigoArticulo: 10020, nombreProducto: "FOSFATO DIAMONICO X 50KG", rubro: 207, rubroDesc: "FERTILIZANTES", unidad: "KG", stockActual: 25000, precioUsd: 0.85, valorUsd: 21250, ventaDiaria: 140, diasCobertura: 178, estado: "Ok" },
  { deposito: 5, codigoArticulo: 10001, nombreProducto: "GLIFOSATO 48% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 400, precioUsd: 4.5, valorUsd: 1800, ventaDiaria: 12.3, diasCobertura: 97, estado: "Ok" },
  { deposito: 5, codigoArticulo: 10030, nombreProducto: "2,4-D 100% X 20L", rubro: 200, rubroDesc: "HERBICIDAS", unidad: "LT", stockActual: 60, precioUsd: 5.5, valorUsd: 330, ventaDiaria: 6.0, diasCobertura: 10, estado: "RiesgoQuiebre" },
  { deposito: 5, codigoArticulo: 10040, nombreProducto: "UREA GRANULADA X 50KG", rubro: 207, rubroDesc: "FERTILIZANTES", unidad: "KG", stockActual: 60000, precioUsd: 0.6, valorUsd: 36000, ventaDiaria: 0, diasCobertura: null, estado: "Inmovilizado" },
  { deposito: 12, codigoArticulo: 10050, nombreProducto: "FUNGICIDA TRIAZOL X 5L", rubro: 202, rubroDesc: "FUNGICIDAS", unidad: "LT", stockActual: 150, precioUsd: 14.0, valorUsd: 2100, ventaDiaria: 3.0, diasCobertura: 50, estado: "Ok" },
];

function aplicarFiltros(rows: StockItem[], u: URL): StockItem[] {
  const depositos = u.searchParams.getAll("deposito").map(Number);
  const rubros = u.searchParams.getAll("rubro").map(Number);
  const q = (u.searchParams.get("q") ?? "").toLowerCase();
  let out = rows;
  if (depositos.length) out = out.filter((r) => depositos.includes(r.deposito));
  if (rubros.length) out = out.filter((r) => rubros.includes(r.rubro));
  if (q) out = out.filter((r) => r.nombreProducto.toLowerCase().includes(q) || String(r.codigoArticulo).includes(q));
  return out;
}

function totales(rows: StockItem[]) {
  const valorUsdTotal = rows.reduce((s, r) => s + r.valorUsd, 0);
  const valorUsdInmovilizado = rows.filter((r) => r.estado === "Inmovilizado").reduce((s, r) => s + r.valorUsd, 0);
  const articulos = new Set(rows.map((r) => r.codigoArticulo));
  const riesgo = new Set(rows.filter((r) => r.estado === "RiesgoQuiebre").map((r) => r.codigoArticulo));
  return {
    cantidadArticulos: articulos.size,
    valorUsdTotal,
    valorUsdInmovilizado,
    pctInmovilizado: valorUsdTotal > 0 ? Math.round((valorUsdInmovilizado / valorUsdTotal) * 1000) / 10 : 0,
    cantidadRiesgoQuiebre: riesgo.size,
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
    const rows = aplicarFiltros(STOCK, u);
    const total = rows.length;
    const totalPages = pageSize <= 0 ? 0 : Math.ceil(total / pageSize);
    const items = rows.slice((page - 1) * pageSize, page * pageSize);
    return HttpResponse.json({
      items, total, page, pageSize, totalPages,
      hasNext: page < totalPages, hasPrevious: page > 1,
      totales: totales(rows), porRubro: porRubro(rows),
    });
  }),

  http.get(`${API}/stock/filtros`, () => {
    const depositos = [...new Set(STOCK.map((r) => r.deposito))].sort((a, b) => a - b);
    const rubrosMap = new Map<number, { rubro: number; rubroDesc: string; valorUsd: number }>();
    for (const r of STOCK) rubrosMap.set(r.rubro, { rubro: r.rubro, rubroDesc: r.rubroDesc, valorUsd: 0 });
    const rubros = [...rubrosMap.values()].sort((a, b) => a.rubro - b.rubro);
    return HttpResponse.json({ depositos, rubros });
  }),

  // Export .xlsx (demo): el backend real arma el Excel jerárquico; acá generamos un .xlsx plano válido.
  http.get(`${API}/stock/export`, async ({ request }) => {
    const rows = aplicarFiltros(STOCK, new URL(request.url));
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
