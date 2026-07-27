import { numero } from "@/shared/format/format";

/** Existencia de un componente (planta 15/20/10 o silobolsa) desglosada por cereal, con su total. */
export function PlantaCard({
  titulo,
  subtitulo,
  filas,
  totalTn,
}: {
  titulo: string;
  subtitulo: string;
  filas: { cereal: string; tn: number }[];
  totalTn: number;
}) {
  const visibles = filas.filter((f) => Math.abs(f.tn) >= 1).sort((a, b) => b.tn - a.tn);

  return (
    <div className="rounded-card border border-line bg-panel p-4 shadow-card">
      <h3 className="font-display text-lg font-semibold text-ink">{titulo}</h3>
      <p className="text-xs uppercase tracking-wide text-ink-soft">{subtitulo}</p>

      <dl className="mt-3 space-y-1 text-sm">
        {visibles.length === 0 ? (
          <p className="text-ink-soft">—</p>
        ) : (
          visibles.map((f) => (
            <div key={f.cereal} className="flex items-center justify-between gap-2">
              <dt className="text-ink-soft">{f.cereal}</dt>
              <dd className="tabular text-ink">{numero(f.tn)}</dd>
            </div>
          ))
        )}
      </dl>

      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 font-semibold">
        <span className="text-ink-soft">Total tn</span>
        <span className="tabular font-display text-clementina-deep">{numero(totalTn)}</span>
      </div>
    </div>
  );
}
