import { ChevronLeft } from "lucide-react";
import { Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/shared/components/page-loader";
import { usePersistedFlag } from "@/shared/hooks/use-persisted-flag";
import { SidebarAreas } from "./components/sidebar-areas";
import { SidebarProcesos } from "./components/sidebar-procesos";
import { Topbar } from "./components/topbar";
import { areaActivaPorPath, NAV } from "./navigation";

export function AppLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [areasCollapsed, setAreasCollapsed] = usePersistedFlag("ui.areasCollapsed");
  const [procHidden, setProcHidden] = usePersistedFlag("ui.procHidden");
  const [mobileNav, setMobileNav] = useState(false);

  if (!user) return null; // ProtectedRoute garantiza sesión; esto solo conforma a TS.

  const areaActiva = areaActivaPorPath(pathname) ?? NAV[0];

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-cream">
      {/* Scrim del drawer móvil */}
      {mobileNav && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={() => setMobileNav(false)}
        />
      )}

      <SidebarAreas
        areas={NAV}
        areaActivaId={areaActiva.id}
        collapsed={areasCollapsed}
        onToggle={() => setAreasCollapsed((c) => !c)}
        roles={user.roles}
        mobileOpen={mobileNav}
        onNavigate={() => setMobileNav(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar area={areaActiva} onMobileMenu={() => setMobileNav(true)} />
        <div className="flex min-h-0 flex-1">
          <SidebarProcesos area={areaActiva} roles={user.roles} hidden={procHidden} />
          <div className="relative h-full min-w-0 flex-1">
            <button
              type="button"
              aria-label={procHidden ? "Mostrar procesos" : "Ocultar procesos"}
              aria-expanded={!procHidden}
              onClick={() => setProcHidden((h) => !h)}
              className="no-print absolute left-[-15px] top-[13px] z-50 hidden size-[30px] place-items-center rounded-full border border-line bg-panel text-slate-brand shadow-[0_4px_12px_-4px_rgba(33,48,58,.32)] transition hover:scale-110 hover:border-clementina-deep hover:text-clementina-deep md:grid"
            >
              <ChevronLeft className={cn("size-[15px] transition-transform", procHidden && "rotate-180")} />
            </button>
            <div className="app-scroll h-full overflow-y-auto">
              <div className="mx-auto w-full px-4 pb-16 pt-6 md:px-6">
                <Suspense fallback={<PageLoader />}>
                  <Outlet />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
