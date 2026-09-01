export const stockCerealKeys = {
  all: ["stock-cereal"] as const,
  reporte: (campania?: string) => [...stockCerealKeys.all, "reporte", campania ?? "todas"] as const,
};
