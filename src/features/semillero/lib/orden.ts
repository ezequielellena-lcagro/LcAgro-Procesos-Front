import type { EnvaseSemillero, StockFilaDto } from "../types";
import { envaseEtiqueta, productoEtiqueta, tratamientoEtiqueta } from "./etiquetas-lote";

export interface RenglonEditable {
  loteId: number;
  ubicacionId: number;
  cantidad: number;
}

export type LoteElegible = StockFilaDto & { maximo: number };

interface LoteEnUbicacion {
  loteId: number;
  ubicacionId: number;
}

export const mismaClave = (a: LoteEnUbicacion, b: LoteEnUbicacion) =>
  a.loteId === b.loteId && a.ubicacionId === b.ubicacionId;

/**
 * Lotes × ubicación que se pueden cargar en una orden. Un lote de un Cliente sólo aparece si la
 * orden es de ESE cliente —sin cliente elegido, no aparece ningún lote de cliente— (regla de dueño
 * exclusivo, R4.4). `maximo` es el disponible más lo que ya reservaba la propia orden (al editar,
 * su propia reserva no le compite). El backend vuelve a validar todo dentro de una transacción
 * serializable: esto es para guiar la carga, no para garantizar el resultado.
 */
export function lotesElegibles(
  filas: StockFilaDto[],
  reservaPropia: RenglonEditable[] = [],
  clienteNumero?: number,
): LoteElegible[] {
  return filas
    .filter((f) => f.duenio === "Propio" || f.clienteNumero === clienteNumero)
    .map((f) => {
      const propia = reservaPropia.filter((r) => mismaClave(r, f)).reduce((s, r) => s + r.cantidad, 0);
      return { ...f, maximo: f.disponible + propia };
    })
    .filter((f) => f.maximo > 0);
}

/**
 * De los renglones ya cargados en una orden, cuáles quedan inválidos si se cambia el cliente: los
 * que apuntan a un lote de un Cliente distinto del nuevo (o de cualquier cliente, si se saca el
 * cliente de la orden). Sirve para marcarlos en la UI antes de guardar; el backend los rechazaría
 * con 409 igual.
 */
export function renglonesDeOtroCliente(
  renglones: RenglonEditable[],
  filas: StockFilaDto[],
  clienteNumero: number | undefined,
): RenglonEditable[] {
  return renglones.filter((r) => {
    const fila = filas.find((f) => mismaClave(f, r));
    return fila?.duenio === "Cliente" && fila.clienteNumero !== clienteNumero;
  });
}

export interface TotalesOrden {
  unidades: number;
  kgPropio: number;
  kgCliente: number;
}

/**
 * Totales en vivo del armado de la orden, separando lo vendible (Propio) de lo que sólo se traslada
 * (Cliente) — nunca se suman entre sí (ADR-13).
 */
export function totalesOrden(renglones: RenglonEditable[], filas: StockFilaDto[]): TotalesOrden {
  return renglones.reduce<TotalesOrden>(
    (t, r) => {
      const fila = filas.find((f) => mismaClave(f, r));
      const kg = r.cantidad * (fila?.pesoUnitarioKg ?? 0);
      return {
        unidades: t.unidades + r.cantidad,
        kgPropio: t.kgPropio + (fila?.duenio === "Propio" ? kg : 0),
        kgCliente: t.kgCliente + (fila?.duenio === "Cliente" ? kg : 0),
      };
    },
    { unidades: 0, kgPropio: 0, kgCliente: 0 },
  );
}

/** Renglones que piden más de lo que el elegible correspondiente admite como máximo. */
export function excedidos(renglones: RenglonEditable[], elegibles: LoteElegible[]): RenglonEditable[] {
  return renglones.filter((r) => r.cantidad > (elegibles.find((e) => mismaClave(e, r))?.maximo ?? 0));
}

/** Filtros propios del armado de la orden (R3): sólo acotan lo que se ofrece para agregar. */
export interface FiltrosElegibles {
  variedadId?: number;
  tratada?: boolean;
  envase?: EnvaseSemillero;
}

export function filtrarElegibles(elegibles: LoteElegible[], filtros: FiltrosElegibles): LoteElegible[] {
  return elegibles.filter(
    (e) =>
      (filtros.variedadId === undefined || e.variedadId === filtros.variedadId) &&
      (filtros.tratada === undefined || e.tratada === filtros.tratada) &&
      (filtros.envase === undefined || e.envase === filtros.envase),
  );
}

// Una sola instancia: se usa en cada comparación al ordenar.
const colador = new Intl.Collator("es-AR", { numeric: true, sensitivity: "base" });

/** Las variedades que tienen algo para cargar, sin repetir: las opciones del filtro Variedad. */
export function variedadesDeElegibles(elegibles: LoteElegible[]): { id: number; nombre: string }[] {
  const nombrePorId = new Map(elegibles.map((e) => [e.variedadId, e.variedad]));
  return [...nombrePorId]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => colador.compare(a.nombre, b.nombre));
}

export interface GrupoElegibles {
  clave: string;
  /** "{variedad} · {tratamiento} · {envase} · {campaña}". */
  etiqueta: string;
  lotes: LoteElegible[];
}

/** Orden estable de las opciones: primero el producto, después el lote y la ubicación. */
const CRITERIOS_ORDEN: ((e: LoteElegible) => string)[] = [
  (e) => e.variedad,
  (e) => tratamientoEtiqueta(e.tratada),
  (e) => envaseEtiqueta(e.envase),
  (e) => e.campania,
  (e) => e.loteCodigo,
  (e) => e.ubicacion,
];

function compararElegibles(a: LoteElegible, b: LoteElegible): number {
  for (const criterio of CRITERIOS_ORDEN) {
    const resultado = colador.compare(criterio(a), criterio(b));
    if (resultado !== 0) return resultado;
  }
  return 0;
}

/**
 * Agrupa los elegibles por producto para el selector de renglones (un `<optgroup>` por grupo), como
 * se arma la orden en SeedStock: primero el producto pedido y, dentro, cada lote con su disponible.
 */
export function agruparElegibles(elegibles: LoteElegible[]): GrupoElegibles[] {
  const grupos = new Map<string, GrupoElegibles>();
  for (const e of elegibles.toSorted(compararElegibles)) {
    const clave = `${e.variedadId}|${e.tratada}|${e.envase}|${e.campania}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.lotes.push(e);
    else grupos.set(clave, { clave, etiqueta: `${productoEtiqueta(e)} · ${e.campania}`, lotes: [e] });
  }
  return [...grupos.values()];
}
