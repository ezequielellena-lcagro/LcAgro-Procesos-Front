import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2.5 pt-4">
        <div className="px-3 pb-1.5 text-[10px] uppercase tracking-[0.14em] text-white/40">
          Procesos
        </div>

        {procesos.map((p, i) =>
          p.kind === "grupo" ? (
            <Grupo key={p.label} label={p.label}>
              {p.procesos.map((h, j) => (
                <ProcesoItem key={h.label} p={h} indice={j} pathname={pathname} />
              ))}
            </Grupo>
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

/**
 * Subconjunto de procesos de un área (p. ej. Logística).
 *
 * Sigue siendo un `<details>` para poder plegarlo, pero el encabezado se lee igual que cualquier
 * otro proceso del menú: mismo cuerpo de letra, mismo color y sin versalitas. Antes usaba el estilo
 * del rótulo "Procesos" (10 px en mayúsculas) y parecía un título de sección, no un proceso más.
 */
function Grupo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details open className="group/grupo">
      <summary className="mb-0.5 flex cursor-pointer list-none items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] leading-tight text-[#cdd9e0] transition-colors hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-3.5 flex-none text-white/45 transition-transform group-open/grupo:rotate-90"
        />
        {label}
      </summary>
      <div className="ml-[18px] border-l border-white/10 pl-2">{children}</div>
    </details>
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
        // Mismo lenguaje que el rail de Áreas: fila plana, sin borde ni fondo propio hasta que
        // está activa o se la pasa por encima. Antes cada proceso era una píldora con marco y
        // fondo, y nueve píldoras seguidas tapaban cuál estaba abierta.
        "mb-0.5 flex items-center rounded-[10px] px-3 py-2 text-[13px] leading-tight transition-colors",
        esRutaActiva(p.to, pathname)
          ? "bg-gradient-to-r from-clementina to-clementina-deep font-semibold text-slate-brand"
          : "text-[#cdd9e0] hover:bg-white/10 hover:text-white",
      )}
    >
      {p.label}
    </NavLink>
  ) : (
    <div
      data-index={indice}
      className="mb-0.5 flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-white/35"
    >
      <span>{p.label}</span>
      <span className="rounded-full border border-white/10 px-1.5 py-px text-[9px] uppercase tracking-wide">
        Próx.
      </span>
    </div>
  );
}
