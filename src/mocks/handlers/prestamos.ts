import { http, HttpResponse } from "msw";
import type {
  CatalogosPrestamos,
  CuotaDto,
  CuotaPropuesta,
  Moneda,
  PrestamoDetalleDto,
  PrestamoListadoDto,
  VencimientosDto,
} from "@/features/prestamos/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

/**
 * Datos de ejemplo con la FORMA de la cartera real (una operación multicuota, varias bullet, dos en
 * pesos), pero con importes redondeados: la deuda bancaria de la empresa no va a un repo.
 */
const BANCOS = [
  { id: 1, nombre: "NACIÓN", esFinanciacionProveedor: false },
  { id: 2, nombre: "GALICIA", esFinanciacionProveedor: false },
  { id: 3, nombre: "SANTANDER", esFinanciacionProveedor: false },
  { id: 4, nombre: "MACRO", esFinanciacionProveedor: false },
];

const LINEAS = [
  { id: 1, nombre: "CAPITAL DE TRABAJO", esFinanciacionProveedor: false },
  { id: 2, nombre: "AGRO BAYER", esFinanciacionProveedor: true },
  { id: 3, nombre: "BUNGE", esFinanciacionProveedor: true },
];

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const enMeses = (meses: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return iso(d);
};

function cuota(nro: number, meses: number, capital: number, interes: number): CuotaDto {
  const iva = Math.round(interes * 12) / 100;
  return {
    id: nro * 100 + meses,
    nroCuota: nro,
    fechaVencimiento: enMeses(meses),
    capital,
    interes,
    iva,
    total: capital + interes + iva,
    estado: "Pendiente",
    fechaPago: null,
    importePagado: null,
    observacion: null,
  };
}

const CUOTAS_USD: Record<number, CuotaDto[]> = {
  1: [1, 2, 3, 4].map((i) => cuota(i, i * 6 - 3, 30000, 4000 - i * 400)),
  2: [cuota(1, 2, 110000, 0)],
  3: [cuota(1, 5, 200000, 9000)],
};

const CUOTAS_ARS: Record<number, CuotaDto[]> = {
  4: [5, 6].map((i) => cuota(i, (i - 4) * 6, 25000000, 5000000 - (i - 5) * 1300000)),
};

const detalles: PrestamoDetalleDto[] = [
  {
    id: 1,
    bancoId: 1,
    banco: "NACIÓN",
    sucursal: "SAN JORGE",
    lineaCreditoId: 2,
    linea: "AGRO BAYER",
    nroOperacion: "39646384",
    moneda: "USD",
    tipo: "FinanciacionProveedor",
    capitalOriginal: 120000,
    fechaOtorgamiento: enMeses(-3),
    cantidadCuotas: 4,
    periodicidad: "Semestral",
    tasaNominalAnual: 2.75,
    estado: "Vigente",
    observaciones: null,
    saldoTotal: 0,
    capitalAdeudado: 0,
    cuotasPagadas: 0,
    proximoVencimiento: null,
    cuotas: CUOTAS_USD[1],
    advertencias: [],
  },
  {
    id: 2,
    bancoId: 2,
    banco: "GALICIA",
    sucursal: "ROSARIO",
    lineaCreditoId: 3,
    linea: "BUNGE",
    nroOperacion: "808130097682",
    moneda: "USD",
    tipo: "FinanciacionProveedor",
    capitalOriginal: 110000,
    fechaOtorgamiento: enMeses(-6),
    cantidadCuotas: 1,
    periodicidad: "Unico",
    tasaNominalAnual: 0,
    estado: "Vigente",
    observaciones: null,
    saldoTotal: 0,
    capitalAdeudado: 0,
    cuotasPagadas: 0,
    proximoVencimiento: null,
    cuotas: CUOTAS_USD[2],
    advertencias: [],
  },
  {
    id: 3,
    bancoId: 3,
    banco: "SANTANDER",
    sucursal: "SAN JORGE",
    lineaCreditoId: 1,
    linea: "CAPITAL DE TRABAJO",
    nroOperacion: null,
    moneda: "USD",
    tipo: "Prestamo",
    capitalOriginal: 200000,
    fechaOtorgamiento: enMeses(-7),
    cantidadCuotas: 1,
    periodicidad: "Unico",
    tasaNominalAnual: 4.7,
    estado: "Vigente",
    observaciones: null,
    saldoTotal: 0,
    capitalAdeudado: 0,
    cuotasPagadas: 0,
    proximoVencimiento: null,
    cuotas: CUOTAS_USD[3],
    advertencias: [],
  },
  {
    id: 4,
    bancoId: 1,
    banco: "NACIÓN",
    sucursal: "SAN JORGE",
    lineaCreditoId: 1,
    linea: "CAPITAL DE TRABAJO",
    nroOperacion: "28078488",
    moneda: "ARS",
    tipo: "Prestamo",
    capitalOriginal: 200000000,
    fechaOtorgamiento: enMeses(-24),
    // 8 cuotas de las que sólo se cargaron las pendientes: el caso real del Excel.
    cantidadCuotas: 8,
    periodicidad: "Semestral",
    tasaNominalAnual: 10,
    estado: "Vigente",
    observaciones: null,
    saldoTotal: 0,
    capitalAdeudado: 0,
    cuotasPagadas: 0,
    proximoVencimiento: null,
    cuotas: CUOTAS_ARS[4],
    advertencias: [],
  },
];

