import { http, HttpResponse } from "msw";
import type {
  ProveedorCatalogoDto,
  ProveedorDto,
  ProveedoresListado,
  TotalesProveedores,
  TramoDto,
} from "@/features/proveedores/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

/** Offsets en meses de los 4 horizontes (espeja CalendarioTramos.OffsetsPorDefecto del backend). */
const OFFSETS = [1, 2, 4, 6];

/** 4 horizontes + la ventana "posterior", que es la que hace cerrar Σ montos = saldo total. */
const CANT_TRAMOS = OFFSETS.length + 1;

const p2 = (n: number) => String(n).padStart(2, "0");

/** yyyy-MM-dd de una fecha LOCAL (no `toISOString`, que se corre un día por timezone). */
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Último día del mes que resulta de correr `offset` meses desde el mes base (mes 1-12). */
function finDeMesCorrido(anio: number, mes: number, offset: number): Date {
  return new Date(anio, mes + offset, 0); // día 0 del mes siguiente = último día del mes
}

const diaSiguiente = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

/** "dd-MM-yyyy". */
const largo = (d: Date) => `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`;

/** "dd-MM": el extremo izquierdo de un rango omite el año cuando los dos extremos caen en el mismo. */
const corto = (d: Date) => `${p2(d.getDate())}-${p2(d.getMonth() + 1)}`;

const rango = (desde: Date, hasta: Date) =>
  `${desde.getFullYear() === hasta.getFullYear() ? corto(desde) : largo(desde)} → ${largo(hasta)}`;

/**
 * Reproduce CalendarioTramos del backend: del mes base salen la fecha base (su último día) y los 4
 * horizontes (último día de base + offset). Los bordes son inclusive, por eso cada tramo arranca al
 * día siguiente del horizonte anterior y las ventanas no se pisan. Se recalcula con el mes base
 * pedido —no hay etiquetas fijas— para que en la demo se vea que el filtro mueve de verdad el
 * calendario.
 */
function calendario(anio: number, mes: number): { fechaBase: string; tramos: TramoDto[] } {
  const h = OFFSETS.map((off) => finDeMesCorrido(anio, mes, off));

  const tramos: TramoDto[] = [
    // Abierto por izquierda: absorbe toda la deuda anterior, incluida la ya vencida.
    { etiqueta: `Hasta ${largo(h[0])}`, desde: null, hasta: iso(h[0]) },
    ...h.slice(1).map((hasta, i) => {
      const desde = diaSiguiente(h[i]);
      return { etiqueta: rango(desde, hasta), desde: iso(desde), hasta: iso(hasta) };
    }),
    // Abierto por derecha: sin él la suma de las ventanas no daría el saldo total.
    { etiqueta: `Posterior a ${largo(h[3])}`, desde: iso(diaSiguiente(h[3])), hasta: null },
  ];

  return { fechaBase: iso(finDeMesCorrido(anio, mes, 0)), tramos };
}

