export const planificacionKeys = {
  all: ["planificacion-ventas"] as const,
  contexto: () => [...planificacionKeys.all, "contexto"] as const,
  marketShare: (campania: string) => [...planificacionKeys.all, "market-share", campania] as const,
  vendedores: () => [...planificacionKeys.all, "vendedores"] as const,
  sucursales: () => [...planificacionKeys.all, "sucursales"] as const,
  viajantes: () => [...planificacionKeys.all, "viajantes-macrogest"] as const,
  usuariosAsignables: () => [...planificacionKeys.all, "usuarios-asignables"] as const,
  controlPadron: (campania: string) => [...planificacionKeys.all, "control-padron", campania] as const,
  /** Los ids se ordenan: tildar A y luego B tiene que pegar en la misma entrada que B y luego A. */
  consolidado: (campania: string, vendedorIds: number[], sucursalId: number | undefined) =>
    [
      ...planificacionKeys.all,
      "consolidado",
      campania,
      [...vendedorIds].sort((a, b) => a - b),
      sucursalId ?? null,
    ] as const,
  plan: (campania: string, vendedorId: number | undefined, incluirSinMovimiento: boolean) =>
    [
      ...planificacionKeys.all,
      "plan-siembra",
      campania,
      vendedorId ?? null,
      incluirSinMovimiento,
    ] as const,
};
