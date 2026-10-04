import type { ClaveCupoErp, CupoErp, Seguimiento } from "../types";
import { datoVigente, decimalErp } from "./seguimiento";

export const INCIDENCIA_LABEL: Record<string, string> = {
  vinculo_pendiente: "Vínculo pendiente",
  referencia_no_encontrada: "Referencia exacta no encontrada",
  erp_no_disponible: "MacroGest no disponible",
  cabecera_pendiente: "Cabecera de plan pendiente",
  cp_pendiente: "Carta de Porte pendiente",
  descarga_pendiente: "Descarga documentada pendiente",
  codigo_diferente: "Código diferente",
  fecha_diferente: "Fecha de carga diferente",
  destino_diferente: "Destino diferente",
  patente_diferente: "Patente diferente",
  kg_carga_diferente: "Peso de carga diferente",
  kg_descarga_diferente: "Peso de descarga diferente",
};
export function referenciaErp(clave: ClaveCupoErp): string {
  return `${clave.contrato} / grupo ${clave.grupo} / cupo ${clave.cupo}`;
}
export function textoPresente(valor: string | null | undefined): boolean {
  return !!valor?.trim();
}
// Presencia ignora espacios; los valores presentes se comparan exactamente, sin normalizar.
export function incidenciasErp(s: Seguimiento, erp: CupoErp): string[] {
  const incidencias: string[] = [];
  if (!erp.tieneCabecera) incidencias.push("cabecera_pendiente");
  if (!erp.tieneCartaPorte) incidencias.push("cp_pendiente");
  if (erp.tieneCartaPorte && !erp.tieneDescarga) incidencias.push("descarga_pendiente");
  if (
    textoPresente(s.cupo.codigoTerminal) &&
    textoPresente(erp.codigoTerminal) &&
    s.cupo.codigoTerminal !== erp.codigoTerminal
  )
    incidencias.push("codigo_diferente");
  if (erp.fechaCarga != null && s.cupo.fechaCarga !== erp.fechaCarga.slice(0, 10))
    incidencias.push("fecha_diferente");
  if (erp.destinoCodigo != null && s.cupo.destinoCodigo !== erp.destinoCodigo)
    incidencias.push("destino_diferente");
  const patente = datoVigente(s, "patente")?.texto;
  if (textoPresente(patente) && textoPresente(erp.patenteChasis) && patente !== erp.patenteChasis)
    incidencias.push("patente_diferente");
  for (const [tipo, peso] of [
    ["kg_carga", erp.kgCargaErp],
    ["kg_descarga", erp.kgDescargaErp],
  ] as const) {
    const propio = datoVigente(s, tipo)?.kilogramos;
    if (propio != null && peso != null) {
      const a = decimalErp(propio),
        b = decimalErp(peso);
      if (a !== null && b !== null && a !== b) incidencias.push(`${tipo}_diferente`);
    }
  }
  return incidencias;
}
