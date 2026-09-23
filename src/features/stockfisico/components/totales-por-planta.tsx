import { numero } from "@/shared/format/format";

export interface TotalPlanta {
  titulo: string;
  subtitulo: string;
  /** Explicación al pasar el mouse. Por defecto, el propio subtítulo (que puede venir recortado). */
  title?: string;
  tn: number;
  /** Para el total: se pinta con el color de marca para distinguirlo de las componentes que suma. */
  acento?: boolean;
}

/**
 * Tira con el total de cada componente del stock físico (plantas 15/20/10, silobolsa) y su suma.
 *
 * Es el encabezado de la solapa Existencia, y a propósito más liviana que una tira de KpiCard: el
 * desglose por cereal de cada planta está en la tabla "Consolidado por cereal y planta", justo
 * abajo, que además repite estos mismos totales en su pie. Antes esto eran cuatro tarjetas con ese
 * desglose —la misma información dos veces, y a 1440px la cuarta caía sola a una segunda fila—.
 */
export function TotalesPorPlanta({ items }: { items: TotalPlanta[] }) {
  return (
    // gap-px sobre fondo `line`: las separaciones son el propio fondo asomando entre las celdas.
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card md:grid-cols-3 xl:grid-cols-5">
      {items.map((i) => (
        <div key={i.titulo} className="bg-panel px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{i.titulo}</p>
          <p
            className={
              i.acento
                ? "font-display text-xl font-semibold tabular text-clementina-deep"
                : "font-display text-xl font-semibold tabular text-ink"
            }
          >
            {numero(i.tn)} tn
          </p>
          <p className="truncate text-xs text-ink-soft" title={i.title ?? i.subtitulo}>
            {i.subtitulo}
          </p>
        </div>
      ))}
    </div>
  );
}
