export function EmptyState({ mensaje }: { mensaje: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-panel p-10 text-center text-sm text-ink-soft shadow-card">
      {mensaje}
    </div>
  );
}
