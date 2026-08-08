import { ivaSugerido } from "./iva";

export interface FilaCuota {
  nroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  iva: number;
  observacion?: string | null;
}

/** Redondeo a 2 decimales: sin esto los totales arrastran el error binario del punto flotante. */
function a2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Aplica un cambio a una fila del cronograma, autocompletando el IVA al 12 % del interés.
 *
 * La regla para no pisar al usuario es **"si no lo tocaste, lo sigo calculando yo"**: el IVA se
 * recalcula sólo cuando el que hay coincide con el sugerido del interés ANTERIOR. Si el usuario
 * lo cargó a mano (caso real: los préstamos con tasa subsidiada traen el IVA del cuadro de marcha
 * del banco, que no es el 12 %), se respeta aunque después se corrija el interés.
 */
export function aplicarCambio(fila: FilaCuota, cambio: Partial<FilaCuota>): FilaCuota {
  const actualizada = { ...fila, ...cambio };

  const cambioElInteres = cambio.interes !== undefined && cambio.interes !== fila.interes;
  if (!cambioElInteres) return actualizada;

  const ivaLoPusoElUsuario = fila.iva !== ivaSugerido(fila.interes);
  if (ivaLoPusoElUsuario) return actualizada;

  return { ...actualizada, iva: ivaSugerido(actualizada.interes) };
}

export interface TotalesCronograma {
  capital: number;
  interes: number;
  iva: number;
  total: number;
}

/** Totales del cronograma que se está editando, para el pie del editor. */
export function totales(filas: FilaCuota[]): TotalesCronograma {
  const capital = a2(filas.reduce((s, f) => s + f.capital, 0));
  const interes = a2(filas.reduce((s, f) => s + f.interes, 0));
  const iva = a2(filas.reduce((s, f) => s + f.iva, 0));
  return { capital, interes, iva, total: a2(capital + interes + iva) };
}

/** Total de una cuota: la única fórmula de la planilla. */
export function totalCuota(f: FilaCuota): number {
  return a2(f.capital + f.interes + f.iva);
}
