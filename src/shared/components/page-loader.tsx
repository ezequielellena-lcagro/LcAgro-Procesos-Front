/** Fallback de Suspense mientras se carga el chunk de una página (code-splitting por ruta). */
export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="size-8 animate-spin rounded-full border-2 border-line border-t-clementina-deep" />
    </div>
  );
}
