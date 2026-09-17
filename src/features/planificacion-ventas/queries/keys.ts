export const planificacionKeys = {
  all: ["planificacion-ventas"] as const,
  contexto: () => [...planificacionKeys.all, "contexto"] as const,
  vendedores: () => [...planificacionKeys.all, "vendedores"] as const,
  consolidado: (campania: string, vendedorId: number | undefined, sucursalId: number | undefined) =>
    [...planificacionKeys.all, "consolidado", campania, vendedorId ?? null, sucursalId ?? null] as const,
  plan: (campania: string, vendedorId: number | undefined, incluirSinMovimiento: boolean) =>
    [
      ...planificacionKeys.all,
      "plan-siembra",
      campania,
      vendedorId ?? null,
      incluirSinMovimiento,
    ] as const,
};
