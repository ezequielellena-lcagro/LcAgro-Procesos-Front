import { Skeleton } from "@/components/ui/skeleton";

export function SemillaSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-card border border-line bg-panel p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
