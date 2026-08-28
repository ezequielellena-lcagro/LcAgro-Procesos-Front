import type {
  CorteConsultaPlanificacion,
  ObjetivosConsulta,
  SegmentacionFiltros,
  TableroFiltros,
} from "../types";

export const CORTE_VIVO_PLANIFICACION: CorteConsultaPlanificacion = { modo: "vivo" };

export const planificacionKeys = {
  all: ["planificacion-vendedores"] as const,

  tableros: () => [...planificacionKeys.all, "tablero"] as const,
  tablerosCampania: (campania: string) => [...planificacionKeys.tableros(), campania] as const,
  tablero: (
    filtros: TableroFiltros,
    corte: CorteConsultaPlanificacion = CORTE_VIVO_PLANIFICACION,
  ) =>
    [
      ...planificacionKeys.tablerosCampania(filtros.campania),
      claveCortePlanificacion(corte),
      filtros,
    ] as const,

  detalles: () => [...planificacionKeys.all, "detalle-productor"] as const,
  detallesCampania: (campania: string) => [...planificacionKeys.detalles(), campania] as const,
  detalle: (
    productorId: number | undefined,
    campania: string,
    corte: CorteConsultaPlanificacion = CORTE_VIVO_PLANIFICACION,
  ) =>
    [
      ...planificacionKeys.detallesCampania(campania),
      claveCortePlanificacion(corte),
      productorId ?? null,
    ] as const,

  snapshots: () => [...planificacionKeys.all, "snapshots"] as const,
  listadoSnapshots: (campania: string, desde?: string, hasta?: string) =>
    [...planificacionKeys.snapshots(), campania, desde ?? null, hasta ?? null] as const,

  segmentaciones: () => [...planificacionKeys.all, "segmentacion"] as const,
  segmentacionesCampania: (campania: string) =>
    [...planificacionKeys.segmentaciones(), campania] as const,
  segmentacion: (filtros: SegmentacionFiltros) =>
    [...planificacionKeys.segmentacionesCampania(filtros.campania), "listado", filtros] as const,
  matriz: (campania: string) =>
    [...planificacionKeys.segmentacionesCampania(campania), "matriz"] as const,

  objetivos: () => [...planificacionKeys.all, "objetivos"] as const,
  objetivosCampania: (campania: string) => [...planificacionKeys.objetivos(), campania] as const,
  objetivosVigentes: (campania: string) =>
    [...planificacionKeys.objetivosCampania(campania), "vigente"] as const,
  objetivo: (consulta: ObjetivosConsulta) =>
    consulta.vigenteEn
      ? ([
          ...planificacionKeys.objetivosCampania(consulta.campania),
          "historico",
          consulta.vigenteEn,
          consulta.linea ?? "todas",
        ] as const)
      : ([
          ...planificacionKeys.objetivosVigentes(consulta.campania),
          consulta.linea ?? "todas",
        ] as const),
};

export function claveCortePlanificacion(corte: CorteConsultaPlanificacion): string {
  if (corte.modo === "vivo") return "vivo";
  if (corte.modo === "snapshot-pendiente") {
    return `snapshot:${corte.snapshotId}:sin-metadatos`;
  }
  return `snapshot:${corte.snapshot.id}:${corte.snapshot.sha256}`;
}
