import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import type {
  CampaniaTablero,
  EvolucionMes,
  GuardarObjetivosRequest,
  GuardarObjetivosVendedoresRequest,
  ObjetivoCereal,
  ObjetivosIndicadores,
  TableroAcopioDto,
  VendedorTablero,
} from "@/features/tableroacopio/types";

const API = env.apiUrl;

// Datos INVENTADOS para el modo demo: ni números ni nombres reales.
const DEFECTO: ObjetivosIndicadores = {
  gananciaPosicionPct: 1.5,
  comisionPct: 1,
  rotacion: 1.5,
  tnPreventas: 100_000,
  tnAcopiadas: null,
  nuevosClientes: null,
};

const objetivos: Record<string, ObjetivosIndicadores> = {};
const objetivosCereal: Record<string, ObjetivoCereal[]> = {};
const acordados: Record<string, Record<string, number>> = {};

function campania(c: string, p: Partial<CampaniaTablero>): CampaniaTablero {
  return {
    campania: c,
    tnCalzadas: 80_000,
    valorCompraUsd: 22_000_000,
    resultadoUsd: 500_000,
    gananciaPosicionPct: 2.27,
    posicionConArrastre: true,
    liquidacionesLpg: 1_000,
    tnLiquidadas: 150_000,
    comprasLpgArs: 50_000_000_000,
    comisionArs: 300_000_000,
    almacenajeArs: 100_000_000,
    selladoArs: 60_000_000,
    comisGanadasArs: 460_000_000,
    comisionPct: 0.92,
    pagadasPp: 0.05,
    iibbPp: 0.041,
    impuestoDcArs: 40_000_000,
    impuestoDcPp: 0.08,
    impuestoDcMeses: 12,
    comisionPctNeta: 0.749,
    netoCompleto: true,
    tnVtaDeduce: 5_000,
    tnVtaEnPrecio: 30_000,
    tnVtaNoCobra: 40_000,
    tnVtaSinClasif: 1_500,
    tnVtaTotal: 76_500,
    pctSinClasificar: 2,
    tnP15: 50_000,
    tnP15Completa: 52_000,
    tnBalanzaTotal: 60_000,
    rotacion: 1.41,
    rotacionCompleta: 1.47,
    contratosPreventa: 1_100,
    tnPreventas: 80_000,
    tnPreventasCompleta: 90_000,
    tnAcopiadas: 95_000,
    tnAcopiadasCompleta: 98_000,
    productores: 150,
    productoresCompleta: 155,
    nuevosClientes: 20,
    nuevosCompleta: 22,
    tnDeNuevos: 3_000,
    tnSinPrecio: 100,
    preCorte: false,
    titular: false,
    enCurso: false,
    definitiva: true,
    objetivos: objetivos[c] ?? DEFECTO,
    objetivosPropios: c in objetivos,
    objetivosCereal: objetivosCereal[c] ?? [],
    ...p,
  };
}

function evolucion(): EvolucionMes[] {
  const filas: EvolucionMes[] = [];
  const campanias: [string, number][] = [
    ["2024-2025", 2024],
    ["2025-2026", 2025],
  ];
  for (const [c, anio] of campanias) {
    for (let i = 0; i < 14; i++) {
      const fecha = new Date(anio, 6 + i, 1);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      const tc = 4_000 + (i % 4) * 500;
      const tv = 3_800 + (i % 3) * 600;
      const margen = c === "2024-2025" ? 9 : 4 - (i % 5);
      filas.push({
        campania: c,
        cereal: i % 2 === 0 ? "Soja" : "Maíz",
        mes,
        tnC: tc,
        tnCP: tc,
        usdC: tc * (i % 2 === 0 ? 300 : 180),
        tnV: tv,
        tnVP: tv,
        usdV: tv * ((i % 2 === 0 ? 300 : 180) + margen),
        apertura: false,
      });
    }
  }
  return filas;
}

