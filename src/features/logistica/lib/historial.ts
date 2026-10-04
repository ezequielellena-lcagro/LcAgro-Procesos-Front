import { fecha } from "../format";
import { fechaFlotaValida, importeWireFlota, referenciaFlota, textoFlotaValido } from "./flota";
import { fechaHoraArgentina, fechaInstanteArgentina, kg } from "../format";
import { DATO_LABEL, ESTADO_LABEL, FUENTE_LABEL, kgOperativos } from "./seguimiento";
import type { TipoDatoOperativo } from "../types";
const CAMPOS: Record<string, string> = {
  contratoVenta: "Contrato de venta",
  clienteNumero: "Código de productor",
  producto: "Código de cereal",
  campania: "Campaña",
  destinoCodigo: "Código de destino",
  fechaSolicitada: "Fecha solicitada",
  cantidadCupos: "Cantidad de cupos",
  canal: "Canal",
  observacion: "Observación",
  ultimaRespuesta: "Última respuesta",
  recibidos: "Cupos recibidos",
  otorgados: "Cupos otorgados",
  pendientes: "Cupos pendientes",
  estado: "Estado",
  cerradoAl: "Cierre",
  cerradaAl: "Cierre",
  motivoCierre: "Motivo de cierre",
  fechaCarga: "Fecha de carga",
  codigoTerminal: "Código de terminal",
  circuito: "Circuito",
  lugarTipo: "Lugar",
  lugarReferencia: "Referencia del lugar",
  referencia: "Referencia",
  recibidoAl: "Recepción",
  observadoAl: "Momento de respuesta",
  estadoObservado: "Seguimiento",
  cantidad: "Cupos recibidos",
  preventa: "Preventa",
  advertencias: "Advertencias",
  cupos: "Cupos de la tanda",
  destinatarioTipo: "Tipo de destinatario",
  kgEstimados: "Kg estimados",
  vigenteDesde: "Fecha de asignación",
  tipo: "Tipo de dato",
  kilogramos: "Kilogramos operativos",
  texto: "Patente operativa",
  fuente: "Fuente",
  estadoObservadoAl: "Momento del estado observado (Argentina)",
  estadoFuente: "Fuente del estado",
  estadoReferencia: "Referencia del estado",
  registradoAl: "Momento de registro (Argentina)",
  registradoPorId: "Autor del registro",
  motivoCorreccion: "Motivo de corrección",
  anuladoAl: "Momento de anulación (Argentina)",
  anuladoPorId: "Autor de anulación",
  motivoAnulacion: "Motivo de anulación",
  clave: "Referencia MacroGest",
  evidencia: "Evidencia",
  verificadoAl: "Verificado al (Argentina)",
  seguimientoRevision: "Revisión del seguimiento",
};
export interface CampoHistorial {
  campo: string;
  anterior: string;
  nuevo: string;
}
function texto(valor: unknown, campo: string): string {
  if (valor == null) return "Sin dato";
  if (["evidencia", "motivo"].includes(campo) && typeof valor === "string") return valor;
  if (campo === "destinatarioTipo") return valor === "propio" ? "Propio" : "Cliente";
  if (campo === "kgEstimados" && typeof valor === "number") return kg(valor);
  if (campo === "kilogramos" && typeof valor === "string") return kgOperativos(valor);
  // Historia previa ficticia con números pequeños; los nuevos eventos C6 usan texto.
  if (campo === "kilogramos" && typeof valor === "number" && Math.abs(valor) < 1e9)
    return kgOperativos(String(valor));
  if (
    [
      "estadoObservadoAl",
      "observadoAl",
      "registradoAl",
      "anuladoAl",
      "verificadoAl",
      "retiradoAl",
    ].includes(campo) &&
    typeof valor === "string"
  )
    return fechaHoraArgentina(valor);
  if (["registradoPorId", "anuladoPorId"].includes(campo)) return `Usuario ${valor}`;
  if (campo === "estadoObservado" && typeof valor === "string")
    return ESTADO_LABEL[valor] ?? "Sin dato";
  if (["fuente", "estadoFuente"].includes(campo) && typeof valor === "string")
    return FUENTE_LABEL[valor] ?? "Sin dato";
  if (campo === "tipo" && typeof valor === "string")
    return DATO_LABEL[valor as TipoDatoOperativo] ?? "Sin dato";
  if (campo === "vigenteDesde" && typeof valor === "string") return fechaInstanteArgentina(valor);
  if (Array.isArray(valor))
    return campo === "cupos"
      ? `${valor.length} cupos`
      : valor.every((v) => typeof v === "string")
        ? valor.join("; ")
        : "Con datos registrados";
  if (typeof valor === "object") {
    const p = valor as Record<string, unknown>;
    if (campo === "clave")
      return typeof p.contrato === "string" && Number.isInteger(p.grupo) && Number.isInteger(p.cupo)
        ? `${p.contrato} / grupo ${p.grupo} / cupo ${p.cupo}`
        : "Referencia incompleta";
    return `${p.operacion ?? ""} ${p.numero ?? ""}`.trim() || "Con referencia";
  }
  return String(valor).replaceAll("_", " ");
}
export function camposHistorial(json: string, recurso?: string): CampoHistorial[] {
  try {
    const d = JSON.parse(json) as Record<string, unknown>;
    if (recurso === "flota") return camposFlotaHistorial(d);
    if (recurso === "seguimientos" && esEventoCamion(d)) return camposCamionHistorial(d);
    const correccion =
      d.anterior != null && typeof d.anterior === "object" && "clave" in d.anterior && "nuevo" in d;
    const anterior =
      d.anterior && typeof d.anterior === "object" ? (d.anterior as Record<string, unknown>) : {};
    // C7.2 guarda referencias en anterior/nuevo y metadatos comunes fuera de ellas.
    // La allowlist conserva el detalle humano sin exponer el JSON técnico.
    const referenciaNueva =
      d.nuevo && typeof d.nuevo === "object" ? (d.nuevo as Record<string, unknown>) : {};
    const nuevo = correccion
      ? { ...d, clave: referenciaNueva.clave, vinculoId: referenciaNueva.id }
      : ((d.nuevo ?? d.respuesta ?? d) as Record<string, unknown>);
    if (correccion) anterior.vinculoId = anterior.id;
    const campos = correccion
      ? {
          ...CAMPOS,
          vinculoId: "ID del vínculo",
          motivo: "Motivo de corrección",
          retiradoAl: "Retirado al (Argentina)",
        }
      : CAMPOS;
    return Object.keys(campos)
      .filter((k) => k in anterior || k in nuevo)
      .map((k) => ({
        campo:
          k === "cupos" && "otorgamientos" in nuevo
            ? "Cupos asignados"
            : k === "observadoAl" && recurso === "seguimientos"
              ? "Momento observado (Argentina)"
              : campos[k],
        anterior: texto(anterior[k], k),
        nuevo: texto(nuevo[k], k),
      }));
  } catch {
    return [
      { campo: "Detalle", anterior: "Sin dato", nuevo: "No se pudo leer el detalle registrado." },
    ];
  }
}

