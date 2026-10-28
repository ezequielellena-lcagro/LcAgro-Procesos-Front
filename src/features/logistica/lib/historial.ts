import { fecha, fechaHoraArgentina, fechaInstanteArgentina } from "../format";
import { referenciaFlota } from "./flota";
const CAMPOS: Record<string, string> = {
  contratoVenta: "Contrato de venta",
  contrato: "Contrato de venta",
  plan: "Plan de carga",
  cupo: "Cupo",
  clienteNumero: "Código de productor",
  producto: "Código de cereal",
  campania: "Campaña",
  destinoCodigo: "Código de destino",
  fechaSolicitada: "Fecha solicitada",
  cantidadCupos: "Cantidad de cupos",
  canal: "Canal",
  observacion: "Observación",
  ultimaRespuesta: "Última respuesta",
  otorgados: "Cupos otorgados",
  pendientes: "Cupos pendientes",
  estado: "Estado",
  cerradoAl: "Cierre",
  cerradaAl: "Cierre",
  motivoCierre: "Motivo de cierre",
  referencia: "Referencia",
  observadoAl: "Momento de respuesta",
  preventa: "Preventa",
  advertencias: "Advertencias",
  otorgamientos: "Cupos otorgados en esta operación",
  vigenteDesde: "Fecha de otorgamiento",
  vigenteHasta: "Deshecho al",
  motivoDeshecho: "Motivo",
  camion: "Camión (Flete)",
  seCargaEnPlanta: "Dónde se carga",
};
export interface CampoHistorial {
  campo: string;
  anterior: string;
  nuevo: string;
}
function texto(valor: unknown, campo: string): string {
  if (valor == null) return "Sin dato";
  if (["motivo", "motivoDeshecho"].includes(campo) && typeof valor === "string") return valor;
  if (["fechaSolicitada", "fechaCarga"].includes(campo) && typeof valor === "string")
    return fecha(valor);
  if (campo === "seCargaEnPlanta") return valor === true ? "En planta" : "En campo";
  if (["observadoAl", "registradoAl"].includes(campo) && typeof valor === "string")
    return fechaHoraArgentina(valor);
  if (campo === "registradoPorId") return `Usuario ${valor}`;
  if (["vigenteDesde", "vigenteHasta"].includes(campo) && typeof valor === "string")
    return fechaInstanteArgentina(valor);
  if (Array.isArray(valor))
    return campo === "otorgamientos"
      ? `${valor.length} cupos`
      : valor.every((v) => typeof v === "string")
        ? valor.join("; ")
        : "Con datos registrados";
  if (typeof valor === "object") {
    const p = valor as Record<string, unknown>;
    if (campo === "camion")
      return typeof p.patenteChasis === "string" ? p.patenteChasis : "Sin camión";
    return `${p.operacion ?? ""} ${p.numero ?? ""}`.trim() || "Con referencia";
  }
  return String(valor).replaceAll("_", " ");
}
export function camposHistorial(json: string, recurso?: string): CampoHistorial[] {
  try {
    const d = JSON.parse(json) as Record<string, unknown>;
    if (recurso === "flota") return camposFlotaHistorial(d);
    const anterior =
      d.anterior && typeof d.anterior === "object" ? (d.anterior as Record<string, unknown>) : {};
    // Los eventos de otorgamiento guardan el registro completo dentro de `otorgamiento`.
    const nuevo = (d.nuevo ?? d.respuesta ?? d.otorgamiento ?? d) as Record<string, unknown>;
    return Object.keys(CAMPOS)
      .filter((k) => k in anterior || k in nuevo)
      .map((k) => ({
        campo: CAMPOS[k],
        anterior: texto(anterior[k], k),
        nuevo: texto(nuevo[k], k),
      }));
  } catch {
    return [
      { campo: "Detalle", anterior: "Sin dato", nuevo: "No se pudo leer el detalle registrado." },
    ];
  }
}

const CAMPOS_FLOTA: Record<string, string> = {
  patenteChasis: "Patente de chasis",
  patenteAcoplado: "Patente de acoplado",
  conductor: "Conductor",
  cuitConductor: "CUIT del conductor",
  transportista: "Transportista",
  cuitTransportista: "CUIT del transportista",
  importeReferencia: "Importe de referencia",
  moneda: "Moneda",
  vigenteDesde: "Vigente desde",
  activo: "Estado de la ficha",
  revision: "Revisión",
  versionId: "ID de versión",
  registradoAl: "Momento de registro (Argentina)",
  registradoPorId: "Autor del registro",
  motivo: "Motivo",
};
function versionFlota(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const v = valor as Record<string, unknown>;
  const ficha = v.ficha && typeof v.ficha === "object" && !Array.isArray(v.ficha) ? v.ficha : {};
  return {
    ...ficha,
    activo: v.activo,
    revision: v.revision,
    versionId: v.id,
    registradoAl: v.registradoAl,
    registradoPorId: v.registradoPorId,
  };
}
function camposFlotaHistorial(d: Record<string, unknown>): CampoHistorial[] {
  const anterior = versionFlota(d.anterior);
  const nuevo = { ...versionFlota(d.nuevo), motivo: d.motivo };
  const presentar = (valor: unknown, campo: string) => {
    if (valor == null) return "Sin dato";
    if (campo === "activo")
      return valor === true ? "Activa" : valor === false ? "Inactiva" : "Sin dato";
    if (campo === "vigenteDesde") return typeof valor === "string" ? fecha(valor) : "Sin dato";
    if (campo === "importeReferencia")
      return typeof valor === "string" ? referenciaFlota(valor, null) : "Sin dato";
    return texto(valor, campo);
  };
  return Object.keys(CAMPOS_FLOTA)
    .filter((k) => k in anterior || k in nuevo)
    .map((k) => ({
      campo: CAMPOS_FLOTA[k],
      anterior: presentar(anterior[k], k),
      nuevo: presentar((nuevo as Record<string, unknown>)[k], k),
    }));
}
