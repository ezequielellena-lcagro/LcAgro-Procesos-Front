import { http, HttpResponse } from "msw";
import { ORDEN_CONTADO } from "@/features/cuentas/estado-contado";
import type { CuentaDto, EstadoContado, FacturaContado } from "@/features/cuentas/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

type CuentaBase = Omit<CuentaDto, "devolucion" | "observaciones" | "estadoContado">;

// Observaciones en memoria (upsert por cuenta) para el demo.
const OBS: Record<number, { devolucion: string | null; observaciones: string | null }> = {};

// Emails de vendedores: "nuestros" (editables, en memoria) y los que vendrían de MacroGest (solo algunos).
const CONTACTOS: Record<number, string> = {};
const EMAIL_MACROGEST: Record<number, string> = { 1: "lcagro@demo.com" };

// Cuentas ficticias (NUNCA PII real). vendedor de ejemplo.
const CUENTAS: CuentaBase[] = [
  { vendedor: "LC AGRO", vendNro: 1, cuenta: 1024, denominacion: "Estancia La Esperanza S.A.", saldoVencido: 18450.5, saldoAVencer: 5200, saldo: 23650.5 },
  { vendedor: "LC AGRO", vendNro: 1, cuenta: 1057, denominacion: "Agropecuaria El Trébol SRL", saldoVencido: 0, saldoAVencer: 9800, saldo: 9800 },
  { vendedor: "LC AGRO", vendNro: 1, cuenta: 1090, denominacion: "Don Ramón e Hijos", saldoVencido: 3120.75, saldoAVencer: 0, saldo: 3120.75 },
  { vendedor: "PAMPA SUR", vendNro: 2, cuenta: 2011, denominacion: "Cabaña Los Aromos", saldoVencido: 42300, saldoAVencer: 12750.25, saldo: 55050.25 },
  { vendedor: "PAMPA SUR", vendNro: 2, cuenta: 2044, denominacion: "Siembras del Oeste S.A.", saldoVencido: 980, saldoAVencer: 0, saldo: 980 },
  { vendedor: "PAMPA SUR", vendNro: 2, cuenta: 2078, denominacion: "La Carmela Agropecuaria", saldoVencido: 0, saldoAVencer: 6400, saldo: 6400 },
  { vendedor: "PAMPA SUR", vendNro: 2, cuenta: 2099, denominacion: "Hnos. Gutiérrez SRL", saldoVencido: 15600.4, saldoAVencer: 3100, saldo: 18700.4 },
  { vendedor: "CENTRO GRANOS", vendNro: 3, cuenta: 3002, denominacion: "El Amanecer S.A.", saldoVencido: 7250, saldoAVencer: 0, saldo: 7250 },
  { vendedor: "CENTRO GRANOS", vendNro: 3, cuenta: 3015, denominacion: "Campos del Norte SRL", saldoVencido: 0, saldoAVencer: 21000, saldo: 21000 },
  { vendedor: "CENTRO GRANOS", vendNro: 3, cuenta: 3033, denominacion: "Agro Don Pedro", saldoVencido: 2890.9, saldoAVencer: 1450, saldo: 4340.9 },
  { vendedor: "CENTRO GRANOS", vendNro: 3, cuenta: 3051, denominacion: "La Lucía Cereales", saldoVencido: 33100, saldoAVencer: 8200, saldo: 41300 },
  { vendedor: "CENTRO GRANOS", vendNro: 3, cuenta: 3088, denominacion: "Productores Unidos S.A.", saldoVencido: 540.6, saldoAVencer: 0, saldo: 540.6 },
  { vendedor: "LC AGRO", vendNro: 1, cuenta: 1112, denominacion: "Establecimiento San Jorge", saldoVencido: 11250, saldoAVencer: 4750, saldo: 16000 },
  { vendedor: "PAMPA SUR", vendNro: 2, cuenta: 2120, denominacion: "Granos del Sur SRL", saldoVencido: 6700.3, saldoAVencer: 0, saldo: 6700.3 },
];

// Fecha ISO (yyyy-MM-dd) a `days` de hoy (negativo = pasado).
function isoOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Clasifica una factura demo igual que EstadoContadoCalculator del backend (para que el umbral y las
// fechas tengan efecto real en el mock).
function clasificar(pendiente: number, vencimiento: string, fechaPago: string | null, umbralAvencer: number): EstadoContado {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(`${vencimiento}T00:00:00`);
  if (pendiente > 0.01) {
    if (venc < hoy) return "Mora";
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + umbralAvencer);
    return venc <= limite ? "AVencer" : "AlDia";
  }
  if (!fechaPago) return "SaldadaPorCanje";
  return new Date(`${fechaPago}T00:00:00`) <= venc ? "PagadaEnPlazo" : "PagoTarde";
}

