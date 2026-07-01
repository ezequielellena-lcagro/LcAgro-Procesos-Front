import type { ComponentType } from "react";
import { BarChart3, Box, DollarSign, Home, Settings, Sprout, Wheat } from "lucide-react";
import type { RolNombre } from "@/features/auth/types";

/** Proceso ya implementado: navega a una ruta real. */
export interface ProcesoActivo {
  kind: "activo";
  label: string; // texto en el sidebar de Procesos
  title: string; // título que va en el topbar
  to: string; // ruta react-router
  roles: RolNombre[]; // quién puede entrar
}

/** Proceso planificado: figura como "Próx.", no navega. */
export interface ProcesoFuturo {
  kind: "futuro";
  label: string;
}

export type Proceso = ProcesoActivo | ProcesoFuturo;

export interface Area {
  id: string;
  icon: ComponentType<{ className?: string }>;
  label: string; // nombre en el rail de Áreas
  area: string; // crumb del topbar
  procesos: Proceso[];
}

export const NAV: Area[] = [
  {
    id: "dashboard",
    icon: Home,
    label: "Dashboard",
    area: "Tablero",
    procesos: [
      {
        kind: "activo",
        label: "Resumen general",
        title: "Dashboard",
        to: "/",
        roles: ["dashboard"],
      },
    ],
  },
  {
    id: "acopio",
    icon: Wheat,
    label: "Acopio",
    area: "Acopio",
    procesos: [
      {
        kind: "activo",
        label: "Posición de Cereal",
        title: "Posición de Cereal",
        to: "/posicion",
        roles: ["posicion"],
      },
      { kind: "futuro", label: "Conciliación con corredores/exportadores" },
      { kind: "futuro", label: "Otorgamiento de cupos" },
    ],
  },
  {
    id: "admin-fin",
    icon: DollarSign,
    label: "Administración y Finanzas",
    area: "Administración y Finanzas",
    procesos: [
      {
        kind: "activo",
        label: "Cuentas Corrientes USD",
        title: "Cuentas Corrientes USD",
        to: "/cuentas",
        roles: ["cuentas"],
      },
      { kind: "futuro", label: "Conciliación de bancos" },
      { kind: "futuro", label: "Proyección de cash flow" },
    ],
  },
  {
    id: "comercial",
    icon: Box,
    label: "Comercial · Insumos",
    area: "Comercial · Insumos",
    procesos: [
      {
        kind: "activo",
        label: "Semilla Fiscalizada",
        title: "Semilla Fiscalizada",
        to: "/semilla-fiscalizada",
        roles: ["semilla"],
      },
      {
        kind: "activo",
        label: "Stock de Insumos",
        title: "Stock de Insumos",
        to: "/stock",
        roles: ["stock"],
      },
      { kind: "futuro", label: "Resumen de cuenta a clientes" },
      { kind: "futuro", label: "Cotizador de presupuestos" },
      { kind: "futuro", label: "Mercadería pendiente de recibir" },
    ],
  },
  {
    id: "produccion",
    icon: Sprout,
    label: "Producción",
    area: "Producción",
    procesos: [
      { kind: "futuro", label: "Margen por campo y cultivo" },
      { kind: "futuro", label: "Liquidación de arrendamientos" },
      { kind: "futuro", label: "Centro de costo por lote/campaña" },
    ],
  },
  {
    id: "direccion",
    icon: BarChart3,
    label: "Dirección",
    area: "Dirección y Estrategia",
    procesos: [
      { kind: "futuro", label: "Tablero de control consolidado" },
      { kind: "futuro", label: "Informe financiero" },
      { kind: "futuro", label: "Informe de resultado producción" },
    ],
  },
  {
    id: "sistema",
    icon: Settings,
    label: "Administración del sistema",
    area: "Administración",
    procesos: [
      { kind: "activo", label: "Configuración", title: "Configuración", to: "/config", roles: ["config"] },
      { kind: "activo", label: "Usuarios", title: "Usuarios", to: "/usuarios", roles: ["usuarios"] },
      { kind: "activo", label: "Auditoría", title: "Auditoría", to: "/auditoria", roles: ["auditoria"] },
    ],
  },
];

/** "/" matchea exacto; el resto por prefijo. */
export function esRutaActiva(to: string, pathname: string): boolean {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
}

/** Área activa según la URL (matchea por la ruta de alguno de sus procesos). */
export function areaActivaPorPath(pathname: string): Area | undefined {
  return NAV.find((a) =>
    a.procesos.some((p) => p.kind === "activo" && esRutaActiva(p.to, pathname)),
  );
}

/** Procesos de un área visibles para el usuario (los "futuro" siempre se muestran). */
export function procesosVisibles(area: Area, roles: RolNombre[]): Proceso[] {
  return area.procesos.filter(
    (p) => p.kind === "futuro" || p.roles.some((r) => roles.includes(r)),
  );
}

/** Título del proceso activo (para el crumb del topbar). */
export function tituloProcesoPorPath(area: Area, pathname: string): string | undefined {
  const p = area.procesos.find((x) => x.kind === "activo" && esRutaActiva(x.to, pathname));
  return p?.kind === "activo" ? p.title : undefined;
}