/** Los derivados se calculan igual que en el dominio, para que el mock no mienta. */
function conDerivados(p: PrestamoDetalleDto): PrestamoDetalleDto {
  const pendientes = p.cuotas.filter((c) => c.estado === "Pendiente");
  return {
    ...p,
    saldoTotal: pendientes.reduce((s, c) => s + c.total, 0),
    capitalAdeudado: pendientes.reduce((s, c) => s + c.capital, 0),
    cuotasPagadas: p.cantidadCuotas - pendientes.length,
    proximoVencimiento: pendientes.map((c) => c.fechaVencimiento).sort()[0] ?? null,
  };
}

function aListado(p: PrestamoDetalleDto): PrestamoListadoDto {
  const d = conDerivados(p);
  return {
    id: d.id,
    banco: d.banco,
    sucursal: d.sucursal,
    linea: d.linea,
    nroOperacion: d.nroOperacion,
    moneda: d.moneda,
    tipo: d.tipo,
    capitalOriginal: d.capitalOriginal,
    fechaOtorgamiento: d.fechaOtorgamiento,
    periodicidad: d.periodicidad,
    tasaNominalAnual: d.tasaNominalAnual,
    cuotasPagadas: d.cuotasPagadas,
    cantidadCuotas: d.cantidadCuotas,
    saldoTotal: d.saldoTotal,
    capitalAdeudado: d.capitalAdeudado,
    proximoVencimiento: d.proximoVencimiento,
    estado: d.estado,
  };
}

const MESES_POR_PERIODICIDAD: Record<string, number> = {
  Unico: 0,
  Mensual: 1,
  Bimestral: 2,
  Trimestral: 3,
  Cuatrimestral: 4,
  Semestral: 6,
  Anual: 12,
  Irregular: 0,
};