// Facturas de contado demo de una cuenta, derivadas de sus saldos (para que el detalle sea coherente
// con el semáforo del listado). Incluye un ejemplo de cada estado "cerrado".
function facturasDe(c: CuentaBase, umbralAvencer: number): FacturaContado[] {
  let n = c.cuenta * 100 + 1;
  const raw: Omit<FacturaContado, "comprobante" | "estado">[] = [];
  const push = (vencOff: number, plazo: number, importe: number, pendiente: number, pagoOff: number | null) =>
    raw.push({
      emision: isoOffset(vencOff - plazo),
      vencimiento: isoOffset(vencOff),
      plazoDias: plazo,
      importe,
      pendiente,
      fechaPago: pagoOff === null ? null : isoOffset(pagoOff),
    });

  push(-20, 15, 1200, 0, -25); // pagada en plazo (pagó antes de vencer)
  push(-40, 20, 800, 0, -30); // pagó tarde (pagó después de vencer)
  push(-35, 10, 500, 0, null); // saldada por canje (sin recibo)
  if (c.saldoVencido > 0) push(-6, 20, c.saldoVencido, c.saldoVencido, null); // mora
  if (c.saldoAVencer > 0) push(3, 25, c.saldoAVencer, c.saldoAVencer, null); // a vencer / al día según umbral

  return raw
    .map((f) => ({ ...f, comprobante: `A-${n++}`, estado: clasificar(f.pendiente, f.vencimiento, f.fechaPago, umbralAvencer) }))
    .sort((a, b) => ORDEN_CONTADO[b.estado] - ORDEN_CONTADO[a.estado] || a.vencimiento.localeCompare(b.vencimiento));
}

// Peor estado de las facturas ABIERTAS de la cuenta (o "al día" si no hay ninguna abierta).
function estadoContadoDe(c: CuentaBase, umbralAvencer: number): EstadoContado {
  return facturasDe(c, umbralAvencer)
    .filter((f) => f.pendiente > 0.01)
    .reduce<EstadoContado>((peor, f) => (ORDEN_CONTADO[f.estado] > ORDEN_CONTADO[peor] ? f.estado : peor), "AlDia");
}

function rowsConObs(umbralAvencer: number): CuentaDto[] {
  return CUENTAS.map((c) => ({
    ...c,
    estadoContado: estadoContadoDe(c, umbralAvencer),
    devolucion: OBS[c.cuenta]?.devolucion ?? null,
    observaciones: OBS[c.cuenta]?.observaciones ?? null,
  }));
}

function aplicarFiltros(rows: CuentaDto[], u: URL): CuentaDto[] {
  const q = (u.searchParams.get("q") ?? "").toLowerCase();
  const vendNroParam = u.searchParams.get("vendNro");
  const vendNro = vendNroParam ? Number(vendNroParam) : null;
  const umbral = Number(u.searchParams.get("minUsd") ?? "50") || 50;
  let out = rows;
  if (vendNro !== null) out = out.filter((c) => c.vendNro === vendNro);
  if (q) out = out.filter((c) => c.denominacion.toLowerCase().includes(q) || String(c.cuenta).includes(q));
  out = out.filter((c) => Math.abs(c.saldo) >= umbral); // umbral siempre (default 50)
  return out;
}

