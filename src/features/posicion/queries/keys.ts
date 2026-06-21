export const posicionKeys = {
  all: ["posicion"] as const,
  list: (campania: string, cereal?: string) =>
    [...posicionKeys.all, "list", campania, cereal ?? "todos"] as const,
  campanias: () => [...posicionKeys.all, "campanias"] as const,
};

export const ajustesKeys = {
  all: ["ajustes"] as const,
  list: (campania: string) => [...ajustesKeys.all, "list", campania] as const,
};
