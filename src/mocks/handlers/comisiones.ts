import { http, HttpResponse } from "msw";
import type {
  ComisionDetalleDto,
  ComisionGeneracionDto,
  ComisionResumenDto,
} from "@/features/comisiones/types";
import { env } from "@/lib/env";
import type { PagedResult } from "@/shared/types/paged";

const API = env.apiUrl;

// Vendedores ficticios (mismos códigos/nombres del mock de Cuentas Corrientes: es el mismo
// catálogo de "vendedor" de MacroGest).
const VENDEDORES: Record<number, string> = { 1: "LC AGRO", 2: "PAMPA SUR", 3: "CENTRO GRANOS" };

interface Venta {
  anio: number;
  mes: number;
  dia: number;
  comprobante: string;
  codigoCliente: number;
  razonSocial: string;
  cuit: string;
  codigoArticulo: number;
  producto: string;
  rubro: number;
  vendedorNro: number; // 0 = sin vendedor
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  porcentajeComision: number;
  origenPorcentaje: "articulo" | "rubro" | "base" | "sin_tasa";
  alertaMontoFijo?: boolean;
}

// Ventas ficticias (NUNCA datos reales), en dos períodos: el mes corriente (sin generar) y el
// anterior (ya generado, para poder ver el badge "Mes congelado" y el flujo de conflicto/forzar).
const VENTAS: Venta[] = [
  // Julio 2026 (mes corriente, sin generar)
  { anio: 2026, mes: 7, dia: 2, comprobante: "FAC A 0007-0038401", codigoCliente: 1024, razonSocial: "Estancia La Esperanza S.A.", cuit: "30-71234567-8", codigoArticulo: 10001, producto: "GLIFOSATO 48% X 20L", rubro: 200, vendedorNro: 1, cantidad: 40, precioUnitario: 90, costoUnitario: 70, porcentajeComision: 2, origenPorcentaje: "articulo" },
  { anio: 2026, mes: 7, dia: 3, comprobante: "FAC A 0007-0038409", codigoCliente: 2011, razonSocial: "Cabaña Los Aromos", cuit: "30-70987654-1", codigoArticulo: 10020, producto: "FOSFATO DIAMONICO X 50KG", rubro: 207, vendedorNro: 2, cantidad: 200, precioUnitario: 45, costoUnitario: 38, porcentajeComision: 1.5, origenPorcentaje: "rubro" },
  { anio: 2026, mes: 7, dia: 4, comprobante: "FAC A 0007-0038415", codigoCliente: 3002, razonSocial: "El Amanecer S.A.", cuit: "30-70112233-5", codigoArticulo: 10010, producto: "CIPERMETRINA 25% X 5L", rubro: 201, vendedorNro: 3, cantidad: 15, precioUnitario: 60, costoUnitario: 65, porcentajeComision: 2, origenPorcentaje: "articulo" }, // margen negativo
  { anio: 2026, mes: 7, dia: 4, comprobante: "FAC A 0007-0038418", codigoCliente: 1057, razonSocial: "Agropecuaria El Trébol SRL", cuit: "30-71122334-9", codigoArticulo: 10030, producto: "2,4-D 100% X 20L", rubro: 200, vendedorNro: 1, cantidad: 25, precioUnitario: 55, costoUnitario: 0, porcentajeComision: 2, origenPorcentaje: "articulo" }, // costo cero
  { anio: 2026, mes: 7, dia: 5, comprobante: "FAC A 0007-0038422", codigoCliente: 2044, razonSocial: "Siembras del Oeste S.A.", cuit: "30-70998877-2", codigoArticulo: 10050, producto: "FUNGICIDA TRIAZOL X 5L", rubro: 202, vendedorNro: 2, cantidad: 10, precioUnitario: 140, costoUnitario: 95, porcentajeComision: 0, origenPorcentaje: "sin_tasa" }, // comisión cero
  { anio: 2026, mes: 7, dia: 6, comprobante: "FAC A 0007-0038430", codigoCliente: 3015, razonSocial: "Campos del Norte SRL", cuit: "30-70556677-4", codigoArticulo: 10091, producto: "SEMILLA BAYER MAIZ X BOLSA", rubro: 207, vendedorNro: 3, cantidad: 60, precioUnitario: 120, costoUnitario: 90, porcentajeComision: 3, origenPorcentaje: "base", alertaMontoFijo: true },
  { anio: 2026, mes: 7, dia: 7, comprobante: "FAC A 0007-0038437", codigoCliente: 2078, razonSocial: "La Carmela Agropecuaria", cuit: "30-70334455-6", codigoArticulo: 10001, producto: "GLIFOSATO 48% X 20L", rubro: 200, vendedorNro: 0, cantidad: 20, precioUnitario: 90, costoUnitario: 70, porcentajeComision: 2, origenPorcentaje: "sin_tasa" }, // sin vendedor
  { anio: 2026, mes: 7, dia: 8, comprobante: "FAC A 0007-0038442", codigoCliente: 1090, razonSocial: "Don Ramón e Hijos", cuit: "30-71445566-3", codigoArticulo: 10070, producto: "INSECTICIDA ADAMA X 5L", rubro: 201, vendedorNro: 1, cantidad: 30, precioUnitario: 95, costoUnitario: 60, porcentajeComision: 2.5, origenPorcentaje: "articulo" },
  // Junio 2026 (mes anterior, ya generado)
  { anio: 2026, mes: 6, dia: 12, comprobante: "FAC A 0007-0038210", codigoCliente: 1024, razonSocial: "Estancia La Esperanza S.A.", cuit: "30-71234567-8", codigoArticulo: 10001, producto: "GLIFOSATO 48% X 20L", rubro: 200, vendedorNro: 1, cantidad: 35, precioUnitario: 88, costoUnitario: 68, porcentajeComision: 2, origenPorcentaje: "articulo" },
  { anio: 2026, mes: 6, dia: 18, comprobante: "FAC A 0007-0038255", codigoCliente: 2011, razonSocial: "Cabaña Los Aromos", cuit: "30-70987654-1", codigoArticulo: 10040, producto: "UREA GRANULADA X 50KG", rubro: 207, vendedorNro: 2, cantidad: 300, precioUnitario: 40, costoUnitario: 30, porcentajeComision: 1.5, origenPorcentaje: "rubro" },
  { anio: 2026, mes: 6, dia: 22, comprobante: "FAC A 0007-0038270", codigoCliente: 3033, razonSocial: "Agro Don Pedro", cuit: "30-70223344-7", codigoArticulo: 10080, producto: "HERBICIDA SIGMA X 20L", rubro: 200, vendedorNro: 3, cantidad: 18, precioUnitario: 75, costoUnitario: 55, porcentajeComision: 2, origenPorcentaje: "articulo" },
];

