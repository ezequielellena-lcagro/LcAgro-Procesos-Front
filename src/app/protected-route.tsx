import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import type { RolNombre } from "@/features/auth/types";
import { ForbiddenPage } from "@/shared/components/forbidden-page";
import { SessionSkeleton } from "@/shared/components/session-skeleton";

interface Props {
  /** Si se pasa, además de sesión exige tener alguno de estos roles. */
  roles?: RolNombre[];
}

export function ProtectedRoute({ roles }: Props) {
  const { status, hasAnyRole } = useAuth();
  const location = useLocation();

  // Mientras se rehidrata la sesión (refresh), no parpadear el login.
  if (status === "loading") return <SessionSkeleton />;

  // Sin sesión → login, recordando a dónde quería ir.
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Con sesión pero sin el rol requerido → 403 dentro del layout (no al login: ya está logueado).
  if (roles && !hasAnyRole(roles)) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
}
