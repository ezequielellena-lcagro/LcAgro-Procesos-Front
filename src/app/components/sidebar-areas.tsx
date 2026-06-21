import { Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { RolNombre } from "@/features/auth/types";
import { cn } from "@/lib/utils";
import type { Area } from "../navigation";
import { BrandLogo } from "./brand-logo";

interface Props {
  areas: Area[];
  areaActivaId: string;
  collapsed: boolean;
  onToggle: () => void;
  roles: RolNombre[];
  mobileOpen: boolean;
  onNavigate: () => void;
}

export function SidebarAreas({
  areas,
  areaActivaId,
  collapsed,
  onToggle,
  roles,
  mobileOpen,
  onNavigate,
}: Props) {
  return (
    <aside
      className={cn(
        "no-print z-40 flex h-full flex-none flex-col overflow-hidden bg-slate-brand duration-200",
        // Móvil: drawer fijo que entra/sale. Desktop: columna estática con ancho según colapso.
        "fixed inset-y-0 left-0 w-60 transition-transform md:static md:translate-x-0 md:transition-[width]",
        collapsed ? "md:w-[70px]" : "md:w-60",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex h-[62px] flex-none items-center border-b border-white/10 px-4">
        <BrandLogo collapsed={collapsed} />
      </div>

      <div className={cn("flex items-center justify-between px-3 pb-1.5 pt-3.5", collapsed && "md:justify-center md:px-0")}>
        {!collapsed && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">Áreas</span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          aria-expanded={!collapsed}
          className="hidden size-[30px] place-items-center rounded-lg text-slate-soft hover:bg-white/10 hover:text-white md:grid"
        >
          <Menu className="size-[18px]" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3 pt-0.5">
        {areas.map((a) => {
          const Icon = a.icon;
          const navegable = a.procesos.find(
            (p) => p.kind === "activo" && p.roles.some((r) => roles.includes(r)),
          );
          const active = a.id === areaActivaId;
          const to = navegable?.kind === "activo" ? navegable.to : "/";
          return (
            <NavLink
              key={a.id}
              to={to}
              title={a.label}
              onClick={onNavigate}
              className={cn(
                "mb-0.5 flex items-center gap-3 whitespace-nowrap rounded-[11px] px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                collapsed && "md:justify-center md:px-0",
                active
                  ? "bg-gradient-to-r from-clementina to-clementina-deep font-semibold text-slate-brand"
                  : "text-[#cdd9e0] hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-5 flex-none opacity-90" />
              <span className={cn("truncate", collapsed && "md:hidden")}>{a.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
