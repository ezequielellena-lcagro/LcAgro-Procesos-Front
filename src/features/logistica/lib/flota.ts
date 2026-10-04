import type { FichaFlotaRequest, MonedaFlota } from "../types";

// .NET Char.IsWhiteSpace coincide con Unicode White_Space; FEFF no es espacio.
export function trimFlota(valor: string): string {
  return valor.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
}
// El contrato HTTP conserva null y cadenas vacías como valores distintos.
export function textoFlotaValido(valor: unknown, max: number): valor is string {
  return (
    typeof valor === "string" &&
    trimFlota(valor).length > 0 &&
    trimFlota(valor).length <= max &&
    !/\p{Cc}/u.test(valor)
  );
}
export function cuitFlota(valor: unknown): string | null {
  if (typeof valor !== "string" || /[^0-9. -]/.test(valor)) return null;
  const d = valor.replace(/[. -]/g, "");
  if (
    !/^[0-9]{11}$/.test(d) ||
    /^([0-9])\1{10}$/.test(d) ||
    !["20", "23", "24", "25", "26", "27", "30", "33", "34"].includes(d.slice(0, 2))
  )
    return null;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
  const verificador = (11 - (suma % 11)) % 11;
  return verificador !== 10 && verificador === Number(d[10]) ? d : null;
}
export function importeWireFlota(valor: unknown): valor is string {
  if (
    typeof valor !== "string" ||
    valor.length > 64 ||
    /[^0-9.]/.test(valor) ||
    !/^[0-9]+(?:\.[0-9]{1,4})?$/.test(valor)
  )
    return false;
  const enteros = valor.split(".")[0].replace(/^0+/, "") || "0";
  return enteros.length <= 14;
}
function decimalCanonico(valor: string): string {
  const [entero, decimal = ""] = valor.split(".");
  const e = entero.replace(/^0+/, "") || "0";
  const d = decimal.replace(/0+$/, "");
  return e + (d ? "." + d : "");
}
// Sólo la entrada del formulario acepta coma; jamás se usa para validar HTTP.
export function importeEntradaFlota(valor: string): string | null | undefined {
  if (valor === "") return null;
  if (/\p{Cc}/u.test(valor)) return undefined;
  const wire = trimFlota(valor).replace(",", ".");
  return importeWireFlota(wire) ? decimalCanonico(wire) : undefined;
}
export function fechaFlotaValida(valor: unknown): valor is string {
  if (
    typeof valor !== "string" ||
    valor.length !== 10 ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(valor)
  )
    return false;
  const [y, m, d] = valor.split("-").map(Number);
  const bisiesto = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return y >= 1753 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= dias[m - 1];
}
export function fichaFlotaValida(valor: unknown): valor is FichaFlotaRequest {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const f = valor as Record<string, unknown>;
  if (!textoFlotaValido(f.patenteChasis, 20)) return false;
  for (const [campo, max] of [
    ["patenteAcoplado", 20],
    ["conductor", 150],
    ["transportista", 200],
  ] as const)
    if (f[campo] != null && !textoFlotaValido(f[campo], max)) return false;
  for (const campo of ["cuitConductor", "cuitTransportista"])
    if (f[campo] != null && !cuitFlota(f[campo])) return false;
  return f.importeReferencia == null
    ? f.moneda == null && f.vigenteDesde == null
    : importeWireFlota(f.importeReferencia) &&
        (f.moneda === "ARS" || f.moneda === "USD") &&
        fechaFlotaValida(f.vigenteDesde);
}
export function normalizarFichaFlota(f: FichaFlotaRequest): FichaFlotaRequest {
  return {
    patenteChasis: trimFlota(f.patenteChasis),
    patenteAcoplado: f.patenteAcoplado == null ? null : trimFlota(f.patenteAcoplado),
    conductor: f.conductor == null ? null : trimFlota(f.conductor),
    cuitConductor: cuitFlota(f.cuitConductor),
    transportista: f.transportista == null ? null : trimFlota(f.transportista),
    cuitTransportista: cuitFlota(f.cuitTransportista),
    importeReferencia: f.importeReferencia == null ? null : decimalCanonico(f.importeReferencia),
    moneda: f.moneda ?? null,
    vigenteDesde: f.vigenteDesde ?? null,
  };
}
export function patenteFlotaEquivalente(valor: string): string {
  return mayusculasFlotaInvariantes(valor).replace(/[\p{White_Space}-]/gu, "");
}
export function referenciaFlota(importe: string | null, moneda: MonedaFlota | null): string {
  if (importe === null) return "Sin referencia";
  const [e, d] = importe.split(".");
  const legible = e.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (d ? "," + d : "");
  return (moneda ? moneda + " " : "") + legible;
}

// Casing simple contrastado con .NET 10.0.11 local y Node Unicode 17.
// JS full uppercase puede expandir ß/ligaduras. Las diferencias de versión
// Unicode se mantienen aquí; revalidar esta comparación al actualizar runtimes.
const SIN_CAMBIO_INVARIANTE = new Set([
  0x0131, 0x019b, 0x0264, 0x1c8a, 0xa7cd, 0xa7cf, 0xa7d3, 0xa7d5, 0xa7db,
]);
export function mayusculasFlotaInvariantes(valor: string): string {
  return Array.from(valor, (caracter) => {
    const cp = caracter.codePointAt(0)!;
    if (
      SIN_CAMBIO_INVARIANTE.has(cp) ||
      (cp >= 0x10d70 && cp <= 0x10d85) ||
      (cp >= 0x16ebb && cp <= 0x16ed3)
    )
      return caracter;
    if (
      (cp >= 0x1f80 && cp <= 0x1f87) ||
      (cp >= 0x1f90 && cp <= 0x1f97) ||
      (cp >= 0x1fa0 && cp <= 0x1fa7)
    )
      return String.fromCodePoint(cp + 8);
    if (cp === 0x1fb3 || cp === 0x1fc3 || cp === 0x1ff3) return String.fromCodePoint(cp + 9);
    const upper = caracter.toUpperCase();
    return Array.from(upper).length === 1 ? upper : caracter;
  }).join("");
}
