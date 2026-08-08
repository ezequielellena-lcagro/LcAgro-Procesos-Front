import { http, HttpResponse } from "msw";
import type {
  CierreCuenta,
  CuentaContado,
  CuentaDto,
  FacturaContado,
  VendedorContado,
} from "@/features/cuentas/types";
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

// ── Contado ───────────────────────────────────────────────────────────────────────
// Facturas de contado ficticias colgadas de las CUENTAS de arriba (nunca PII real). Incluye tanto
// vencidas como a vencer. Las fechas van como OFFSETS de días respecto del corte (hoy) para que el
// estado vencida/a-vencer sea estable sin importar cuándo corre el demo.
// A propósito:
//  - la cuenta 3015 tiene SOLO facturas a vencer (vencido 0) y DEBE aparecer igual: el umbral filtra
//    por el total impago (monto), nunca por lo vencido;
//  - las cuentas 2044 y 3088 tienen un monto de contado mayor que su saldo global: es el caso
//    "saldada por canje/LSG", donde el pago bajó el saldo sin imputarse a la factura.
interface FacturaContadoBase {
  comprobante: string;
  emisionOffset: number; // días respecto del corte (negativo = pasado)
  vencimientoOffset: number; // días respecto del corte (negativo = vencida; >= 0 = a vencer)
  importe: number;
  pendiente: number;
}

