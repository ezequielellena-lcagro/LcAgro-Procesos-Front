import type { StockFilaDto } from "../types";

export interface RenglonEditable {
  loteId: number;
  ubicacionId: number;
  cantidad: number;
}

export type LoteElegible = StockFilaDto & { maximo: number };

const mismaClave = (a: { loteId: number; ubicacionId: number }, b: { loteId: number; ubicacionId: number }) =>
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
