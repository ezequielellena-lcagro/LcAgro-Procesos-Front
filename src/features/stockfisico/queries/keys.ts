export const stockCerealKeys = {
  all: ["stock-cereal"] as const,
  reporte: () => [...stockCerealKeys.all, "reporte"] as const,
};
