import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import type { ProduccionPropiaDto } from "@/features/produccionpropia/types";

const API = env.apiUrl;

// Datos ficticios (NUNCA reales), calcados de la forma del tablero de referencia: el saldo sale de
// cosechado − vendido y la ubicación física suma cta. cte. + embolsado + planta 10.
const FILAS = [
  { cereal: "Maíz", cosechado: 8296.8, vendido: 2459.3, precioUsd: 184.97, ctaCte: 3029, embolsado: 2006, planta10: 2254 },
  { cereal: "Soja", cosechado: 6153.2, vendido: 1335.5, precioUsd: 327.11, ctaCte: 2956, embolsado: 1425.8, planta10: 581 },
  { cereal: "Trigo", cosechado: 3530.3, vendido: 832.2, precioUsd: 200.72, ctaCte: 846, embolsado: 0, planta10: 1852 },
  { cereal: "Girasol", cosechado: 429.3, vendido: 438.8, precioUsd: 365.95, ctaCte: null, embolsado: 0, planta10: 17.5 },
  { cereal: "Colza", cosechado: 232.2, vendido: 224.9, precioUsd: 470.75, ctaCte: null, embolsado: 0, planta10: 18.9 },
];

function armar(campania: string): ProduccionPropiaDto {
  const filas = FILAS.map((f) => {
    const saldo = f.cosechado - f.vendido;
    const totalFisico = (f.ctaCte ?? 0) + f.embolsado + f.planta10;
    return { ...f, saldo, totalFisico, difControl: totalFisico - saldo };
  });
  const suma = (get: (f: (typeof filas)[number]) => number) => filas.reduce((s, f) => s + get(f), 0);

  return {
    campania,
    fecha: "2026-07-31",
    filas,
    totales: {
      cosechado: suma((f) => f.cosechado),
      vendido: suma((f) => f.vendido),
      saldo: suma((f) => f.saldo),
      ctaCte: suma((f) => f.ctaCte ?? 0),
      embolsado: suma((f) => f.embolsado),
      planta10: suma((f) => f.planta10),
      totalFisico: suma((f) => f.totalFisico),
      difControl: suma((f) => f.difControl),
    },
    cosechaPendiente: false,
    silobolsaPendiente: false,
  };
}

export const produccionPropiaHandlers = [
  http.get(`${API}/produccion-propia/campanias`, () =>
    HttpResponse.json(["2025-2026", "2024-2025", "2023-2024"]),
  ),

  http.get(`${API}/produccion-propia`, ({ request }) => {
    const campania = new URL(request.url).searchParams.get("campania") ?? "2025-2026";
    return HttpResponse.json(armar(campania));
  }),

  http.get(`${API}/produccion-propia/export`, () =>
    new HttpResponse(new Blob(["demo"]), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Produccion_Propia_demo.xlsx"',
      },
    }),
  ),

  http.put(`${API}/produccion-propia/saldo-cuenta`, () => new HttpResponse(null, { status: 204 })),
];
