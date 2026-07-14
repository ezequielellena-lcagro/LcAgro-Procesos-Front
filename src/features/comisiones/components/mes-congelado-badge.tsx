import { cn } from "@/lib/utils";

/** Pill que indica que el período ya tiene el % de comisión congelado (snapshot generado). */
export function MesCongeladoBadge() {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", "bg-verde-bg text-verde")}>
      Mes congelado
    </span>
  );
}