function referenciaCamion(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}
function esEventoCamion(d: Record<string, unknown>) {
  return [d.anterior, d.nuevo].some((v) => {
    const r = referenciaCamion(v);
    return "fichaId" in r || "versionId" in r;
  });
}
function camposCamionHistorial(d: Record<string, unknown>): CampoHistorial[] {
  const anterior = referenciaCamion(d.anterior),
    nuevo = referenciaCamion(d.nuevo);
  const presentar = (valor: unknown, campo: string) => {
    if (campo === "patenteChasis") return typeof valor === "string" ? valor : "Sin camión elegido";
    if (campo === "importeReferencia")
      return importeWireFlota(valor) ? referenciaFlota(valor, null) : "Sin referencia";
    if (campo === "revision")
      return typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0
        ? String(valor)
        : "Sin dato";
    if (campo === "vigenteDesde") return fechaFlotaValida(valor) ? fecha(valor) : "Sin dato";
    if (campo === "moneda") return valor === "ARS" || valor === "USD" ? valor : "Sin dato";
    return typeof valor === "string" && textoFlotaValido(valor, 500) ? valor : "Sin dato";
  };
  const campos: Record<string, string> = {
    patenteChasis: "Camión elegido",
    patenteAcoplado: "Patente de acoplado",
    conductor: "Conductor",
    transportista: "Transportista",
    importeReferencia: "Importe de referencia",
    moneda: "Moneda",
    vigenteDesde: "Vigente desde",
    fichaId: "Ficha elegida",
    versionId: "Versión elegida",
    revision: "Revisión de la ficha",
  };
  return [
    ...Object.entries(campos).map(([campo, titulo]) => ({
      campo: titulo,
      anterior: presentar(anterior[campo], campo),
      nuevo: presentar(nuevo[campo], campo),
    })),
    { campo: "Motivo", anterior: "Sin dato", nuevo: presentar(d.motivo, "motivo") },
  ];
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