const FACTURAS_CONTADO: Record<number, FacturaContadoBase[]> = {
  1024: [
    { comprobante: "A-18402", emisionOffset: -220, vencimientoOffset: -190, importe: 8200, pendiente: 4100 }, // vencida
    { comprobante: "A-19980", emisionOffset: -8, vencimientoOffset: 22, importe: 5200, pendiente: 5200 }, // a vencer
  ],
  1090: [
    { comprobante: "A-19110", emisionOffset: -160, vencimientoOffset: -145, importe: 1420, pendiente: 620 }, // vencida
  ],
  2011: [
    { comprobante: "A-17650", emisionOffset: -330, vencimientoOffset: -300, importe: 12500, pendiente: 9800 }, // vencida
    { comprobante: "A-18033", emisionOffset: -300, vencimientoOffset: -270, importe: 6400, pendiente: 6400 }, // vencida
    { comprobante: "A-19540", emisionOffset: -10, vencimientoOffset: 20, importe: 4300.25, pendiente: 1200.25 }, // a vencer
  ],
  // Canje: saldo global 980 contra un monto de contado mayor (pagó por canje sin imputar).
  2044: [
    { comprobante: "A-16988", emisionOffset: -380, vencimientoOffset: -350, importe: 5400, pendiente: 5400 }, // vencida
  ],
  2099: [
    { comprobante: "A-19022", emisionOffset: -200, vencimientoOffset: -185, importe: 2750, pendiente: 2750 }, // vencida
  ],
  // SOLO a vencer (vencido 0): DEBE aparecer aunque no tenga nada vencido.
  3015: [
    { comprobante: "A-20110", emisionOffset: -5, vencimientoOffset: 25, importe: 14000, pendiente: 14000 }, // a vencer
    { comprobante: "A-20155", emisionOffset: -2, vencimientoOffset: 40, importe: 7000, pendiente: 7000 }, // a vencer
  ],
  3051: [
    { comprobante: "A-18190", emisionOffset: -270, vencimientoOffset: -240, importe: 15000, pendiente: 7500 }, // vencida
    { comprobante: "A-19301", emisionOffset: -150, vencimientoOffset: -120, importe: 9200, pendiente: 9200 }, // vencida
    { comprobante: "A-20240", emisionOffset: -3, vencimientoOffset: 30, importe: 8200, pendiente: 8200 }, // a vencer
  ],
  // Canje: saldo global 540,60 contra un monto de contado mayor (mismo caso que 2044).
  3088: [
    { comprobante: "A-17420", emisionOffset: -360, vencimientoOffset: -330, importe: 2100, pendiente: 2100 }, // vencida
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

/** Suma `n` días a una fecha yyyy-MM-dd (en local) y la devuelve como yyyy-MM-dd. */
function sumarDias(iso: string, n: number): string {
  const d = aFechaLocal(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

/** Arma el árbol vendedor → cuenta → factura de contado con el mismo orden que el backend real. */
function armarContado(u: URL) {
  const vendNroParam = u.searchParams.get("vendNro");
  const vendNro = vendNroParam ? Number(vendNroParam) : null;
  // El umbral se aplica sobre el total de contado impago de la cuenta (monto), NO sobre su saldo
  // global ni sobre lo vencido: si filtrara por vencido, una cuenta con todo a vencer (vencido 0)
  // desaparecería, que es justo la que interesa ver. Ausente o 0 → 50 (UmbralPorDefecto del backend).
  const umbral = Number(u.searchParams.get("minUsd") ?? "50") || 50;
  const corte = isoLocal(new Date());

  const porVend = new Map<number, VendedorContado>();

  for (const c of CUENTAS) {
    const base = FACTURAS_CONTADO[c.cuenta];
    if (!base) continue;
    if (vendNro !== null && c.vendNro !== vendNro) continue;

    const facturas: FacturaContado[] = base
      .map((f) => {
        const emision = sumarDias(corte, f.emisionOffset);
        const vencimiento = sumarDias(corte, f.vencimientoOffset);
        const vencida = f.vencimientoOffset < 0; // vencimiento < hoy
        return {
          comprobante: f.comprobante,
          emision,
          vencimiento,
          plazoDias: diasEntre(emision, vencimiento),
          vencida,
          diasAtraso: vencida ? diasEntre(vencimiento, corte) : 0,
          importe: f.importe,
          pendiente: f.pendiente,
        };
      })
      // vencimiento asc → las vencidas (fecha pasada) quedan primero.
      .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));

    const montoVencido = facturas.filter((f) => f.vencida).reduce((s, f) => s + f.pendiente, 0);
    const montoAVencer = facturas.filter((f) => !f.vencida).reduce((s, f) => s + f.pendiente, 0);
    const monto = montoVencido + montoAVencer;
    if (monto < umbral) continue;

    const cuenta: CuentaContado = {
      cuenta: c.cuenta,
      denominacion: c.denominacion,
      saldoVencido: c.saldoVencido,
      saldoAVencer: c.saldoAVencer,
      saldo: c.saldo,
      montoVencido,
      montoAVencer,
      monto,
      facturas,
    };

    const v = porVend.get(c.vendNro) ?? {
      vendNro: c.vendNro,
      vendedor: c.vendedor,
      cuentas: 0,
      facturas: 0,
      montoVencido: 0,
      montoAVencer: 0,
      monto: 0,
      detalle: [],
    };
    v.cuentas += 1;
    v.facturas += facturas.length;
    v.montoVencido += montoVencido;
    v.montoAVencer += montoAVencer;
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
      montoVencido: vendedores.reduce((s, v) => s + v.montoVencido, 0),
      montoAVencer: vendedores.reduce((s, v) => s + v.montoAVencer, 0),
      monto: vendedores.reduce((s, v) => s + v.monto, 0),
    },
    vendedores,
  };
}

// ── Histórico mensual (cierre) ──────────────────────────────────────────────────
// Foto append-only por (periodo, cuenta). En memoria: se siembran 2 meses cerrados y el POST agrega
// uno nuevo (upsert por período → idempotente). El "mes en curso" es el primer mes NO cerrado.

interface CierreSnapshot {
  anio: number;
  mes: number;
  corte: string; // yyyy-MM-dd (último día del mes)
  fechaCierre: string; // ISO datetime
  items: CierreCuenta[];
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const round2 = (n: number) => Math.round(n * 100) / 100;
const diasEnMes = (anio: number, mes: number) => new Date(anio, mes, 0).getDate();
const corteDe = (anio: number, mes: number) => `${anio}-${pad2(mes)}-${pad2(diasEnMes(anio, mes))}`;
const periodoActual = () => {
  const hoy = new Date();
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
};
const mesSiguiente = (anio: number, mes: number) =>
  mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
// a es anterior a b (compara año-mes).
const antesDe = (a: { anio: number; mes: number }, b: { anio: number; mes: number }) =>
  a.anio < b.anio || (a.anio === b.anio && a.mes < b.mes);

/** Congela la foto de un período: saldos de las CUENTAS con un factor de progresión (sin notas). */
function fotoItems(factor: number): CierreCuenta[] {
  return CUENTAS.map((c) => {
    const saldoVencido = round2(c.saldoVencido * factor);
    const saldoAVencer = round2(c.saldoAVencer * factor);
    return {
      cuenta: c.cuenta,
      denominacion: c.denominacion,
      vendedor: c.vendedor,
      vendNro: c.vendNro,
      saldoVencido,
      saldoAVencer,
      saldo: round2(saldoVencido + saldoAVencer),
      devolucion: null as string | null,
      observaciones: null as string | null,
    };
  }).sort((a, b) => a.vendedor.localeCompare(b.vendedor) || a.cuenta - b.cuenta);
}

// 2 meses sembrados con una leve progresión (para que el futuro tablero tenga de dónde comparar).
const mayo = fotoItems(0.9);
mayo[0].observaciones = "Refinanció el saldo vencido.";
mayo[0].devolucion = "Firmó plan a 90 días.";
const junio = fotoItems(0.95);
junio[1].observaciones = "Prometió cancelar contra cosecha.";

const CIERRES: CierreSnapshot[] = [
  { anio: 2026, mes: 5, corte: corteDe(2026, 5), fechaCierre: "2026-06-01T10:00:00.000Z", items: mayo },
  { anio: 2026, mes: 6, corte: corteDe(2026, 6), fechaCierre: "2026-07-01T10:00:00.000Z", items: junio },
];

const totalesDe = (items: CierreCuenta[]) => ({
  cuentas: items.length,
  vencido: round2(items.reduce((s, c) => s + c.saldoVencido, 0)),
  aVencer: round2(items.reduce((s, c) => s + c.saldoAVencer, 0)),
  saldo: round2(items.reduce((s, c) => s + c.saldo, 0)),
});

/** El período abierto = el primer mes NO cerrado (el siguiente al último cerrado). */
function periodoAbierto() {
  const ordenados = [...CIERRES].sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  const ult = ordenados[0];
  const abierto = ult ? mesSiguiente(ult.anio, ult.mes) : periodoActual();
  return { ...abierto, faltaCerrar: antesDe(abierto, periodoActual()) };
}

/** Congela el período abierto (upsert por período) y limpia las notas del mes en curso. */
function cerrarMesEnCurso(): CierreSnapshot {
  const { anio, mes } = periodoAbierto();
  const items = CUENTAS.map((c) => ({
    cuenta: c.cuenta,
    denominacion: c.denominacion,
    vendedor: c.vendedor,
    vendNro: c.vendNro,
    saldoVencido: c.saldoVencido,
    saldoAVencer: c.saldoAVencer,
    saldo: c.saldo,
    devolucion: OBS[c.cuenta]?.devolucion ?? null,
    observaciones: OBS[c.cuenta]?.observaciones ?? null,
  })).sort((a, b) => a.vendedor.localeCompare(b.vendedor) || a.cuenta - b.cuenta);

  const snap: CierreSnapshot = { anio, mes, corte: corteDe(anio, mes), fechaCierre: new Date().toISOString(), items };
  const i = CIERRES.findIndex((s) => s.anio === anio && s.mes === mes);
  if (i >= 0) CIERRES[i] = snap;
  else CIERRES.push(snap);

  // El mes nuevo arranca en blanco (la foto ya guardó lo del mes que cierra).
  for (const k of Object.keys(OBS)) delete OBS[Number(k)];
  return snap;
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

  http.get(`${API}/cuentas/contado`, ({ request }) => {
    return HttpResponse.json(armarContado(new URL(request.url)));
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

  // ── Histórico mensual (cierre) ────────────────────────────────────────────────
  // Estado del cierre: período abierto + si ya terminó y falta cerrarlo.
  http.get(`${API}/cuentas/cierre/estado`, () => {
    return HttpResponse.json(periodoAbierto());
  }),

  // Períodos cerrados (más nuevo primero) para el selector.
  http.get(`${API}/cuentas/cierre/periodos`, () => {
    const lista = [...CIERRES]
      .sort((a, b) => b.anio - a.anio || b.mes - a.mes)
      .map((s) => ({
        anio: s.anio,
        mes: s.mes,
        cuentas: s.items.length,
        saldo: totalesDe(s.items).saldo,
        fechaCierre: s.fechaCierre,
      }));
    return HttpResponse.json(lista);
  }),

  // Cierra el mes en curso (idempotente: upsert por período).
  http.post(`${API}/cuentas/cierre`, () => {
    const snap = cerrarMesEnCurso();
    return HttpResponse.json({
      anio: snap.anio,
      mes: snap.mes,
      cuentas: snap.items.length,
      saldo: totalesDe(snap.items).saldo,
    });
  }),

  // Foto de un período cerrado (solo lectura).
  http.get(`${API}/cuentas/cierre/:anio/:mes`, ({ params }) => {
    const anio = Number(params.anio);
    const mes = Number(params.mes);
    const snap = CIERRES.find((s) => s.anio === anio && s.mes === mes);
    if (!snap) return new HttpResponse("Período no encontrado.", { status: 404 });
    return HttpResponse.json({
      anio: snap.anio,
      mes: snap.mes,
      corte: snap.corte,
      totales: totalesDe(snap.items),
      items: snap.items,
    });
  }),

  // Export .xlsx de la foto de un período (demo: mismo patrón que /cuentas/export).
  http.get(`${API}/cuentas/cierre/:anio/:mes/export`, async ({ params }) => {
    const anio = Number(params.anio);
    const mes = Number(params.mes);
    const snap = CIERRES.find((s) => s.anio === anio && s.mes === mes);
    if (!snap) return new HttpResponse("Período no encontrado.", { status: 404 });

    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const FMT = '#,##0.00;(#,##0.00);"-"';
    const num = (value: number) => ({ type: Number, value, format: FMT });
    const blob = await writeXlsxFile(snap.items, {
      sheet: "Cierre",
      columns: [
        { header: "Vendedor", width: 16, cell: (r: CierreCuenta) => ({ type: String, value: r.vendedor }) },
        { header: "Cuenta", width: 8, cell: (r: CierreCuenta) => ({ type: Number, value: r.cuenta }) },
        { header: "Cliente", width: 38, cell: (r: CierreCuenta) => ({ type: String, value: r.denominacion }) },
        { header: "Vencido (USD)", width: 14, cell: (r: CierreCuenta) => num(r.saldoVencido) },
        { header: "A vencer (USD)", width: 14, cell: (r: CierreCuenta) => num(r.saldoAVencer) },
        { header: "Saldo (USD)", width: 13, cell: (r: CierreCuenta) => num(r.saldo) },
        { header: "Devolución", width: 40, cell: (r: CierreCuenta) => ({ type: String, value: r.devolucion ?? undefined }) },
        { header: "Observaciones", width: 25, cell: (r: CierreCuenta) => ({ type: String, value: r.observaciones ?? undefined }) },
      ],
    }).toBlob();

    return new HttpResponse(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Cierre_${anio}${pad2(mes)}.xlsx"`,
      },
    });
  }),
];
