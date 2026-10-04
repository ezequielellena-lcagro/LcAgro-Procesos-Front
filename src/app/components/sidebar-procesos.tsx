import { env } from "@/lib/env";
import { NavLink, useLocation } from "react-router-dom";
import type { RolNombre } from "@/features/auth/types";
import { cn } from "@/lib/utils";
import { esRutaActiva, procesosVisibles, type Area, type Proceso } from "../navigation";

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
        <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-white/40">
          Procesos
        </div>

        {procesos.map((p, i) =>
          p.kind === "grupo" ? (
            <details key={p.label} open className="mb-3 rounded-lg border border-white/10 p-2">
              <summary className="cursor-pointer px-1 pb-2 text-sm font-semibold text-white">
                {p.label}
              </summary>
              <div className="pl-2">
                {p.procesos.map((h, j) => (
                  <ProcesoItem key={h.label} p={h} indice={j} pathname={pathname} />
                ))}
              </div>
            </details>
          ) : (
            <ProcesoItem key={p.label} p={p} indice={i} pathname={pathname} />
          ),
        )}
      </div>

      <div className="flex-none p-3">
        <div className="rounded-xl border border-white/10 bg-white/10 p-[13px] text-xs text-[#cdd9e0]">
          <span className="mr-1.5 inline-block size-[7px] rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(95,208,138,0.2)]" />
          <b className="font-display text-white">
            {env.useMocks ? "Vista de demostración" : "Fuentes de datos"}
          </b>
          <div className="mt-1 text-slate-soft">
            {env.useMocks ? "Referencias ficticias" : "MacroGest · solo lectura"}
          </div>
        </div>
      </div>
    </aside>
  );
}

function ProcesoItem({
  p,
  indice,
  pathname,
}: {
  p: Exclude<Proceso, { kind: "grupo" }>;
  indice: number;
  pathname: string;
}) {
  return p.kind === "activo" ? (
    <NavLink
      to={p.to}
      className={cn(
        "mb-[7px] flex rounded-[10px] border px-3 py-2.5 text-[13px] leading-tight transition-colors",
        esRutaActiva(p.to, pathname)
          ? "border-transparent bg-clementina font-semibold text-slate-brand"
          : "border-white/10 bg-white/5 text-[#cdd9e0] hover:bg-white/10 hover:text-white",
      )}
    >
      {p.label}
    </NavLink>
  ) : (
    <div
      data-index={indice}
      className="mb-[7px] flex justify-between gap-2 px-3 py-2 text-[13px] text-white/35"
    >
      <span>{p.label}</span>
      <span className="text-[9px]">Próx.</span>
    </div>
  );
}
