/** Pantalla mientras se rehidrata la sesión al cargar la app. */
export function SessionSkeleton() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 animate-spin rounded-full border-2 border-line border-t-clementina-deep" />
        <p className="text-sm text-ink-soft">Cargando sesión…</p>
      </div>
    </div>
  );
}
