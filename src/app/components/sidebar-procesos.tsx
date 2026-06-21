import { NavLink, useLocation } from "react-router-dom";
import type { RolNombre } from "@/features/auth/types";
import { cn } from "@/lib/utils";
import { esRutaActiva, procesosVisibles, type Area } from "../navigation";

interface Props {
  area: Area;
  roles: RolNombre[];
  hidden: boolean;
}

export function SidebarProcesos({ area, roles, hidden }: Props) {
  const { pathname } = useLocation();
  const procesos = procesosVisibles(area, roles);

  return (
    <aside
      className={cn(
        "no-print hidden h-full flex-none flex-col overflow-hidden bg-slate-2 transition-[width] duration-200 ease-in-out md:flex",
        hidden ? "w-0" : "w-[250px]",
      )}
      aria-hidden={hidden}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2.5 pt-4">
        <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-white/40">Procesos</div>

        {procesos.map((p, i) =>
          p.kind === "activo" ? (
            <NavLink
              key={p.to}
              to={p.to}
              className={({ isActive }) =>
                cn(
                  "mb-[7px] flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[13px] leading-tight transition-colors",
                  isActive || esRutaActiva(p.to, pathname)
                    ? "border-transparent bg-gradient-to-r from-clementina to-clementina-deep font-semibold text-slate-brand"
                    : "border-white/10 bg-white/5 text-[#cdd9e0] hover:border-white/20 hover:bg-white/10 hover:text-white",
                )
              }
            >
              <span className="min-w-0 flex-1">{p.label}</span>
            </NavLink>
          ) : (
            <div
              key={`soon-${i}`}
              className="mb-[7px] flex cursor-default items-start justify-between gap-2 rounded-[10px] border border-white/5 bg-white/5 px-3 py-2.5 text-[13px] leading-tight text-white/35"
            >
              <span className="min-w-0 flex-1">{p.label}</span>
              <em className="mt-px flex-none rounded-[5px] bg-white/10 px-1.5 py-0.5 text-[9px] font-bold not-italic tracking-wide text-slate-soft">
                Próx.
              </em>
            </div>
          ),
        )}
      </div>

      <div className="flex-none p-3">
        <div className="rounded-xl border border-white/10 bg-white/10 p-[13px] text-xs text-[#cdd9e0]">
          <span className="mr-1.5 inline-block size-[7px] rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(95,208,138,0.2)]" />
          <b className="font-display text-white">Base conectada</b>
          <div className="mt-1 text-slate-soft">MacroGest · solo lectura</div>
        </div>
      </div>
    </aside>
  );
}
