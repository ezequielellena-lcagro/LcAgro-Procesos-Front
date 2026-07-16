import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cómo se llama lo que se pagina. Explícito porque no todo listado pagina "resultados". */
export interface UnidadPaginacion {
  singular: string;
  plural: string;
}

const RESULTADOS: UnidadPaginacion = { singular: "resultado", plural: "resultados" };

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
  unidad = RESULTADOS,
  detalle,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
  /** Qué cuenta `total`. Default: resultado(s). */
  unidad?: UnidadPaginacion;
  /** Aclaración opcional al lado del conteo (p. ej. cuántas filas se ven en la página). */
  detalle?: string;
}) {
  return (
    <div className="no-print flex items-center justify-between gap-3 px-1 py-3 text-sm text-ink-soft">
      <span>
        {total} {total === 1 ? unidad.singular : unidad.plural}
        {detalle ? ` · ${detalle}` : ""}
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="size-4" /> Anterior
        </Button>
        <span className="tabular">
          Página {page} de {Math.max(totalPages, 1)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Siguiente <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
