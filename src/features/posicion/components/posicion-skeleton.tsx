import { Skeleton } from "@/components/ui/skeleton";

export function PosicionSkeleton({ cards = 4, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-card" />
        ))}
      </div>
      <div className="space-y-2 rounded-card border border-line bg-panel p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
