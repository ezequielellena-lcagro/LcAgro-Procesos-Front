export const posicionKeys = {
  all: ["posicion"] as const,
  list: (campania: string, cereal?: string, precioMin?: number, precioMax?: number) =>
    [...posicionKeys.all, "list", campania, cereal ?? "todos", precioMin ?? 50, precioMax ?? 700] as const,
  detalle: (cereal?: string, precioMin?: number, precioMax?: number) =>
    [...posicionKeys.all, "detalle", cereal ?? "todos", precioMin ?? 50, precioMax ?? 700] as const,
  descartados: (cereal?: string, precioMin?: number, precioMax?: number) =>
    [...posicionKeys.all, "descartados", cereal ?? "todos", precioMin ?? 50, precioMax ?? 700] as const,
  campanias: () => [...posicionKeys.all, "campanias"] as const,
};

export const ajustesKeys = {
  all: ["ajustes"] as const,
  list: (campania: string) => [...ajustesKeys.all, "list", campania] as const,
  arrastres: () => [...ajustesKeys.all, "arrastre-inicial"] as const,
};
