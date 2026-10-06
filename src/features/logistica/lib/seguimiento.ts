import type { DatoOperativo, Seguimiento, TipoDatoOperativo } from "../types";

export const ESTADO_LABEL: Record<string, string> = {
  por_iniciar: "Por iniciar",
  cargando: "Cargando",
  en_viaje: "En viaje",
  en_puerto: "En puerto",
  calado: "Calado",
  descargado: "Descargado",
};
export const FUENTE_LABEL: Record<string, string> = {
  operador: "Operador",
  cliente: "Cliente",
  balanza: "Balanza",
  agroentregas: "Agroentregas",
  terminal: "Terminal",
  otro: "Otro",
};
export const DATO_LABEL: Record<TipoDatoOperativo, string> = {
  kg_carga: "Peso de carga",
  kg_descarga: "Peso de descarga",
  patente: "Patente",
};
export function datoVigente(s: Seguimiento, tipo: TipoDatoOperativo): DatoOperativo | undefined {
  return s.datosVigentes.find((d) => d.tipo === tipo);
}
export function destinatarioSeguimiento(s: Seguimiento): string {
  const o = s.cupo.otorgamientoVigente;
  return !o
    ? "Sin asignar"
    : o.destinatarioTipo === "propio"
      ? "Propio"
      : (o.clienteNombre ?? `Cliente ${o.clienteNumero}`);
}
export function identificacionSeguimiento(s: Seguimiento): string {
  return `${s.cupo.contratoVenta} · ${s.cupo.codigoTerminal || "Código pendiente"} · ${s.referenciaRecepcion} · fila ${s.cupo.ordinal}`;
}
// Comparación decimal textual: multiplicar un float por 10.000 puede rechazar pesos válidos.
export function decimalEscalado(valor: string): bigint | null {
  const texto = valor.trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(texto)) return null;
  const negativo = texto.startsWith("-");
  const absoluto = negativo ? texto.slice(1) : texto;
  const [entera, decimal = ""] = absoluto.split(".");
  const escala = BigInt(entera) * 10000n + BigInt(decimal.padEnd(4, "0"));
  return negativo ? -escala : escala;
}
function desdeEscala(escala: bigint, posiciones = 4): string {
  const absoluto = escala < 0n ? -escala : escala;
  const divisor = 10n ** BigInt(posiciones);
  const decimales =
    posiciones === 0
      ? ""
      : String(absoluto % divisor)
          .padStart(posiciones, "0")
          .replace(/0+$/, "");
  return `${escala < 0n ? "-" : ""}${absoluto / divisor}${decimales ? `.${decimales}` : ""}`;
}
export function decimalCanonico(valor: string): string | null {
  const escala = decimalEscalado(valor);
  return escala === null ? null : desdeEscala(escala);
}
export function pesoOperativoValido(valor: string): boolean {
  const escala = decimalEscalado(valor);
  if (escala === null) return false;
  return escala > 0n && escala <= 9999999999999999n;
}
export function kgOperativos(valor: string | null): string {
  const canonico = valor === null ? null : decimalCanonico(valor);
  return formatoKg(canonico);
}
function formatoKg(canonico: string | null): string {
  // Celda vacía de una grilla: guion, como en el resto de la app.
  if (canonico === null) return "—";
  const [entera, decimal] = canonico.split(".");
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${miles}${decimal ? `,${decimal}` : ""} kg`;
}
// API administrativa usa texto exacto. Compatibilidad acotada para fixtures pequeños:
// jamás presentamos como exacto un Number extremo que pudo perder precisión al parsearse.
export function decimalErp(valor: string | number): string | null {
  if (typeof valor === "number" && (!Number.isFinite(valor) || Math.abs(valor) >= 1e9)) return null;
  const partes = decimalAdministrativo(String(valor));
  return partes === null ? null : desdeEscala(partes.entero, partes.posiciones);
}
// Decimal .NET permite hasta 28 posiciones. La restricción numeric(16,4) es sólo propia.
function decimalAdministrativo(valor: string): { entero: bigint; posiciones: number } | null {
  if (!/^-?\d+(?:\.\d{1,28})?$/.test(valor)) return null;
  const [entera, fraccion = ""] = valor.split(".");
  const signo = valor.startsWith("-") ? -1n : 1n;
  return {
    entero: signo * BigInt(`${entera.replace("-", "")}${fraccion}`),
    posiciones: fraccion.length,
  };
}
export function kgErp(valor: string | number | null): string {
  return formatoKg(valor === null ? null : decimalErp(valor));
}
export function diferenciaPeso(operativo: string | null, erp: string | number | null): string {
  const oficial = erp === null ? null : decimalErp(erp);
  const a = operativo === null ? null : decimalEscalado(operativo);
  const b = oficial === null ? null : decimalAdministrativo(oficial);
  if (a === null || b === null) return "Sin comparación";
  const posiciones = Math.max(4, b.posiciones);
  const delta =
    a * 10n ** BigInt(posiciones - 4) - b.entero * 10n ** BigInt(posiciones - b.posiciones);
  return `${delta > 0n ? "+" : ""}${formatoKg(desdeEscala(delta, posiciones))}`;
}
export function patenteOperativaValida(texto: string): boolean {
  const v = texto.trim();
  return v.length > 0 && texto.length <= 20 && !tieneControles(texto);
}
function tieneControles(texto: string): boolean {
  return Array.from(texto).some(
    (c) => c.charCodeAt(0) <= 31 || (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159),
  );
}
export function textoOperativoValido(texto: string, maximo: number): boolean {
  return texto.trim().length > 0 && texto.length <= maximo && !tieneControles(texto);
}