export const cuentasHandlers = [
  http.get(`${API}/cuentas`, ({ request }) => {
    const u = new URL(request.url);
    const page = Number(u.searchParams.get("page") ?? "1");
    const pageSize = Number(u.searchParams.get("pageSize") ?? "20");
    const umbralAvencer = Number(u.searchParams.get("umbralAvencer") ?? "7") || 7;

    const rows = aplicarFiltros(rowsConObs(umbralAvencer), u);

    const total = rows.length;
    const totalPages = pageSize <= 0 ? 0 : Math.ceil(total / pageSize);
    const items = rows.slice((page - 1) * pageSize, page * pageSize);

    // Totales y subtotales por vendedor sobre TODO el set filtrado (como el backend real).
    const totales = {
      vencido: rows.reduce((s, c) => s + c.saldoVencido, 0),
      aVencer: rows.reduce((s, c) => s + c.saldoAVencer, 0),
      saldo: rows.reduce((s, c) => s + c.saldo, 0),
      cuentas: total,
    };
    const porVend = new Map<
      number,
      { vendNro: number; vendedor: string; vencido: number; aVencer: number; saldo: number; cuentas: number }
    >();
    for (const c of rows) {
      const g = porVend.get(c.vendNro) ?? { vendNro: c.vendNro, vendedor: c.vendedor, vencido: 0, aVencer: 0, saldo: 0, cuentas: 0 };
      g.vencido += c.saldoVencido;
      g.aVencer += c.saldoAVencer;
      g.saldo += c.saldo;
      g.cuentas += 1;
      porVend.set(c.vendNro, g);
    }
    const subtotales = [...porVend.values()].sort((a, b) => a.vendedor.localeCompare(b.vendedor));

    return HttpResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
      totales,
      subtotales,
    });
  }),

  // Detalle de facturas de contado de una cuenta (ya clasificadas y ordenadas por importancia).
  http.get(`${API}/cuentas/:cuenta/facturas-contado`, ({ params, request }) => {
    const cuenta = Number(params.cuenta);
    const umbralAvencer = Number(new URL(request.url).searchParams.get("umbralAvencer") ?? "7") || 7;
    const c = CUENTAS.find((x) => x.cuenta === cuenta);
    return HttpResponse.json(c ? facturasDe(c, umbralAvencer) : []);
  }),

  // Export .xlsx (demo): el backend real arma el formato fiel; acá generamos un .xlsx válido
  // con los mismos filtros para que la descarga funcione sin backend.
  http.get(`${API}/cuentas/export`, async ({ request }) => {
    const rows = aplicarFiltros(rowsConObs(7), new URL(request.url));
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const FMT = '#,##0.00;(#,##0.00);"-"';
    const num = (value: number) => ({ type: Number, value, format: FMT });
    const blob = await writeXlsxFile(rows, {
      sheet: "Cuentas Clientes",
      columns: [
        { header: "Vendedor", width: 16, cell: (r: CuentaDto) => ({ type: String, value: r.vendedor }) },
        { header: "Cuenta", width: 8, cell: (r: CuentaDto) => ({ type: Number, value: r.cuenta }) },
        { header: "Denominación", width: 38, cell: (r: CuentaDto) => ({ type: String, value: r.denominacion }) },
        { header: "Saldo Vencido (USD)", width: 14, cell: (r: CuentaDto) => num(r.saldoVencido) },
        { header: "Saldo a Vencer (USD)", width: 14, cell: (r: CuentaDto) => num(r.saldoAVencer) },
        { header: "Saldo (USD)", width: 13, cell: (r: CuentaDto) => num(r.saldo) },
        { header: "Devolución", width: 40, cell: (r: CuentaDto) => ({ type: String, value: r.devolucion ?? undefined }) },
        { header: "Observaciones", width: 25, cell: (r: CuentaDto) => ({ type: String, value: r.observaciones ?? undefined }) },
      ],
    }).toBlob();

    return new HttpResponse(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Cuentas_Clientes_demo.xlsx"',
      },
    });
  }),

  // Import (demo): no parseamos el .xlsx (el backend real lo hace). Simulamos una devolución
  // importada en una cuenta conocida para que se vea el ida y vuelta tras refrescar el listado.
  http.post(`${API}/cuentas/import`, async ({ request }) => {
    await request.formData(); // consume el archivo subido
    OBS[1024] = { devolucion: "Importado desde Excel (demo)", observaciones: OBS[1024]?.observaciones ?? null };
    return HttpResponse.json({ filasLeidas: 14, cuentasActualizadas: 1, sinCambios: 13, advertencias: [] });
  }),

  http.put(`${API}/cuentas/:cuenta/observacion`, async ({ request, params }) => {
    const cuenta = Number(params.cuenta);
    const body = (await request.json()) as { devolucion?: string | null; observaciones?: string | null };
    OBS[cuenta] = { devolucion: body.devolucion ?? null, observaciones: body.observaciones ?? null };
    return HttpResponse.json({
      cuenta,
      devolucion: OBS[cuenta].devolucion,
      observaciones: OBS[cuenta].observaciones,
      fechaActualizacion: new Date().toISOString(),
    });
  }),

  // Vendedores con cuentas + email resuelto (nuestro ?? MacroGest).
  http.get(`${API}/cuentas/vendedores`, () => {
    const distintos = new Map<number, string>();
    for (const c of CUENTAS) distintos.set(c.vendNro, c.vendedor);
    const lista = [...distintos].map(([vendNro, vendedor]) => {
      const propia = CONTACTOS[vendNro];
      const macro = EMAIL_MACROGEST[vendNro];
      const email = propia ?? macro ?? null;
      const origen = propia ? "propia" : macro ? "macrogest" : "sin";
      return { vendNro, vendedor, email, origen };
    });
    return HttpResponse.json(lista);
  }),

  http.put(`${API}/cuentas/vendedores/:vendNro/contacto`, async ({ params, request }) => {
    const vendNro = Number(params.vendNro);
    const body = (await request.json()) as { email: string };
    CONTACTOS[vendNro] = body.email;
    const vendedor = CUENTAS.find((c) => c.vendNro === vendNro)?.vendedor ?? `Viajante ${vendNro}`;
    return HttpResponse.json({ vendNro, vendedor, email: body.email, origen: "propia" });
  }),

  http.post(`${API}/cuentas/link`, async () => {
    return HttpResponse.json({
      url: `${location.origin}/devolucion/demo`,
      expiraUtc: new Date(Date.now() + 86400000).toISOString(),
    });
  }),
];
