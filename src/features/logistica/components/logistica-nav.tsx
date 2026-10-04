import { NavLink } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { env } from "@/lib/env";
import { ROLES_CUPOS, ROLES_FLETE, ROLES_LECTURA } from "../types";
export function LogisticaNav() {
  const { user } = useAuth();
  return (
    <>
      {env.useMocks && (
        <p className="mb-3 rounded-md border border-clementina-deep/40 bg-clementina/10 px-3 py-2 text-xs">
          Demostración · datos ficticios. La operación de esta vista se guarda sólo durante la
          sesión del demo.
        </p>
      )}
      <nav aria-label="Logística" className="mb-5 flex flex-wrap gap-3 text-sm">
        {ROLES_LECTURA.some((r) => user?.roles.includes(r)) && (
          <NavLink
            className="rounded-md border border-line px-3 py-2 aria-[current=page]:bg-clementina"
            to="/logistica/pedidos"
          >
            Pedidos
          </NavLink>
        )}
        {ROLES_CUPOS.some((r) => user?.roles.includes(r)) && (
          <NavLink
            className="rounded-md border border-line px-3 py-2 aria-[current=page]:bg-clementina"
            to="/logistica/cupos"
          >
            Cupos
          </NavLink>
        )}
        {ROLES_CUPOS.some((r) => user?.roles.includes(r)) && (
          <NavLink
            className="rounded-md border border-line px-3 py-2 aria-[current=page]:bg-clementina"
            to="/logistica/cargas"
          >
            Cargas a puerto
          </NavLink>
        )}
        {ROLES_FLETE.some((r) => user?.roles.includes(r)) && (
          <NavLink
            className="rounded-md border border-line px-3 py-2 aria-[current=page]:bg-clementina"
            to="/logistica/flete"
          >
            Flete y camiones
          </NavLink>
        )}
      </nav>
    </>
  );
}
