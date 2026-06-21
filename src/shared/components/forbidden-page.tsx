import { Link } from "react-router-dom";

/** 403: hay sesión pero el rol no alcanza para esta sección (se renderiza dentro del layout). */
export function ForbiddenPage() {
  return (
    <div className="rounded-card border border-line bg-panel p-10 text-center shadow-card">
      <p className="font-display text-5xl font-semibold text-clementina-deep">403</p>
      <h1 className="mt-2 font-display text-xl font-semibold text-ink">Sin permiso</h1>
      <p className="mt-1 text-sm text-ink-soft">Tu rol no tiene acceso a esta sección.</p>
      <Link
        to="/"
        className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
