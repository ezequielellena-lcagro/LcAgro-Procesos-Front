import { http, HttpResponse } from "msw";
import type { AjusteAplicado, AjusteDto, AjusteInput, PosicionDto } from "@/features/posicion/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

interface BaseRow {
  campania: string;
  cereal: string;
  tnCompra: number;
  precioCompra: number | null;
  tnVenta: number;
  precioVenta: number | null;
  tnCalzadas: number;
  margenUsdTn: number | null;
  margenPct: number | null;
  resultadoUsd: number;
  posicionSinAjustes: number;
}

// Base sin ajustes (números de ejemplo, plausibles). La posición FINAL la calcula el handler.
const BASE: BaseRow[] = [
  { campania: "2025-2026", cereal: "Soja", tnCompra: 12000, precioCompra: 305.5, tnVenta: 9800, precioVenta: 312.2, tnCalzadas: 9800, margenUsdTn: 6.7, margenPct: 2.19, resultadoUsd: 65660, posicionSinAjustes: 2200 },
  { campania: "2025-2026", cereal: "Maíz", tnCompra: 8400, precioCompra: 178, tnVenta: 9100, precioVenta: 181.4, tnCalzadas: 8400, margenUsdTn: 3.4, margenPct: 1.91, resultadoUsd: 28560, posicionSinAjustes: -700 },
  { campania: "2025-2026", cereal: "Trigo", tnCompra: 5200, precioCompra: 215, tnVenta: 3100, precioVenta: 223.94, tnCalzadas: 3100, margenUsdTn: 8.94, margenPct: 4.16, resultadoUsd: 27714, posicionSinAjustes: 2100 },
  { campania: "2025-2026", cereal: "Girasol", tnCompra: 2600, precioCompra: 330, tnVenta: 0, precioVenta: null, tnCalzadas: 0, margenUsdTn: null, margenPct: null, resultadoUsd: 0, posicionSinAjustes: 2600 },
  { campania: "2024-2025", cereal: "Soja", tnCompra: 10500, precioCompra: 298, tnVenta: 10500, precioVenta: 305, tnCalzadas: 10500, margenUsdTn: 7, margenPct: 2.35, resultadoUsd: 73500, posicionSinAjustes: 0 },
  { campania: "2024-2025", cereal: "Maíz", tnCompra: 7200, precioCompra: 170, tnVenta: 6800, precioVenta: 174, tnCalzadas: 6800, margenUsdTn: 4, margenPct: 2.35, resultadoUsd: 27200, posicionSinAjustes: 400 },
];

let seq = 4;
const AJUSTES: AjusteDto[] = [
  { id: 1, campania: "2025-2026", cereal: "Soja", tipo: "arrastre", tn: 500, precioUsd: null, signo: "+", nota: "Arrastre 24-25", tnFirmadas: 500, fechaAlta: new Date().toISOString() },
  { id: 2, campania: "2025-2026", cereal: "Girasol", tipo: "produccion_propia", tn: 300, precioUsd: null, signo: "+", nota: null, tnFirmadas: 300, fechaAlta: new Date().toISOString() },
  { id: 3, campania: "2025-2026", cereal: "Soja", tipo: "semilla", tn: 200, precioUsd: 325, signo: "-", nota: "Semilla estimada", tnFirmadas: -200, fechaAlta: new Date().toISOString() },
  { id: 4, campania: "2025-2026", cereal: "Trigo", tipo: "semilla", tn: 1600, precioUsd: 200, signo: "-", nota: null, tnFirmadas: -1600, fechaAlta: new Date().toISOString() },
];

const norm = (s: string) => s.trim().toLowerCase();

function ajusteDe(campania: string, cereal: string) {
  return AJUSTES.filter((a) => norm(a.campania) === norm(campania) && norm(a.cereal) === norm(cereal)).reduce(
    (s, a) => s + a.tnFirmadas,
    0,
  );
}

