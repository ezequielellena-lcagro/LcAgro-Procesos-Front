import { http, HttpResponse } from "msw";
import type { CuentaDto } from "@/features/cuentas/types";
import { env } from "@/lib/env";
import type { PagedResult } from "@/shared/types/paged";

const API = env.apiUrl;

// Observaciones en memoria (upsert por cuenta) para el demo.
const OBS: Record<number, { devolucion: string | null; observaciones: string | null }> = {};

// Emails de vendedores: "nuestros" (editables, en memoria) y los que vendrían de MacroGest (solo algunos).
const CONTACTOS: Record<number, string> = {};
const EMAIL_MACROGEST: Record<number, string> = { 1: "lcagro@demo.com" };

// Cuentas ficticias (NUNCA PII real). vendedor de ejemplo.
const CUENTAS: Omit<CuentaDto, "devolucion" | "observaciones">[] = [
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
  const vendedor = (u.searchParams.get("vendedor") ?? "").toLowerCase();
  const minUsd = Number(u.searchParams.get("minUsd") ?? "0");
  let out = rows;
  if (vendedor) out = out.filter((c) => c.vendedor.toLowerCase().includes(vendedor));
  if (q) out = out.filter((c) => c.denominacion.toLowerCase().includes(q) || String(c.cuenta).includes(q));
  if (minUsd > 0) out = out.filter((c) => Math.abs(c.saldo) >= minUsd);
  return out;
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
    const paged: PagedResult<CuentaDto> = {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
    return HttpResponse.json(paged);
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
