import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream p-6 text-center">
      <div>
        <p className="font-display text-6xl font-semibold text-clementina-deep">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Página no encontrada</h1>
        <p className="mt-1 text-sm text-ink-soft">La ruta que buscás no existe.</p>
        <Link
          to="/"
          className="mt-5 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