function calcularFila(v: Venta): ComisionDetalleDto {
  const factNeta = Math.round(v.cantidad * v.precioUnitario * 100) / 100;
  const rentabilidad = Math.round((v.precioUnitario - v.costoUnitario) * v.cantidad * 100) / 100;
  const margenBrutoPct = factNeta !== 0 ? Math.round((rentabilidad / factNeta) * 1000) / 10 : null;
  const comision = Math.round(factNeta * (v.porcentajeComision / 100) * 100) / 100;
  const sinVendedor = v.vendedorNro === 0;
  return {
    fecha: new Date(v.anio, v.mes - 1, v.dia).toISOString().slice(0, 10),
    comprobante: v.comprobante,
    codigoCliente: v.codigoCliente,
    razonSocial: v.razonSocial,
    cuit: v.cuit,
    codigoArticulo: v.codigoArticulo,
    producto: v.producto,
    rubro: v.rubro,
    vendedorNro: v.vendedorNro,
    vendedor: sinVendedor ? "Sin vendedor" : (VENDEDORES[v.vendedorNro] ?? `Vendedor ${v.vendedorNro}`),
    cantidad: v.cantidad,
    precioUnitario: v.precioUnitario,
    costoUnitario: v.costoUnitario,
    factNeta,
    rentabilidad,
    margenBrutoPct,
    porcentajeComision: v.porcentajeComision,
    origenPorcentaje: v.origenPorcentaje,
    comision,
    alertaMargenNegativo: rentabilidad < 0,
    alertaCostoCero: v.costoUnitario === 0,
    alertaComisionCero: v.porcentajeComision === 0,
    alertaMontoFijo: v.alertaMontoFijo ?? false,
    sinVendedor,
  };
}

