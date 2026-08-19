import type { AFijarDetalleDto } from "../types";

export interface CompradorAFijar {
  comprador: string;
  tn: number;
  contratos: number;
  /** Toneladas con fijación ya vencida dentro de este comprador. */
  vencidoTn: number;
}

/** Agrupa el "a fijar" por comprador, de mayor a menor tonelaje. Es el "quién concentra lo pendiente". */
export function porComprador(filas: AFijarDetalleDto[]): CompradorAFijar[] {
  const map = new Map<string, CompradorAFijar>();
  for (const f of filas) {
    const acc = map.get(f.comprador) ?? { comprador: f.comprador, tn: 0, contratos: 0, vencidoTn: 0 };
    acc.tn += f.aFijarTn;
    acc.contratos += 1;
    if (f.estado === "Vencido") acc.vencidoTn += f.aFijarTn;
    map.set(f.comprador, acc);
  }
  return [...map.values()].sort((a, b) => b.tn - a.tn);
}

/** Toneladas a fijar por canal de venta: directa vs. intermediada por corredor. */
export function porCanal(filas: AFijarDetalleDto[]): { directoTn: number; corredorTn: number } {
  return filas.reduce(
    (acc, f) => {
      if (f.directo) acc.directoTn += f.aFijarTn;
      else acc.corredorTn += f.aFijarTn;
      return acc;
    },
    { directoTn: 0, corredorTn: 0 },
  );
}

export interface GrupoAFijar {
  cereal: string;
  exportador: string;
  /** Con quién se gestiona la fijación: el corredor, o "Directo" si se hizo con la exportadora. */
  via: string;
  esDirecto: boolean;
  contratos: number;
  tn: number;
  /** Vencimiento más próximo del grupo; null si ningún contrato tiene fecha. */
  proximoVto: string | null;
  /** Peor estado del grupo: es el que manda para el semáforo. */
  estado: AFijarDetalleDto["estado"];
}

/**
 * Agrupa el "a fijar" por cereal × exportador × vía, como pide la skill. La vía es el eje real de
 * gestión: cuando interviene un corredor la fijación se hace con él, no con la exportadora.
 */
export function porExportador(filas: AFijarDetalleDto[]): GrupoAFijar[] {
  const map = new Map<string, GrupoAFijar>();
  for (const f of filas) {
    const via = f.directo ? "Directo" : (f.corredor ?? "Corredor");
    const clave = `${f.cereal}|${f.comprador}|${via}`;
    const acc = map.get(clave) ?? {
      cereal: f.cereal,
      exportador: f.comprador,
      via,
      esDirecto: f.directo,
      contratos: 0,
      tn: 0,
      proximoVto: null,
      estado: "SinFecha" as AFijarDetalleDto["estado"],
    };
    acc.contratos += 1;
    acc.tn += f.aFijarTn;
    // El vencimiento del grupo es el más próximo: es la fecha que obliga a actuar.
    if (f.vtoFijacion && (acc.proximoVto === null || f.vtoFijacion < acc.proximoVto))
      acc.proximoVto = f.vtoFijacion;
    if (ORDEN_ESTADO[f.estado] < ORDEN_ESTADO[acc.estado]) acc.estado = f.estado;
    map.set(clave, acc);
  }
  return [...map.values()].sort((a, b) => b.tn - a.tn);
}

/** Peso de severidad del semáforo, para ordenar la tabla por riesgo (lo vencido primero). */
const ORDEN_ESTADO: Record<AFijarDetalleDto["estado"], number> = {
  Vencido: 0,
  Naranja: 1,
  Amarillo: 2,
  SinFecha: 3,
  Verde: 4,
};

/** Ordena el detalle por riesgo de fijación: primero lo vencido, después lo que vence antes, y a igualdad, más tn. */
export function porRiesgo(filas: AFijarDetalleDto[]): AFijarDetalleDto[] {
  return [...filas].sort(
    (a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || b.aFijarTn - a.aFijarTn,
  );
}
