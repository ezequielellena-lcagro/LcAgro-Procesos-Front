export const planificacionKeys = {
  all: ["planificacion-ventas"] as const,
  contexto: () => [...planificacionKeys.all, "contexto"] as const,
  marketShare: (campania: string) => [...planificacionKeys.all, "market-share", campania] as const,
  vendedores: () => [...planificacionKeys.all, "vendedores"] as const,
  sucursales: () => [...planificacionKeys.all, "sucursales"] as const,
  viajantes: () => [...planificacionKeys.all, "viajantes-macrogest"] as const,
  usuariosAsignables: () => [...planificacionKeys.all, "usuarios-asignables"] as const,
  controlPadron: (campania: string) => [...planificacionKeys.all, "control-padron", campania] as const,
  consolidado: (campania: string, vendedorId: number | undefined, sucursalId: number | undefined) =>
    [
      ...planificacionKeys.all,
      "consolidado",
      campania,
      vendedorId ?? null,
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
