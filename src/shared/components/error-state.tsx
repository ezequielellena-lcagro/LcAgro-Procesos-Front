import { Button } from "@/components/ui/button";
import { toAppError } from "@/lib/api-error";

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = toAppError(error);
  return (
    <div className="rounded-card border border-rojo/30 bg-rojo-bg p-8 text-center shadow-card">
      <p className="font-medium text-rojo">{e.message}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
