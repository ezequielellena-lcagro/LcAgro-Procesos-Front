import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { ForbiddenPage } from "@/shared/components/forbidden-page";
import { NAV } from "./navigation";

export function InicioPage({ dashboard }: { dashboard: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;

  if (user.roles.includes("dashboard")) return dashboard;

  const primerProceso = NAV.flatMap((area) => area.procesos).find(
    (proceso) =>
      proceso.kind === "activo" &&
      proceso.to !== "/" &&
      proceso.roles.some((rol) => user.roles.includes(rol)),
  );

  return primerProceso?.kind === "activo" ? (
    <Navigate to={primerProceso.to} replace />
  ) : (
    <ForbiddenPage />
  );
}
