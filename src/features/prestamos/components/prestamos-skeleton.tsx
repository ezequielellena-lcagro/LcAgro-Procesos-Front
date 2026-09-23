import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder de carga. */
export function PrestamosSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Solapas y barra de filtros: lo que aparece arriba de la tabla cuando terminan los datos. */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-16 w-full rounded-card" />
      <div className="space-y-2 rounded-card border border-line bg-panel p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