const FILAS: ComisionDetalleDto[] = VENTAS.map(calcularFila);

// Estado en memoria de los períodos ya "generados" (congelados). Junio 2026 arranca generado para
// poder ver el badge y el flujo de conflicto (409) al reintentar sin `forzar`.
const GENERADOS = new Map<string, { fechaGeneracion: string; vendedoresCongelados: number }>();
GENERADOS.set("2026-6", { fechaGeneracion: new Date(2026, 6, 1, 9, 0).toISOString(), vendedoresCongelados: 3 });

function claveDePeriodo(anio: number, mes: number): string {
  return `${anio}-${mes}`;
}

function filasDelPeriodo(anio: number, mes: number): ComisionDetalleDto[] {
  return FILAS.filter((f) => {
    const [y, m] = f.fecha.split("-").map(Number);
    return y === anio && m === mes;
  });
}

function aplicarFiltros(rows: ComisionDetalleDto[], u: URL): ComisionDetalleDto[] {
  const vendNroParam = u.searchParams.get("vendNro");
  const vendNro = vendNroParam ? Number(vendNroParam) : null;
  const q = (u.searchParams.get("q") ?? "").toLowerCase();
  let out = rows;
  if (vendNro !== null) out = out.filter((r) => r.vendedorNro === vendNro);
  if (q) {
    out = out.filter(
      (r) =>
        (r.razonSocial ?? "").toLowerCase().includes(q) ||
        r.producto.toLowerCase().includes(q) ||
        r.comprobante.toLowerCase().includes(q),
    );
  }
  return out;
}

function calcularResumen(anio: number, mes: number, vendNroFiltro: number | null): ComisionResumenDto {
  const rows = filasDelPeriodo(anio, mes);
  const conVendedor = rows.filter((r) => !r.sinVendedor);
  const sinVend = rows.filter((r) => r.sinVendedor);

  const porVend = new Map<
    number,
    { vendedorNro: number; vendedor: string; factNeta: number; rentabilidad: number; comision: number; cantComprobantes: number }
  >();
  for (const r of conVendedor) {
    if (vendNroFiltro !== null && r.vendedorNro !== vendNroFiltro) continue;
    const g = porVend.get(r.vendedorNro) ?? {
      vendedorNro: r.vendedorNro,
      vendedor: r.vendedor,
      factNeta: 0,
      rentabilidad: 0,
      comision: 0,
      cantComprobantes: 0,
    };
    g.factNeta += r.factNeta;
    g.rentabilidad += r.rentabilidad;
    g.comision += r.comision;
    g.cantComprobantes += 1;
    porVend.set(r.vendedorNro, g);
  }
  const vendedores = [...porVend.values()].map((g) => ({
    ...g,
    margenBrutoPct: g.factNeta !== 0 ? Math.round((g.rentabilidad / g.factNeta) * 1000) / 10 : null,
  }));

  const totalRows = vendNroFiltro !== null ? rows.filter((r) => r.vendedorNro === vendNroFiltro) : rows;
  const totalFactNeta = totalRows.reduce((s, r) => s + r.factNeta, 0);
  const totalRentabilidad = totalRows.reduce((s, r) => s + r.rentabilidad, 0);
  const totalComision = totalRows.reduce((s, r) => s + r.comision, 0);

  const generacion = GENERADOS.get(claveDePeriodo(anio, mes)) ?? null;

  return {
    generado: generacion !== null,
    fechaGeneracion: generacion?.fechaGeneracion ?? null,
    vendedores,
    totalFactNeta,
    totalRentabilidad,
    totalMargenBrutoPct: totalFactNeta !== 0 ? Math.round((totalRentabilidad / totalFactNeta) * 1000) / 10 : null,
    totalComision,
    totalComprobantes: totalRows.length,
    sinVendedorFactNeta: sinVend.reduce((s, r) => s + r.factNeta, 0),
    sinVendedorComprobantes: sinVend.length,
  };
}