export const prestamosHandlers = [
  http.get(`${API}/prestamos`, ({ request }) => {
    const moneda = (new URL(request.url).searchParams.get("moneda") ?? "USD") as Moneda;
    return HttpResponse.json(
      detalles.filter((p) => p.moneda === moneda).map(aListado) satisfies PrestamoListadoDto[],
    );
  }),

  http.get(`${API}/prestamos/vencimientos`, ({ request }) => {
    const url = new URL(request.url);
    const moneda = (url.searchParams.get("moneda") ?? "USD") as Moneda;
    const incluirPagadas = url.searchParams.get("incluirPagadas") === "true";
    const hoy = iso(new Date());

    const items = detalles
      .filter((p) => p.moneda === moneda)
      .flatMap((p) =>
        p.cuotas
          .filter((c) => incluirPagadas || c.estado === "Pendiente")
          .map((c) => ({
            cuotaId: c.id,
            prestamoId: p.id,
            fechaVencimiento: c.fechaVencimiento,
            banco: p.banco,
            sucursal: p.sucursal,
            linea: p.linea,
            nroOperacion: p.nroOperacion,
            nroCuota: c.nroCuota,
            cantidadCuotas: p.cantidadCuotas,
            capital: c.capital,
            interes: c.interes,
            iva: c.iva,
            total: c.total,
            tasaNominalAnual: p.tasaNominalAnual,
            estado: c.estado,
            vencida: c.estado === "Pendiente" && c.fechaVencimiento < hoy,
          })),
      )
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

    return HttpResponse.json({
      moneda,
      items,
      totalCapital: items.reduce((s, i) => s + i.capital, 0),
      totalInteres: items.reduce((s, i) => s + i.interes, 0),
      totalIva: items.reduce((s, i) => s + i.iva, 0),
      totalTotal: items.reduce((s, i) => s + i.total, 0),
    } satisfies VencimientosDto);
  }),

  // Cruce contra MacroGest: en mocks se devuelve un caso CON diferencias, que es el que hay
  // que poder mirar. Un "todo conciliado" no muestra nada de la pantalla.
  http.get(`${API}/prestamos/macrogest/conciliacion`, () =>
    HttpResponse.json({
      desde: enMeses(-36),
      conciliadas: [
        {
          prestamoId: 1,
          nroOperacion: "39646384",
          banco: "NACIÓN",
          linea: "AGRO BAYER",
          capital: 120000,
        },
        {
          prestamoId: 2,
          nroOperacion: "808130097682",
          banco: "GALICIA",
          linea: "BUNGE",
          capital: 110000,
        },
      ],
      sinRespaldoBancario: [
        {
          prestamoId: 3,
          nroOperacion: "972180700",
          banco: "SANTA FE",
          linea: "CAPITAL DE TRABAJO",
          capital: 150000,
        },
      ],
      sinCargar: [
        {
          nroOperacion: "00058050",
          banco: "NACIÓN",
          capitalUsd: 225377.02,
          tasaNominalAnual: 2.75,
          concepto: "Préstamo Agronación Agro Bayer TNA 2,75 %",
          fecha: enMeses(-3),
        },
      ],
      sinNumeroDeOperacion: [
        {
          prestamoId: 4,
          nroOperacion: null,
          banco: "MACRO",
          linea: "AGRO BAYER",
          capital: 62212.65,
        },
      ],
      hayDiferencias: true,
    }),
  ),

  http.get(`${API}/prestamos/catalogos`, () =>
    HttpResponse.json({ bancos: BANCOS, lineas: LINEAS } satisfies CatalogosPrestamos),
  ),

  http.get(`${API}/prestamos/:id`, ({ params }) => {
    const p = detalles.find((x) => x.id === Number(params.id));
    return p
      ? HttpResponse.json(conDerivados(p))
      : HttpResponse.json({ detail: "Recurso no encontrado." }, { status: 404 });
  }),

  http.post(`${API}/prestamos/cronograma/simular`, async ({ request }) => {
    const { capital, cantidadCuotas, periodicidad, primerVencimiento } = (await request.json()) as {
      capital: number;
      cantidadCuotas: number;
      periodicidad: string;
      primerVencimiento: string;
    };
    const meses = MESES_POR_PERIODICIDAD[periodicidad] ?? 0;
    const porCuota = Math.floor((capital / cantidadCuotas) * 100) / 100;

    const cuotas: CuotaPropuesta[] = Array.from({ length: cantidadCuotas }, (_, i) => {
      const f = new Date(`${primerVencimiento}T00:00:00`);
      f.setMonth(f.getMonth() + meses * i);
      return {
        nroCuota: i + 1,
        fechaVencimiento: iso(f),
        capital:
          i === cantidadCuotas - 1
            ? Math.round((capital - porCuota * (cantidadCuotas - 1)) * 100) / 100
            : porCuota,
        interes: 0,
        iva: 0,
      };
    });
    return HttpResponse.json(cuotas);
  }),

  // Los .xlsx del modo mocks van vacíos: generar un Excel real en el browser no aporta nada
  // (el formato lo cubren los tests del backend) y sí pesaría en el bundle.
  http.get(`${API}/prestamos/plantilla`, () => new HttpResponse(new Blob(), { status: 200 })),
  http.get(`${API}/prestamos/export`, () => new HttpResponse(new Blob(), { status: 200 })),
  http.post(`${API}/prestamos/import`, ({ request }) =>
    HttpResponse.json({
      operacionesCreadas: 2,
      operacionesActualizadas: 1,
      cuotasCargadas: 7,
      confirmado: new URL(request.url).searchParams.get("confirmar") === "true",
      advertencias: [],
    }),
  ),

  // Las escrituras responden OK sin persistir: el modo mocks es para recorrer la pantalla.
  http.post(`${API}/prestamos`, () =>
    HttpResponse.json(conDerivados(detalles[0]), { status: 201 }),
  ),
  http.put(`${API}/prestamos/:id`, () => HttpResponse.json(conDerivados(detalles[0]))),
  http.delete(`${API}/prestamos/:id`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API}/prestamos/cuotas/:id/pagar`, () => new HttpResponse(null, { status: 204 })),
  http.post(
    `${API}/prestamos/cuotas/:id/revertir-pago`,
    () => new HttpResponse(null, { status: 204 }),
  ),
];
