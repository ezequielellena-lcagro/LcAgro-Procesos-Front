import { LogOut, Menu, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { iniciales } from "@/shared/format/iniciales";
import { tituloProcesoPorPath, type Area } from "../navigation";

export function Topbar({ area, onMobileMenu }: { area: Area; onMobileMenu: () => void }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const titulo = tituloProcesoPorPath(area, pathname) ?? area.label;

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="no-print flex h-[62px] flex-none items-center gap-3.5 border-b border-white/10 bg-slate-brand px-4 md:px-6">
      <button
        type="button"
        onClick={onMobileMenu}
        aria-label="Abrir menú"
        className="grid size-9 flex-none place-items-center rounded-md text-slate-soft hover:bg-white/10 hover:text-white md:hidden"
      >
        <Menu className="size-5" />
      </button>
      <nav className="flex min-w-0 items-center gap-2.5 text-[15px]" aria-label="Ruta actual">
        <span className="hidden font-medium text-slate-soft sm:inline">{area.area}</span>
        <span className="hidden text-white/25 sm:inline">/</span>
        <span className="truncate font-display text-[17px] font-semibold tracking-tight text-white">{titulo}</span>
      </nav>

      <div className="flex-1" />

      <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12.5px] font-medium text-slate-soft sm:inline-flex">
        <Sparkles className="size-3.5 text-clementina" />
        Campaña <b className="ml-1 text-white">2025-2026</b>
      </span>

      <div
        className="grid size-[38px] place-items-center rounded-[10px] bg-gradient-to-br from-clementina to-clementina-deep text-sm font-bold text-slate-brand"
        title={user?.nombre}
      >
        {iniciales(user?.nombre ?? "")}
      </div>

      <button
        type="button"
        onClick={onLogout}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className="grid size-[38px] place-items-center rounded-[10px] text-slate-soft hover:bg-white/10 hover:text-white"
      >
        <LogOut className="size-[18px]" />
      </button>
    </header>
  );
}