interface ProveedorDemo {
  numero: number;
  denominacion: string;
  /** 5 valores posicionales, alineados con `tramos`. saldoTotal se calcula sumándolos. */
  montos: number[];
  yaVencido: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Numeración deliberadamente SINTÉTICA (90xxx). Las cuentas de proveedor reales de MacroGest son
 * 10xxx, así que ningún número de esta demo puede mapearse a un proveedor del cliente ni volver
 * reversible el seudónimo: la razón social inventada tiene que ser un callejón sin salida, no una
 * etiqueta pegada encima de una cuenta real.
 */
const PRIMER_NUMERO_CURADO = 90001;
const PRIMER_NUMERO_GENERADO = 90101;

// Proveedores de insumo FICTICIOS (nunca razones sociales, cuentas ni saldos reales del cliente:
// los importes de acá son inventados, NO salen de ninguna consulta validada contra la base).
// Estos 12 son casos elegidos a mano: ceros en distintas ventanas, deuda sólo al final, "ya vencido"
// positivo, en cero y negativo (anticipos / notas de crédito).
const CURADOS: ProveedorDemo[] = [
  { denominacion: "Agroquímica del Litoral S.A.", montos: [64250.4, 22180.75, 51900, 73640.2, 0], yaVencido: -35400.6 },
  { denominacion: "Fertilizantes Pampeanos SRL", montos: [120400.5, 44200, 0, 18900.25, 7500], yaVencido: 22100.4 },
  { denominacion: "Semillas del Centro S.A.", montos: [0, 98750.4, 32100, 12000, 0], yaVencido: 0 },
  { denominacion: "Nutrientes del Sur S.A.", montos: [18250.75, 0, 41300.6, 0, 25600], yaVencido: 9800.15 },
  { denominacion: "Protección Vegetal Argentina SRL", montos: [76900, 51230.4, 19870.9, 30400, 11200.55], yaVencido: -14320.8 },
  { denominacion: "Insumos Don Bosco SRL", montos: [9400.3, 12800, 0, 0, 0], yaVencido: 3100.2 },
  { denominacion: "Distribuidora Agro Litoral S.A.", montos: [33500, 27400.6, 15900, 42800.4, 0], yaVencido: 12750 },
  { denominacion: "Cereales y Servicios del Oeste SRL", montos: [0, 0, 64300.25, 21500, 38900], yaVencido: 0 },
  { denominacion: "Bioinsumos Río Cuarto S.A.", montos: [14200.9, 8600, 5400.35, 0, 0], yaVencido: -2400.5 },
  { denominacion: "Maquinaria y Repuestos La Estrella SRL", montos: [42800, 0, 0, 16750.8, 9300], yaVencido: 18400.6 },
  { denominacion: "Lubricantes y Combustibles Aurora S.A.", montos: [61300.45, 33900, 27600, 0, 4800.2], yaVencido: 25100.9 },
  { denominacion: "Envases y Bolsas del Plata SRL", montos: [7800, 4200.75, 0, 3100, 0], yaVencido: 1900.35 },
].map((p, i) => ({ ...p, numero: PRIMER_NUMERO_CURADO + i }));

// Relleno, también FICTICIO: con sólo 12 filas la demo nunca pasaría de la página 1 (pageSize 50) y
// no se podría probar el paginador. Los importes se generan (ver `demoGenerada`), los nombres no.
const NOMBRES_GENERADOS = [
  "Agroservicios Las Tres Lagunas SRL",
  "Ferretería Industrial El Yunque S.A.",
  "Transporte de Granos Km 214 SRL",
  "Neumáticos y Rodados La Huella S.A.",
  "Silos y Estructuras Metálicas Vidal SRL",
  "Herrería y Montajes El Talar S.A.",
  "Repuestos Agrícolas Los Nogales SRL",
  "Electricidad Rural Del Prado S.A.",
  "Riego y Bombas Aguas Claras SRL",
  "Consultora Agronómica Surco Fino S.A.",
  "Laboratorio de Suelos Tierra Viva SRL",
  "Metalúrgica Campo Grande S.A.",
  "Aceites y Grasas Industriales Nova SRL",
  "Papelera y Librería El Sauce S.A.",
  "Seguridad e Higiene Rural SRL",
  "Indumentaria de Trabajo El Overol S.A.",
  "Alambres y Postes La Tranquera SRL",
  "Veterinaria Los Pinos S.A.",
  "Balanceados del Este SRL",
  "Genética Bovina San Anselmo S.A.",
  "Combustibles del Camino SRL",
  "Gomería y Servicios Ruta 8 S.A.",
  "Talleres Mecánicos El Piñón SRL",
  "Refrigeración y Climatización Polar S.A.",
  "Construcciones Rurales El Cimiento SRL",
  "Áridos y Hormigones La Cantera S.A.",
  "Sistemas y Redes Binario SRL",
  "Telefonía y Radios Enlace Sur S.A.",
  "Servicios Contables Balance Fiel SRL",
  "Estudio Jurídico Del Centro SRL",
  "Publicidad y Cartelería Impacto S.A.",
  "Fumigaciones Aéreas Vuelo Bajo SRL",
  "Contratista Rural Siembra Directa S.A.",
  "Cosecha y Servicios La Espiga SRL",
  "Acopio y Logística Puerto Norte S.A.",
  "Balanzas y Básculas Precisión SRL",
  "Insumos Veterinarios Del Oeste S.A.",
  "Plásticos Agrícolas Silobolsa Sur SRL",
  "Semillas Forrajeras La Pradera S.A.",
  "Inoculantes Biotec Rosario SRL",
  "Correctores de Suelo Cal y Yeso S.A.",
  "Máquinas Sembradoras Del Surco SRL",
  "Repuestos Hidráulicos Pistón S.A.",
  "Motores y Bombas Diésel Norte SRL",
  "Servicios de Limpieza Nítido S.A.",
  "Catering y Comedor Rural El Fogón SRL",
];

/**
 * PRNG determinista (xorshift32) sembrado con el número de proveedor: los importes de la demo son
 * inventados pero SIEMPRE los mismos, así una captura de pantalla o un Excel exportado se pueden
 * volver a reproducir.
 */
function generador(semilla: number): () => number {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * "Ya vencido" es un memo contenido en el primer tramo, así que se deriva de él: o no hay nada
 * vencido, o es un saldo a favor (negativo, por anticipos o notas de crédito), o es una porción de
 * lo que vence en la primera ventana. Nunca un positivo que el primer tramo no pueda contener.
 */
function memoYaVencido(primerTramo: number, siguiente: () => number): number {
  const dado = siguiente();
  if (dado < 0.2) return 0;
  if (dado < 0.45) return -r2(1_000 + siguiente() * 45_000);
  return r2(primerTramo * (0.1 + siguiente() * 0.8));
}

function demoGenerada(): ProveedorDemo[] {
  return NOMBRES_GENERADOS.map((denominacion, i) => {
    const numero = PRIMER_NUMERO_GENERADO + i * 3;
    const siguiente = generador(numero);
    const montos = Array.from({ length: CANT_TRAMOS }, () => {
      const hayDeuda = siguiente() >= 0.28; // ~1 de cada 4 ventanas queda vacía
      const monto = r2(2_000 + siguiente() * 138_000);
      return hayDeuda ? monto : 0;
    });
    return { numero, denominacion, montos, yaVencido: memoYaVencido(montos[0], siguiente) };
  });
}

const PROVEEDORES: ProveedorDemo[] = [...CURADOS, ...demoGenerada()];

/**
 * Arma las filas cumpliendo la invariante Σ montos = saldoTotal (igual que el backend). Los importes
 * NO dependen del mes base: el mock no reparte vencimientos por fecha, lo que rueda con el mes son
 * las ventanas y sus etiquetas.
 */
function filas(): ProveedorDto[] {
  return PROVEEDORES.map((p) => ({
    numero: p.numero,
    denominacion: p.denominacion,
    montos: p.montos,
    saldoTotal: r2(p.montos.reduce((s, m) => s + m, 0)),
    yaVencido: p.yaVencido,
  }));
}

function aplicarFiltros(rows: ProveedorDto[], u: URL): ProveedorDto[] {
  const proveedor = Number(u.searchParams.get("proveedor")) || null;
  const q = (u.searchParams.get("q") ?? "").trim().toLowerCase();
  let out = rows;
  if (proveedor !== null) out = out.filter((p) => p.numero === proveedor);
  if (q) {
    out = out.filter(
      (p) => p.denominacion.toLowerCase().includes(q) || String(p.numero).includes(q),
    );
  }
  return [...out].sort((a, b) => b.saldoTotal - a.saldoTotal);
}

/** Totales sobre TODO el set filtrado (no la página), como el backend real. */
function totalizar(rows: ProveedorDto[], cantTramos: number): TotalesProveedores {
  return {
    montos: Array.from({ length: cantTramos }, (_, i) =>
      r2(rows.reduce((s, p) => s + (p.montos[i] ?? 0), 0)),
    ),
    saldoTotal: r2(rows.reduce((s, p) => s + p.saldoTotal, 0)),
    yaVencido: r2(rows.reduce((s, p) => s + p.yaVencido, 0)),
    proveedores: rows.length,
  };
}

/** anio/mes ausentes ⇒ mes en curso (misma regla que el backend). */
function mesBaseDe(u: URL): { anio: number; mes: number } {
  const hoy = new Date();
  return {
    anio: Number(u.searchParams.get("anio")) || hoy.getFullYear(),
    mes: Number(u.searchParams.get("mes")) || hoy.getMonth() + 1,
  };
}

export const proveedoresHandlers = [
  http.get(`${API}/proveedores`, ({ request }) => {
    const u = new URL(request.url);
    const { anio, mes } = mesBaseDe(u);
    const { fechaBase, tramos } = calendario(anio, mes);
    const page = Number(u.searchParams.get("page")) || 1;
    const pageSize = Number(u.searchParams.get("pageSize")) || 50;

    const rows = aplicarFiltros(filas(), u);
    const total = rows.length;
    const totalPages = Math.ceil(total / pageSize);

    const body: ProveedoresListado = {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
      fechaBase,
      tramos,
      totales: totalizar(rows, tramos.length),
    };
    return HttpResponse.json(body);
  }),

  // Catálogo para el combo: todo el universo de proveedores, ordenado por razón social.
  http.get(`${API}/proveedores/catalogo`, () => {
    const lista: ProveedorCatalogoDto[] = PROVEEDORES.map((p) => ({
      numero: p.numero,
      denominacion: p.denominacion,
    })).sort((a, b) => a.denominacion.localeCompare(b.denominacion));
    return HttpResponse.json(lista);
  }),

  // Export .xlsx (demo): el backend real arma las 2 hojas con fórmulas; acá generamos uno válido
  // con los mismos filtros y las fechas reales en los encabezados, para probar la descarga.
  http.get(`${API}/proveedores/export`, async ({ request }) => {
    const u = new URL(request.url);
    const { anio, mes } = mesBaseDe(u);
    const { tramos } = calendario(anio, mes);
    const rows = aplicarFiltros(filas(), u);

    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const FMT = '#,##0.00;(#,##0.00);"-"';
    const num = (value: number) => ({ type: Number, value, format: FMT });
    const blob = await writeXlsxFile(rows, {
      sheet: "Tramos",
      columns: [
        { header: "N°", width: 8, cell: (r: ProveedorDto) => ({ type: Number, value: r.numero }) },
        {
          header: "Proveedor",
          width: 38,
          cell: (r: ProveedorDto) => ({ type: String, value: r.denominacion }),
        },
        ...tramos.map((t, i) => ({
          header: t.etiqueta,
          width: 20,
          cell: (r: ProveedorDto) => num(r.montos[i] ?? 0),
        })),
        { header: "SALDO TOTAL", width: 16, cell: (r: ProveedorDto) => num(r.saldoTotal) },
        { header: "Ya vencido", width: 16, cell: (r: ProveedorDto) => num(r.yaVencido) },
      ],
    }).toBlob();

    const hoy = new Date();
    const sello = `${hoy.getFullYear()}${p2(hoy.getMonth() + 1)}${p2(hoy.getDate())}`;
    return new HttpResponse(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Proyeccion_Proveedores_${sello}.xlsx"`,
      },
    });
  }),
];
