import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UnidadPaginacion } from "@/shared/components/pagination";
import type { EstadoPaginacion } from "../lib/paginacion";

/** Pie de tabla con Anterior / Siguiente, igual que la `Pagination` de las pantallas con total. */
export function Paginacion({
  pagina,
  filasVisibles,
  hayAnterior,
  haySiguiente,
  cargando,
  ir,
  unidad,
}: EstadoPaginacion & { unidad: UnidadPaginacion }) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-ink-soft">
      <span>
        {filasVisibles} {filasVisibles === 1 ? unidad.singular : unidad.plural} en esta página
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hayAnterior || cargando}
          onClick={() => ir(pagina - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden /> Anterior
        </Button>
        <span className="tabular">Página {pagina}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!haySiguiente || cargando}
          onClick={() => ir(pagina + 1)}
        >
          {cargando ? "Cargando…" : "Siguiente"} <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