function detalleDe(campania: string, cereal: string): AjusteAplicado[] {
  const propios = AJUSTES.filter((a) => norm(a.campania) === norm(campania) && norm(a.cereal) === norm(cereal));
  // Agrupa por tipo: suma tn firmada y promedia el precio ponderado por |tn| (espeja PrecioPonderado del backend).
  const porTipo = new Map<AjusteAplicado["tipo"], { tn: number; pesoPrecio: number; peso: number }>();
  for (const a of propios) {
    const acc = porTipo.get(a.tipo) ?? { tn: 0, pesoPrecio: 0, peso: 0 };
    acc.tn += a.tnFirmadas;
    if (a.precioUsd != null) {
      const peso = Math.abs(a.tn);
      acc.pesoPrecio += a.precioUsd * peso;
      acc.peso += peso;
    }
    porTipo.set(a.tipo, acc);
  }
  return [...porTipo.entries()].map(([tipo, v]) => ({
    tipo,
    tn: v.tn,
    precioUsd: v.peso === 0 ? null : v.pesoPrecio / v.peso,
  }));
}

/** Suma tn y promedia el precio PONDERADO por tn (espeja Ponderar del backend). */
function ponderar(xs: { tn: number; precio: number | null }[]) {
  let tn = 0;
  let pesoPrecio = 0;
  let peso = 0;
  for (const x of xs) {
    tn += x.tn;
    if (x.precio != null && x.tn !== 0) {
      pesoPrecio += x.precio * x.tn;
      peso += x.tn;
    }
  }
  return { tn, precio: peso === 0 ? null : pesoPrecio / peso };
}

function toDto(b: BaseRow): PosicionDto {
  const propios = AJUSTES.filter((a) => norm(a.campania) === norm(b.campania) && norm(a.cereal) === norm(b.cereal));
  // Consolidado: cada ajuste a SU lado según el signo ('+' suma a compras, '−' a ventas), precio ponderado.
  const compra = [{ tn: b.tnCompra, precio: b.precioCompra }];
  const venta = [{ tn: b.tnVenta, precio: b.precioVenta }];
  for (const a of propios) (a.signo === "+" ? compra : venta).push({ tn: a.tn, precio: a.precioUsd });
  const c = ponderar(compra);
  const v = ponderar(venta);

  return {
    ...b,
    posicionFinal: b.posicionSinAjustes + ajusteDe(b.campania, b.cereal),
    ajustesDetalle: detalleDe(b.campania, b.cereal),
    tnCompraTotal: c.tn,
    precioCompraTotal: c.precio,
    tnVentaTotal: v.tn,
    precioVentaTotal: v.precio,
    margenTotalUsdTn: v.precio != null && c.precio != null ? v.precio - c.precio : null,
  };
}

export const posicionHandlers = [
  http.get(`${API}/posicion/campanias`, () =>
    HttpResponse.json([...new Set(BASE.map((b) => b.campania))]),
  ),

  http.get(`${API}/posicion`, ({ request }) => {
    const url = new URL(request.url);
    const campania = url.searchParams.get("campania");
    const cereal = url.searchParams.get("cereal");
    let rows = BASE.filter((b) => !campania || norm(b.campania) === norm(campania));
    if (cereal) rows = rows.filter((b) => norm(b.cereal) === norm(cereal));
    return HttpResponse.json(rows.map(toDto));
  }),

  http.get(`${API}/ajustes`, ({ request }) => {
    const campania = new URL(request.url).searchParams.get("campania");
    return HttpResponse.json(AJUSTES.filter((a) => !campania || norm(a.campania) === norm(campania)));
  }),

  http.post(`${API}/ajustes`, async ({ request }) => {
    const input = (await request.json()) as AjusteInput;
    const nuevo: AjusteDto = {
      id: ++seq,
      ...input,
      tnFirmadas: input.signo === "+" ? input.tn : -input.tn,
      fechaAlta: new Date().toISOString(),
    };
    AJUSTES.push(nuevo);
    return HttpResponse.json(nuevo, { status: 201 });
  }),

  http.put(`${API}/ajustes/:id`, async ({ request, params }) => {
    const id = Number(params.id);
    const idx = AJUSTES.findIndex((a) => a.id === id);
    if (idx === -1) return HttpResponse.json({ title: "No encontrado.", status: 404 }, { status: 404 });
    const input = (await request.json()) as AjusteInput;
    AJUSTES[idx] = { ...AJUSTES[idx], ...input, tnFirmadas: input.signo === "+" ? input.tn : -input.tn };
    return HttpResponse.json(AJUSTES[idx]);
  }),

  http.delete(`${API}/ajustes/:id`, ({ params }) => {
    const idx = AJUSTES.findIndex((a) => a.id === Number(params.id));
    if (idx !== -1) AJUSTES.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
