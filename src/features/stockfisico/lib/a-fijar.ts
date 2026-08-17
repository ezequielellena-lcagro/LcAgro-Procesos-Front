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
