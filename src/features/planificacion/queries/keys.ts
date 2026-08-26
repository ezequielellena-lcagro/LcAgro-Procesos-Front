import type { ObjetivosConsulta, SegmentacionFiltros, TableroFiltros } from "../types";

export const planificacionKeys = {
  all: ["planificacion-vendedores"] as const,

  tableros: () => [...planificacionKeys.all, "tablero"] as const,
  tablerosCampania: (campania: string) => [...planificacionKeys.tableros(), campania] as const,
  tablero: (filtros: TableroFiltros) =>
    [...planificacionKeys.tablerosCampania(filtros.campania), filtros] as const,

  detalles: () => [...planificacionKeys.all, "detalle-productor"] as const,
  detallesCampania: (campania: string) => [...planificacionKeys.detalles(), campania] as const,
  detalle: (productorId: number | undefined, campania: string) =>
    [...planificacionKeys.detallesCampania(campania), productorId ?? null] as const,

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