export const comisionesHandlers = [
  http.get(`${API}/comisiones`, ({ request }) => {
    const u = new URL(request.url);
    const anio = Number(u.searchParams.get("anio"));
    const mes = Number(u.searchParams.get("mes"));
    const page = Number(u.searchParams.get("page") ?? "1");
    const pageSize = Number(u.searchParams.get("pageSize") ?? "100");

    const rows = aplicarFiltros(filasDelPeriodo(anio, mes), u);
    const total = rows.length;
    const totalPages = pageSize <= 0 ? 0 : Math.ceil(total / pageSize);
    const items = rows.slice((page - 1) * pageSize, page * pageSize);

    const body: PagedResult<ComisionDetalleDto> = {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
    return HttpResponse.json(body);
  }),

  http.get(`${API}/comisiones/resumen`, ({ request }) => {
    const u = new URL(request.url);
    const anio = Number(u.searchParams.get("anio"));
    const mes = Number(u.searchParams.get("mes"));
    const vendNroParam = u.searchParams.get("vendNro");
    const vendNro = vendNroParam ? Number(vendNroParam) : null;
    return HttpResponse.json(calcularResumen(anio, mes, vendNro));
  }),

  // Generar (congelar) el % de comisión del período: 409 si ya estaba generado y no se manda forzar.
  http.post(`${API}/comisiones/generar`, async ({ request }) => {
    const body = (await request.json()) as { anio: number; mes: number; forzar?: boolean };
    const clave = claveDePeriodo(body.anio, body.mes);
    const yaGenerado = GENERADOS.has(clave);

    if (yaGenerado && !body.forzar) {
      return HttpResponse.json(
        {
          title: "Conflicto",
          status: 409,
          detail: `El período ${body.mes}/${body.anio} ya fue generado. Usá "Regenerar" para forzarlo.`,
        },
        { status: 409 },
      );
    }

    const vendedoresCongelados = new Set(
      filasDelPeriodo(body.anio, body.mes)
        .filter((r) => !r.sinVendedor)
        .map((r) => r.vendedorNro),
    ).size;
    const fechaGeneracion = new Date().toISOString();
    GENERADOS.set(clave, { fechaGeneracion, vendedoresCongelados });

    const dto: ComisionGeneracionDto = { anio: body.anio, mes: body.mes, fechaGeneracion, vendedoresCongelados };
    return HttpResponse.json(dto);
  }),

  // Export .xlsx (demo): el backend real arma el Excel oficial; acá generamos uno válido con los
  // mismos filtros para que la descarga funcione sin backend.
  http.get(`${API}/comisiones/export`, async ({ request }) => {
    const u = new URL(request.url);
    const anio = Number(u.searchParams.get("anio"));
    const mes = Number(u.searchParams.get("mes"));
    const rows = aplicarFiltros(filasDelPeriodo(anio, mes), u);
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const FMT = '#,##0.00;(#,##0.00);"-"';
    const num = (value: number) => ({ type: Number, value, format: FMT });
    const blob = await writeXlsxFile(rows, {
      sheet: "Comisiones",
      columns: [
        { header: "Fecha", width: 12, cell: (r: ComisionDetalleDto) => ({ type: String, value: r.fecha }) },
        { header: "Comprobante", width: 20, cell: (r: ComisionDetalleDto) => ({ type: String, value: r.comprobante }) },
        { header: "Cliente", width: 34, cell: (r: ComisionDetalleDto) => ({ type: String, value: r.razonSocial ?? undefined }) },
        { header: "Producto", width: 30, cell: (r: ComisionDetalleDto) => ({ type: String, value: r.producto }) },
        { header: "Vendedor", width: 16, cell: (r: ComisionDetalleDto) => ({ type: String, value: r.vendedor }) },
        { header: "Cantidad", width: 10, cell: (r: ComisionDetalleDto) => num(r.cantidad) },
        { header: "FactNeta (USD)", width: 14, cell: (r: ComisionDetalleDto) => num(r.factNeta) },
        { header: "Rentabilidad (USD)", width: 14, cell: (r: ComisionDetalleDto) => num(r.rentabilidad) },
        { header: "% Comisión", width: 12, cell: (r: ComisionDetalleDto) => num(r.porcentajeComision) },
        { header: "Comisión (USD)", width: 14, cell: (r: ComisionDetalleDto) => num(r.comision) },
      ],
    }).toBlob();

    const mm = String(mes).padStart(2, "0");
    return new HttpResponse(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="COMISIONES_VENDEDORES_${mm}_${anio}.xlsx"`,
      },
    });
  }),
];
