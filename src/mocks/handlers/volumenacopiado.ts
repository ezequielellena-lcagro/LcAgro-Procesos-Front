import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import type { AnalisisVendedorDto, VendedorResumen, VolumenAcopiadoDto } from "@/features/volumenacopiado/types";

const API = env.apiUrl;
const CAMPANIAS = ["2025-2026", "2024-2025", "2023-2024", "2022-2023", "2021-2022", "2020-2021"];

// Vendedores ficticios (NUNCA datos reales). El líder es una "vinculada", como en la realidad.
const BASE: { vendedor: string; tn: number; activos: number; universo: number; excluido: boolean }[] = [
  { vendedor: "SOCIEDAD VINCULADA DEMO", tn: 64_992, activos: 0, universo: 0, excluido: true },
  { vendedor: "CERINO DEMO", tn: 2308, activos: 3, universo: 12, excluido: false },
  { vendedor: "SAN FRANCISCO DEMO", tn: 1653, activos: 8, universo: 14, excluido: false },
  { vendedor: "BRAVIN DEMO", tn: 1391, activos: 6, universo: 9, excluido: false },
  { vendedor: "MASSETTI DEMO", tn: 566, activos: 2, universo: 10, excluido: false },
];

const ACORDADOS: Record<string, number> = { "SAN FRANCISCO DEMO": 1900 };

function resumenDe(v: (typeof BASE)[number]): VendedorResumen {
  const penetracion = v.universo > 0 ? v.activos / v.universo : 0;
  const sugerido = v.excluido ? 0 : Math.round(v.tn * (1 + 0.15 + (1 - penetracion) * 0.15) * 10) / 10;
  const acordado = ACORDADOS[v.vendedor] ?? null;
  return {
    vendedor: v.vendedor,
    tn: v.tn,
    excluido: v.excluido,
    activos: v.activos,
    universo: v.universo,
    dormidos: Math.max(v.universo - v.activos, 0),
    penetracion,
    tnPorActivo: v.activos > 0 ? Math.round((v.tn / v.activos) * 10) / 10 : 0,
    objetivoSugerido: sugerido,
    objetivoAcordado: acordado,
    cumplimiento: acordado ? Math.round((v.tn / acordado) * 1000) / 10 : null,
  };
}

function armar(campania: string): VolumenAcopiadoDto {
  const vendedores = BASE.map(resumenDe);
  return {
    campania,
    campanias: CAMPANIAS,
    vendedores,
    serie: [
      { campania: "2020-2021", productores: 331, tn: 144_365.5 },
      { campania: "2021-2022", productores: 323, tn: 144_987.6 },
      { campania: "2022-2023", productores: 192, tn: 65_971.9 },
      { campania: "2023-2024", productores: 157, tn: 106_963.9 },
      { campania: "2024-2025", productores: 152, tn: 105_732.8 },
      { campania: "2025-2026", productores: 150, tn: 111_769.5 },
    ],
    efectoPlanta: [
      { campania: "2020-2021", prodTotal: 349, prodSinPlanta: 112, tnTotal: 117_577, tnSinPlanta: 54_859 },
      { campania: "2021-2022", prodTotal: 306, prodSinPlanta: 107, tnTotal: 110_774, tnSinPlanta: 59_226 },
    ],
    totales: {
      tn: 111_769.5,
      productores: 150,
      vendedorLider: vendedores[0].vendedor,
      tnLider: vendedores[0].tn,
      shareLider: 58.2,
      tnDormidas: 33_000,
    },
  };
}

function analisisDe(vendedor: string, campania: string): AnalisisVendedorDto {
  const resumen = armar(campania).vendedores.find((v) => v.vendedor === vendedor)!;
  return {
    vendedor,
    campania,
    resumen,
    evolucion: [
      { campania: "2023-2024", productores: 5, tn: 1800 },
      { campania: "2024-2025", productores: 4, tn: 2100 },
      { campania: "2025-2026", productores: resumen.activos, tn: resumen.tn },
    ],
    clientes: [
      { numero: 101, cliente: "PRODUCTOR DEMO A", tn: 1500, tnPico: 1500, campaniaPico: campania, estado: "Creciente", historia: {} },
      { numero: 102, cliente: "PRODUCTOR DEMO B", tn: 808, tnPico: 1200, campaniaPico: "2024-2025", estado: "Declinante", historia: {} },
      { numero: 103, cliente: "PRODUCTOR DEMO C", tn: 0, tnPico: 950, campaniaPico: "2023-2024", estado: "Dormido", historia: {} },
    ],
    palanca: `Reactivar: ${resumen.dormidos} clientes con historia hoy en cero.`,
    explicacionObjetivo: `Sobre las ${resumen.tn.toLocaleString("es-AR")} tn de la campaña, +26 % (15 % base y el resto por la cartera dormida: ${resumen.dormidos} de ${resumen.universo} clientes hoy no entregan). Es una propuesta a acordar.`,
    notaObjetivo: null,
  };
}

export const volumenAcopiadoHandlers = [
  http.get(`${API}/volumen-acopiado/seguimiento`, ({ request }) => {
    const url = new URL(request.url);
    const vendedor = url.searchParams.get("vendedor") ?? "";
    const campania = url.searchParams.get("campania") ?? CAMPANIAS[0];
    const r = armar(campania).vendedores.find((v) => v.vendedor === vendedor);
    if (!r) return HttpResponse.json({ title: "Vendedor sin acopio.", status: 404 }, { status: 404 });

    const objetivo = r.objetivoAcordado;
    return HttpResponse.json({
      vendedor,
      campania,
      email: "vendedor.demo@lcagro.local",
      origenEmail: "macrogest",
      asunto: `Acopio ${campania} — tu seguimiento al 08/08/2026`,
      cuerpoHtml:
        `<div style="font-family:Arial,sans-serif"><p>Hola <b>${vendedor}</b>,</p>` +
        `<p>Así viene tu acopio de la campaña <b>${campania}</b>:</p>` +
        `<table><tr><td>Acopiado</td><td><b>${r.tn.toLocaleString("es-AR")} tn</b></td></tr>` +
        (objetivo
          ? `<tr><td>Objetivo</td><td>${objetivo.toLocaleString("es-AR")} tn</td></tr>` +
            `<tr><td>Cumplimiento</td><td><b>${r.cumplimiento} %</b></td></tr>`
          : `<tr><td>Objetivo</td><td>todavía sin acordar</td></tr>`) +
        `</table><h3>Clientes para recuperar</h3><p>PRODUCTOR DEMO C — 950 tn en 2023-2024</p></div>`,
      cuerpoTexto: `Hola ${vendedor}, acopiaste ${r.tn} tn.`,
      dormidosListados: 1,
      enviable: true,
    });
  }),

  http.post(`${API}/volumen-acopiado/seguimiento`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API}/volumen-acopiado/vendedor`, ({ request }) => {
    const url = new URL(request.url);
    const vendedor = url.searchParams.get("vendedor") ?? "";
    const campania = url.searchParams.get("campania") ?? CAMPANIAS[0];
    if (!BASE.some((v) => v.vendedor === vendedor))
      return HttpResponse.json({ title: "Vendedor sin acopio.", status: 404 }, { status: 404 });
    return HttpResponse.json(analisisDe(vendedor, campania));
  }),

  http.get(`${API}/volumen-acopiado`, ({ request }) => {
    const campania = new URL(request.url).searchParams.get("campania") ?? CAMPANIAS[0];
    return HttpResponse.json(armar(campania));
  }),

  http.put(`${API}/volumen-acopiado/objetivo`, () => new HttpResponse(null, { status: 204 })),
];