function vendedores(): VendedorTablero[] {
  const base: [string, number, number, number][] = [
    ["VENDEDOR A DEMO", 18_000, 19_500, 14_000],
    ["VENDEDOR B DEMO", 12_500, 13_000, 9_000],
    ["VENDEDOR C DEMO", 3_000, 3_200, 2_100],
    ["VENDEDOR D DEMO", 700, 900, 300],
  ];
  return base.map(([v, corteAnt, cierreAnt, corte]) => {
    const acordado = acordados["2025-2026"]?.[v];
    const objetivoTn = acordado ?? cierreAnt * 1.15;
    return {
      campania: "2025-2026",
      vendedor: v,
      tnCorte: corte,
      tnCompleta: corte,
      clientes: 10,
      tnAnteriorCorte: corteAnt,
      baseObjetivoTn: cierreAnt,
      objetivoPct: Math.round((objetivoTn / cierreAnt - 1) * 1000) / 10,
      objetivoTn,
      objetivoAcordado: acordado != null,
      avancePct: Math.round((corte / objetivoTn) * 1000) / 10,
    };
  });
}

function tablero(): TableroAcopioDto {
  return {
    generado: new Date().toISOString(),
    corte: "02/11",
    corteFijo: false,
    campaniaInicioArrastre: "2023-2024",
    parametros: {
      capacidadAcopioTn: 35_400,
      alicuotaIibb: 0.045,
      tasaCorredorA: 0.005,
      tasaCorredorD: 0,
      cuentasReducidas: [3, 9, 10, 12, 28],
      minTnCampania: 5_000,
      umbralDefinitivaTn: 500,
      objetivoVendedorPct: 15,
    },
    objetivosPorDefecto: DEFECTO,
    campanias: [
      campania("2022-2023", {
        gananciaPosicionPct: -1.2,
        posicionConArrastre: false,
        tnPreventas: 45_000,
        rotacion: 0.8,
      }),
      campania("2023-2024", { gananciaPosicionPct: 3.1, tnPreventas: 55_000, rotacion: 1.5 }),
      campania("2024-2025", {
        gananciaPosicionPct: 3.6,
        tnPreventas: 62_000,
        rotacion: 1.31,
        definitiva: false,
        tnSinPrecio: 900,
      }),
      campania("2025-2026", {
        gananciaPosicionPct: 0.6,
        comisionPctNeta: 0.76,
        tnPreventas: 81_000,
        titular: true,
        enCurso: true,
        definitiva: false,
        tnSinPrecio: 18_000,
        impuestoDcMeses: 11,
        netoCompleto: false,
      }),
      campania("2026-2027", {
        preCorte: true,
        gananciaPosicionPct: -0.1,
        tnPreventas: 9_000,
        tnAcopiadas: 8_000,
        definitiva: false,
      }),
    ],
    acopiadoCereal: [
      { campania: "2025-2026", cereal: "Soja", tnCompleta: 66_000, tnCorte: 65_000 },
      { campania: "2025-2026", cereal: "Maíz", tnCompleta: 16_000, tnCorte: 15_000 },
      { campania: "2025-2026", cereal: "Trigo", tnCompleta: 11_000, tnCorte: 11_000 },
    ],
    acopiadoExcluido: [
      { campania: "2025-2026", exclCorte: 55_000, exclTotal: 56_000, comercialCorte: 40_000 },
    ],
    evolucion: evolucion(),
    vendedores: vendedores(),
  };
}

export const tableroAcopioHandlers = [
  http.get(`${API}/acopio/tablero`, () => HttpResponse.json(tablero())),

  http.put(`${API}/acopio/tablero/objetivos/:campania`, async ({ params, request }) => {
    const body = (await request.json()) as GuardarObjetivosRequest;
    const c = String(params.campania);
    objetivos[c] = body.indicadores;
    objetivosCereal[c] = body.cereales;
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API}/acopio/tablero/objetivos/:campania`, ({ params }) => {
    const c = String(params.campania);
    delete objetivos[c];
    delete objetivosCereal[c];
    return new HttpResponse(null, { status: 204 });
  }),

  http.put(`${API}/acopio/tablero/objetivos/:campania/vendedores`, async ({ params, request }) => {
    const body = (await request.json()) as GuardarObjetivosVendedoresRequest;
    const c = String(params.campania);
    const bases = Object.fromEntries(vendedores().map((v) => [v.vendedor, v.baseObjetivoTn ?? 0]));
    acordados[c] = acordados[c] ?? {};
    for (const { vendedor, porcentaje } of body.vendedores)
      acordados[c][vendedor] = Math.round(bases[vendedor] * (1 + porcentaje / 100) * 10) / 10;
    return new HttpResponse(null, { status: 204 });
  }),
];
