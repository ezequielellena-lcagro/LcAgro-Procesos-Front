import { http, HttpResponse } from "msw";
import type { CuentaDto, CuentaMora, FacturaMora, VendedorMora } from "@/features/cuentas/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

type CuentaBase = Omit<CuentaDto, "devolucion" | "observaciones">;

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

function rowsConObs(): CuentaDto[] {
  return CUENTAS.map((c) => ({
    ...c,
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

// ── Facturas en mora ────────────────────────────────────────────────────────────
// Facturas de contado ficticias colgadas de las CUENTAS de arriba (nunca PII real).
// A propósito hay dos cuentas (2044 y 3088) cuya mora supera el saldo global: es el caso
// "saldada por canje/LSG", donde el pago bajó el saldo sin imputarse a la factura.
type FacturaMoraBase = Pick<FacturaMora, "comprobante" | "emision" | "vencimiento" | "importe" | "pendiente">;

const FACTURAS_MORA: Record<number, FacturaMoraBase[]> = {
  1024: [
    { comprobante: "A-18402", emision: "2025-11-12", vencimiento: "2025-12-12", importe: 8200, pendiente: 4100 },
    { comprobante: "A-18877", emision: "2026-01-20", vencimiento: "2026-02-19", importe: 3150.4, pendiente: 3150.4 },
  ],
  1090: [
    { comprobante: "A-19110", emision: "2026-02-03", vencimiento: "2026-02-18", importe: 1420, pendiente: 620 },
  ],
  2011: [
    { comprobante: "A-17650", emision: "2025-08-05", vencimiento: "2025-09-04", importe: 12500, pendiente: 9800 },
    { comprobante: "A-18033", emision: "2025-09-30", vencimiento: "2025-10-30", importe: 6400, pendiente: 6400 },
    { comprobante: "A-19540", emision: "2026-03-11", vencimiento: "2026-04-10", importe: 4300.25, pendiente: 1200.25 },
  ],
  // Saldo global 980 contra 5.400 de mora: pagó por canje sin imputar.
  2044: [
    { comprobante: "A-16988", emision: "2025-06-18", vencimiento: "2025-07-18", importe: 5400, pendiente: 5400 },
  ],
  2099: [
    { comprobante: "A-19022", emision: "2026-01-08", vencimiento: "2026-01-23", importe: 2750, pendiente: 2750 },
  ],
  3051: [
    { comprobante: "A-18190", emision: "2025-10-02", vencimiento: "2025-11-01", importe: 15000, pendiente: 7500 },
    { comprobante: "A-19301", emision: "2026-02-14", vencimiento: "2026-03-16", importe: 9200, pendiente: 9200 },
  ],
  // Saldo global 540,60 contra 2.100 de mora: mismo caso que 2044.
  3088: [
    { comprobante: "A-17420", emision: "2025-07-22", vencimiento: "2025-08-21", importe: 2100, pendiente: 2100 },
  ],
};

const DIA_MS = 86_400_000;

/** Parsea yyyy-MM-dd como fecha LOCAL (evita el corrimiento de un día por timezone). */
function aFechaLocal(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const diasEntre = (desde: string, hasta: string) =>
  Math.round((aFechaLocal(hasta).getTime() - aFechaLocal(desde).getTime()) / DIA_MS);

/** Arma el árbol vendedor → cuenta → factura con el mismo orden que el backend real. */
function armarMora(u: URL) {
  const vendNroParam = u.searchParams.get("vendNro");
  const vendNro = vendNroParam ? Number(vendNroParam) : null;
  // El umbral se aplica sobre la mora de la cuenta (es de lo que habla esta solapa), NO sobre su saldo
  // global. Ausente o 0 → 50, igual que UmbralPorDefecto del backend.
  const umbral = Number(u.searchParams.get("minUsd") ?? "50") || 50;
  const corte = isoLocal(new Date());

  const porVend = new Map<number, VendedorMora>();

  for (const c of CUENTAS) {
    const base = FACTURAS_MORA[c.cuenta];
    if (!base) continue;
    if (vendNro !== null && c.vendNro !== vendNro) continue;

    const facturas: FacturaMora[] = base
      .map((f) => ({
        ...f,
        plazoDias: diasEntre(f.emision, f.vencimiento),
        diasAtraso: diasEntre(f.vencimiento, corte),
      }))
      .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));

    const monto = facturas.reduce((s, f) => s + f.pendiente, 0);
    if (monto < umbral) continue;

    const cuenta: CuentaMora = {
      cuenta: c.cuenta,
      denominacion: c.denominacion,
      saldoVencido: c.saldoVencido,
      saldoAVencer: c.saldoAVencer,
      saldo: c.saldo,
      monto,
      facturas,
    };

    const v = porVend.get(c.vendNro) ?? {
      vendNro: c.vendNro,
      vendedor: c.vendedor,
      cuentas: 0,
      facturas: 0,
      monto: 0,
      detalle: [],
    };
    v.cuentas += 1;
    v.facturas += facturas.length;
    v.monto += monto;
    v.detalle.push(cuenta);
    porVend.set(c.vendNro, v);
  }

  const vendedores = [...porVend.values()].sort((a, b) => a.vendedor.localeCompare(b.vendedor));
  for (const v of vendedores) v.detalle.sort((a, b) => b.monto - a.monto);

  return {
    corte,
    totales: {
      vendedores: vendedores.length,
      cuentas: vendedores.reduce((s, v) => s + v.cuentas, 0),
      facturas: vendedores.reduce((s, v) => s + v.facturas, 0),
      monto: vendedores.reduce((s, v) => s + v.monto, 0),
    },
    vendedores,
  };
}

export const cuentasHandlers = [
  http.get(`${API}/cuentas`, ({ request }) => {
    const u = new URL(request.url);
    const page = Number(u.searchParams.get("page") ?? "1");
    const pageSize = Number(u.searchParams.get("pageSize") ?? "20");

    const rows = aplicarFiltros(rowsConObs(), u);

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

  http.get(`${API}/cuentas/facturas-en-mora`, ({ request }) => {
    return HttpResponse.json(armarMora(new URL(request.url)));
  }),

  // Export .xlsx (demo): el backend real arma el formato fiel; acá generamos un .xlsx válido
  // con los mismos filtros para que la descarga funcione sin backend.
  http.get(`${API}/cuentas/export`, async ({ request }) => {
    const rows = aplicarFiltros(rowsConObs(), new URL(request.url));
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
