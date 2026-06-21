import { http, HttpResponse } from "msw";
import type { CuentaDto } from "@/features/cuentas/types";
import { env } from "@/lib/env";
import type { PagedResult } from "@/shared/types/paged";

const API = env.apiUrl;

// Observaciones en memoria (upsert por cuenta) para el demo.
const OBS: Record<number, { devolucion: string | null; observaciones: string | null }> = {};

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

export const cuentasHandlers = [
  http.get(`${API}/cuentas`, ({ request }) => {
    const u = new URL(request.url);
    const q = (u.searchParams.get("q") ?? "").toLowerCase();
    const vendedor = (u.searchParams.get("vendedor") ?? "").toLowerCase();
    const minUsd = Number(u.searchParams.get("minUsd") ?? "0");
    const page = Number(u.searchParams.get("page") ?? "1");
    const pageSize = Number(u.searchParams.get("pageSize") ?? "20");

    let rows: CuentaDto[] = CUENTAS.map((c) => ({
      ...c,
      devolucion: OBS[c.cuenta]?.devolucion ?? null,
      observaciones: OBS[c.cuenta]?.observaciones ?? null,
    }));

    if (vendedor) rows = rows.filter((c) => c.vendedor.toLowerCase().includes(vendedor));
    if (q) rows = rows.filter((c) => c.denominacion.toLowerCase().includes(q) || String(c.cuenta).includes(q));
    if (minUsd > 0) rows = rows.filter((c) => Math.abs(c.saldo) >= minUsd);

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
];
