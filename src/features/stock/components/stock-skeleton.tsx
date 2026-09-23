import { Skeleton } from "@/components/ui/skeleton";

/** Solo la tabla: las solapas y la barra de filtros se dibujan de verdad mientras carga. */
export function StockSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-card border border-line bg-panel p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
