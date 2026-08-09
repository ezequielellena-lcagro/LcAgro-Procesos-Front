export const produccionPropiaKeys = {
  all: ["produccion-propia"] as const,
  reporte: (campania: string | undefined) => [...produccionPropiaKeys.all, "reporte", campania] as const,
  campanias: () => [...produccionPropiaKeys.all, "campanias"] as const,
};
