/** Pantalla "en construcción" para procesos cuya feature llega en un milestone posterior. */
export function PlaceholderPage({ title, descripcion }: { title: string; descripcion?: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-panel p-10 text-center shadow-card">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        {descripcion ?? "Pantalla en construcción. Se implementa en el próximo milestone."}
      </p>
    </div>
  );
}
