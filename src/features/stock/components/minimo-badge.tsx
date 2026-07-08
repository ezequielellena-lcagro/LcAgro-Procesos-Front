import { cn } from "@/lib/utils";

/** Pill que marca un artículo en/por debajo del stock mínimo cargado. */
export function MinimoBadge() {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", "bg-rojo-bg text-rojo")}>
      Bajo mín.
    </span>
  );
}
