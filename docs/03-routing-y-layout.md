# 03 · Routing y Layout

> Doc de frontend de **LcAgro** (Etapa 9). Define el **árbol de rutas** con `react-router`, el
> **`AppLayout`** que replica el mockup (dos sidebars colapsables + topbar con la ruta), la **data de
> navegación** (áreas → procesos), los **estados de colapso**, el manejo de **logo full vs favicon
> mini** y los **guards por rol** (`ProtectedRoute` + autorización por proceso).
>
> Fuente visual: `apps/mockup-web/index.html` del repo backend (replicarlo al pie de la letra:
> dos sidebars, topbar slate, comportamiento de colapso). Acá lo llevamos a React + TypeScript.

---

## 1. Resumen ejecutivo

La app tiene un **shell de tres zonas** que envuelve a todas las vistas autenticadas:

```
┌──────────┬───────────────────────────────────────────────────────┐
│          │  TOPBAR (slate)  ·  Tablero / Dashboard      [IA] [EE] │
│ SIDEBAR  ├──────────────┬────────────────────────────────────────┤
│  ÁREAS   │  SIDEBAR     │                                         │
│ (slate)  │  PROCESOS    │            <Outlet />                    │
│          │  (slate-2)   │       (contenido de la ruta)            │
│  [ham]   │   ⟨flecha⟩    │                                         │
└──────────┴──────────────┴────────────────────────────────────────┘
```

- **Sidebar 1 — Áreas**: fija a la izquierda, color slate `#2b4150`. Lista las áreas del negocio con
  **ícono + nombre**. Se **colapsa a íconos** (240px → 70px) con la **hamburguesa** al lado del
  rótulo "ÁREAS". Al colapsar, el **logo completo** pasa a su **versión mini** (favicon).
- **Topbar**: barra superior slate que se extiende sobre Procesos + contenido. Muestra solo la
  **ruta "Área / Proceso"**, una píldora de campaña, el botón de IA y el avatar.
- **Sidebar 2 — Procesos**: arranca **debajo del topbar**, color slate-2 `#223340`. Lista los
  procesos del área activa; el activo queda resaltado, los futuros como `Próx.`. Se **oculta/muestra**
  (250px → 0) con un **botón circular de flecha** anclado a su borde derecho (la flecha gira 180°
  según el estado y queda accesible aun oculto).
- **Cuerpo**: scroll propio, ancho máximo 1240px, contiene el `<Outlet />` de la ruta activa.

El **login** es público y vive **fuera** del shell. Todo lo demás está **protegido** y se renderiza
dentro del `AppLayout`.

---

## 2. Árbol de rutas (`react-router`)

### 2.1 Mapa de URLs

| Ruta | Área (crumb) | Proceso (título) | Feature | Roles que la ven |
|---|---|---|---|---|
| `/login` | — (pública) | — | `auth` | Todos (sin sesión) |
| `/` | Tablero | Dashboard | `dashboard` | Admin, Operador, Cobranzas, SoloLectura |
| `/posicion` | Acopio | Posición de Cereal | `posicion` | Admin, Operador (Acopio), SoloLectura |
| `/cuentas` | Administración y Finanzas | Cuentas Corrientes USD | `cuentas` | Admin, Cobranzas, SoloLectura |
| `/usuarios` | Administración del sistema | Usuarios | `usuarios` | Admin |
| `/config` | Administración del sistema | Configuración | `config` | Admin |
| `/auditoria` | Administración del sistema | Auditoría | `auditoria` | Admin |
| `*` | — | No encontrado | — | Todos |

> Las URLs son **planas** (un segmento por proceso). La jerarquía Área → Proceso es de **navegación**
> (la dibujan los sidebars y el crumb del topbar), no de anidamiento de URL. Esto coincide con el
> mockup, donde cambiar de vista no recarga el shell.

### 2.2 Definición del router

`src/app/router.tsx`

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { PosicionPage } from '@/features/posicion/pages/PosicionPage';
import { CuentasPage } from '@/features/cuentas/pages/CuentasPage';
import { UsuariosPage } from '@/features/usuarios/pages/UsuariosPage';
import { ConfigPage } from '@/features/config/pages/ConfigPage';
import { AuditoriaPage } from '@/features/auditoria/pages/AuditoriaPage';
import { NotFoundPage } from '@/shared/components/NotFoundPage';

export const router = createBrowserRouter([
  // Pública
  { path: '/login', element: <LoginPage /> },

  // Privada: todo cuelga del shell, detrás del guard de sesión
  {
    element: <ProtectedRoute />,        // exige sesión válida
    children: [
      {
        element: <AppLayout />,         // shell con los dos sidebars + topbar
        children: [
          { index: true, element: <DashboardPage /> },                 // "/"
          { path: 'posicion', element: <PosicionPage /> },
          { path: 'cuentas', element: <CuentasPage /> },

          // Sub-árbol "Administración del sistema": solo Admin
          {
            element: <ProtectedRoute roles={['Admin']} />,
            children: [
              { path: 'usuarios', element: <UsuariosPage /> },
              { path: 'config', element: <ConfigPage /> },
              { path: 'auditoria', element: <AuditoriaPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);
```

> **Roles por proceso** (`/posicion`, `/cuentas`) se resuelven **dentro de cada página/feature** con
> un guard fino (ver §6.3), no en el árbol, porque ahí no se trata solo de "estar logueado" sino de
> "tener el proceso asignado". El sub-árbol Admin sí se protege en el router porque es un corte limpio
> por rol único.

### 2.3 Providers (orden de montaje)

`src/app/App.tsx` — el router se monta dentro de los providers globales:

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { router } from './router';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

Orden: **QueryClient → Auth → Router**. El `AuthProvider` envuelve al router porque tanto
`ProtectedRoute` como el `AppLayout` (avatar, botón "Cerrar sesión") leen el contexto de auth. El
detalle del `apiClient`/refresh y del `AuthProvider` está en `04-data-y-estado.md`.

---

## 3. Data de navegación (áreas → procesos)

La navegación es **declarativa**: una sola estructura tipada describe áreas, procesos y los procesos
"próximos" (deshabilitados). Equivale al array `RAIL` del mockup, pero tipado y con permisos.

`src/app/navigation.ts`

```ts
import type { ComponentType } from 'react';
import {
  Home, Wheat, DollarSign, Box, Sprout, BarChart3, Settings,
} from 'lucide-react'; // los íconos del mockup mapeados a lucide

/** Roles del sistema (deben matchear los del backend / claims del JWT). */
export type Rol = 'Admin' | 'Operador' | 'Cobranzas' | 'SoloLectura';

/** Proceso ya implementado: navega a una ruta real. */
export interface ProcesoActivo {
  kind: 'activo';
  label: string;        // texto en el sidebar de Procesos
  title: string;        // título que va en el topbar (parte "c" del crumb)
  to: string;           // ruta react-router
  roles: Rol[];         // quién puede entrar
}

/** Proceso planificado: figura como "Próx.", no navega. */
export interface ProcesoFuturo {
  kind: 'futuro';
  label: string;
}

export type Proceso = ProcesoActivo | ProcesoFuturo;

export interface Area {
  id: string;           // clave estable para el sidebar de Áreas
  icon: ComponentType<{ className?: string }>;
  label: string;        // nombre corto en el rail de Áreas
  area: string;         // crumb que se muestra en el topbar (parte "a")
  procesos: Proceso[];
}

export const NAV: Area[] = [
  {
    id: 'dashboard', icon: Home, label: 'Dashboard', area: 'Tablero',
    procesos: [
      { kind: 'activo', label: 'Resumen general', title: 'Dashboard', to: '/',
        roles: ['Admin', 'Operador', 'Cobranzas', 'SoloLectura'] },
    ],
  },
  {
    id: 'acopio', icon: Wheat, label: 'Acopio', area: 'Acopio',
    procesos: [
      { kind: 'activo', label: 'Posición de Cereal', title: 'Posición de Cereal',
        to: '/posicion', roles: ['Admin', 'Operador', 'SoloLectura'] },
      { kind: 'futuro', label: 'Conciliación con corredores/exportadores' },
      { kind: 'futuro', label: 'Otorgamiento de cupos' },
    ],
  },
  {
    id: 'admin-fin', icon: DollarSign, label: 'Administración y Finanzas',
    area: 'Administración y Finanzas',
    procesos: [
      { kind: 'activo', label: 'Cuentas Corrientes USD', title: 'Cuentas Corrientes USD',
        to: '/cuentas', roles: ['Admin', 'Cobranzas', 'SoloLectura'] },
      { kind: 'futuro', label: 'Conciliación de bancos' },
      { kind: 'futuro', label: 'Proyección de cash flow' },
    ],
  },
  {
    id: 'comercial', icon: Box, label: 'Comercial · Insumos', area: 'Comercial · Insumos',
    procesos: [
      { kind: 'futuro', label: 'Resumen de cuenta a clientes' },
      { kind: 'futuro', label: 'Cotizador de presupuestos' },
      { kind: 'futuro', label: 'Mercadería pendiente de recibir' },
    ],
  },
  {
    id: 'produccion', icon: Sprout, label: 'Producción', area: 'Producción',
    procesos: [
      { kind: 'futuro', label: 'Margen por campo y cultivo' },
      { kind: 'futuro', label: 'Liquidación de arrendamientos' },
      { kind: 'futuro', label: 'Centro de costo por lote/campaña' },
    ],
  },
  {
    id: 'direccion', icon: BarChart3, label: 'Dirección', area: 'Dirección y Estrategia',
    procesos: [
      { kind: 'futuro', label: 'Tablero de control consolidado' },
      { kind: 'futuro', label: 'Informe financiero' },
      { kind: 'futuro', label: 'Informe de resultado producción' },
    ],
  },
  {
    id: 'sistema', icon: Settings, label: 'Administración del sistema', area: 'Administración',
    procesos: [
      { kind: 'activo', label: 'Configuración', title: 'Configuración', to: '/config',
        roles: ['Admin'] },
      { kind: 'activo', label: 'Usuarios', title: 'Usuarios', to: '/usuarios',
        roles: ['Admin'] },
      { kind: 'activo', label: 'Auditoría', title: 'Auditoría', to: '/auditoria',
        roles: ['Admin'] },
    ],
  },
];
```

> **Origen de los íconos**: el mockup define SVGs inline (`home`, `grain`, `money`, `box`, `plant`,
> `chart`, `gear`). En React usamos **lucide-react** (viene con shadcn/ui) con los equivalentes más
> cercanos: `Home`, `Wheat`, `DollarSign`, `Box`, `Sprout`, `BarChart3`, `Settings`.
>
> **Auditoría** no estaba en el mockup (el mockup solo tenía Config + Usuarios bajo "Sistema"), pero
> es un endpoint canónico (`GET /api/auditoria`, rol Admin), así que se agrega como tercer proceso del
> área de sistema.

### 3.1 Helpers de navegación

`src/app/navigation.ts` (continúa)

```ts
/** Área activa según la URL actual (matchea por la ruta de alguno de sus procesos). */
export function areaActivaPorPath(pathname: string): Area | undefined {
  return NAV.find(a =>
    a.procesos.some(p => p.kind === 'activo' && esRutaActiva(p.to, pathname)),
  );
}

/** "/" solo matchea exacto; el resto, por prefijo. */
export function esRutaActiva(to: string, pathname: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/');
}

/** Filtra los procesos de un área según el rol del usuario (los "futuro" siempre se muestran). */
export function procesosVisibles(area: Area, rol: Rol): Proceso[] {
  return area.procesos.filter(p => p.kind === 'futuro' || p.roles.includes(rol));
}
```

---

## 4. `AppLayout` — el shell

`src/app/AppLayout.tsx`. Replica la estructura del mockup: `s-areas` + (`topbar` + (`s-proc` +
`content`)). Mantiene dos estados de UI: **áreas colapsadas** y **procesos ocultos**.

```tsx
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { NAV, areaActivaPorPath } from './navigation';
import { SidebarAreas } from './components/SidebarAreas';
import { SidebarProcesos } from './components/SidebarProcesos';
import { Topbar } from './components/Topbar';

export function AppLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [areasCollapsed, setAreasCollapsed] = useState(false);
  const [procHidden, setProcHidden] = useState(false);

  // Área "seleccionada" en el rail = la que contiene la ruta actual; fallback al Dashboard.
  const areaActiva = areaActivaPorPath(pathname) ?? NAV[0];

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <SidebarAreas
        areas={NAV}
        areaActivaId={areaActiva.id}
        collapsed={areasCollapsed}
        onToggle={() => setAreasCollapsed(c => !c)}
        rol={user!.rol}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar area={areaActiva} />
        <div className="flex min-h-0 flex-1">
          <SidebarProcesos
            area={areaActiva}
            rol={user!.rol}
            hidden={procHidden}
          />
          <div className="relative h-full min-w-0 flex-1">
            <button
              type="button"
              aria-label={procHidden ? 'Mostrar procesos' : 'Ocultar procesos'}
              aria-expanded={!procHidden}
              onClick={() => setProcHidden(h => !h)}
              className="proc-toggle"           // ver §5.3 para el estilo del círculo
              data-flip={procHidden}
            >
              <ChevronLeft className="h-[15px] w-[15px] transition-transform
                                      data-[flip=true]:rotate-180" />
            </button>
            <div className="h-full overflow-y-auto">
              <div className="mx-auto w-full max-w-[1240px] px-7 pb-16 pt-6">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

> **Por qué el estado vive en `AppLayout` y no en un context global**: colapsar áreas y ocultar
> procesos es estado **puramente de UI del shell**, no se comparte con features. Si más adelante hace
> falta persistirlo (recordar la preferencia entre sesiones), se guarda en `localStorage` con un
> `useEffect`; por ahora, `useState` alcanza y matchea el mockup (se resetea al recargar).

### 4.1 Persistencia opcional del colapso (mejora)

```tsx
function usePersistedFlag(key: string, initial = false) {
  const [v, setV] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? String(initial)); }
    catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(v)); }, [key, v]);
  return [v, setV] as const;
}
// const [areasCollapsed, setAreasCollapsed] = usePersistedFlag('ui.areasCollapsed');
```

---

## 5. Componentes del shell

### 5.1 `SidebarAreas` (rail izquierdo)

Color slate `#2b4150`. Ancho **240px** expandido, **70px** colapsado (transición `width .24s ease`).
Estructura: marca (logo) → fila "ÁREAS" + hamburguesa → lista de áreas.

```tsx
import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from './BrandLogo';
import type { Area, Rol } from '../navigation';

interface Props {
  areas: Area[];
  areaActivaId: string;
  collapsed: boolean;
  onToggle: () => void;
  rol: Rol;
}

export function SidebarAreas({ areas, areaActivaId, collapsed, onToggle, rol }: Props) {
  return (
    <aside
      className={cn(
        'z-30 flex h-full flex-none flex-col overflow-hidden bg-slate text-slate-fg',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-[70px]' : 'w-60',
      )}
    >
      {/* Marca: full vs mini según colapso (ver §5.4) */}
      <div className="flex h-[62px] flex-none items-center border-b border-white/10 px-4">
        <BrandLogo collapsed={collapsed} />
      </div>

      {/* Rótulo + hamburguesa */}
      <div className={cn('flex items-center justify-between px-3 pb-1.5 pt-3.5',
                         collapsed && 'justify-center px-0')}>
        {!collapsed && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">Áreas</span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!collapsed}
          className="grid h-[30px] w-[30px] place-items-center rounded-lg
                     text-slate-soft hover:bg-white/10 hover:text-white"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Lista de áreas */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3 pt-0.5">
        {areas.map(a => {
          const Icon = a.icon;
          const navegable = a.procesos.find(
            p => p.kind === 'activo' && p.roles.includes(rol),
          );
          const active = a.id === areaActivaId;
          // Si el área tiene un proceso navegable, el rail lleva a ese primer proceso.
          // Si solo tiene "futuros", igual se muestra pero abre la pantalla "Próximamente".
          const to = navegable?.kind === 'activo' ? navegable.to : `/?area=${a.id}`;
          return (
            <NavLink
              key={a.id}
              to={to}
              title={a.label}
              className={cn(
                'mb-0.5 flex items-center gap-3 whitespace-nowrap rounded-[11px]',
                'px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-gradient-to-r from-amarillo to-amarillo-deep font-semibold text-slate'
                  : 'text-[#cdd9e0] hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-5 w-5 flex-none opacity-90" />
              {!collapsed && <span className="truncate">{a.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
```

> **Áreas "Próximamente"**: en el mockup, las áreas sin proceso activo (Comercial, Producción,
> Dirección) muestran una pantalla "Próximamente" con su lista planificada. En React eso es una
> ruta/pantalla aparte (`PróximamentePage`) que el `SidebarProcesos` resuelve; el rail de Áreas
> siempre lista **todas** las áreas para mostrarle al cliente la hoja de ruta completa.

### 5.2 `SidebarProcesos` (rail intermedio)

Color slate-2 `#223340`. Ancho **250px**, **0** cuando está oculto. Lista los procesos del área
activa; los `futuro` van deshabilitados con el badge `Próx.`.

```tsx
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { procesosVisibles, esRutaActiva, type Area, type Rol } from '../navigation';
import { useLocation } from 'react-router-dom';

interface Props { area: Area; rol: Rol; hidden: boolean; }

export function SidebarProcesos({ area, rol, hidden }: Props) {
  const { pathname } = useLocation();
  const procesos = procesosVisibles(area, rol);

  return (
    <aside
      className={cn(
        'flex h-full flex-none flex-col overflow-hidden bg-slate-2 text-slate-fg',
        'transition-[width] duration-200 ease-in-out',
        hidden ? 'w-0' : 'w-[250px]',
      )}
      aria-hidden={hidden}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2.5 pt-4.5">
        <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-white/40">
          Procesos
        </div>

        {procesos.map((p, i) =>
          p.kind === 'activo' ? (
            <NavLink
              key={p.to}
              to={p.to}
              className={({ isActive }) =>
                cn(
                  'mb-[7px] flex items-start gap-2 rounded-[10px] border px-3 py-2.5',
                  'text-[13px] leading-tight transition-colors',
                  isActive || esRutaActiva(p.to, pathname)
                    ? 'border-transparent bg-gradient-to-r from-amarillo to-amarillo-deep '
                      + 'font-semibold text-slate'
                    : 'border-white/10 bg-white/5 text-[#cdd9e0] '
                      + 'hover:border-white/20 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <span className="min-w-0 flex-1">{p.label}</span>
            </NavLink>
          ) : (
            <div
              key={`soon-${i}`}
              className="mb-[7px] flex cursor-default items-start justify-between gap-2
                         rounded-[10px] border border-white/5 bg-white/5 px-3 py-2.5
                         text-[13px] leading-tight text-white/35"
            >
              <span className="min-w-0 flex-1">{p.label}</span>
              <em className="mt-px flex-none rounded-[5px] bg-white/10 px-1.5 py-0.5
                             text-[9px] font-bold not-italic tracking-wide text-slate-soft">
                Próx.
              </em>
            </div>
          ),
        )}
      </div>

      {/* Pie: estado de conexión a MacroGest (replica el side-card del mockup) */}
      <div className="flex-none p-3">
        <div className="rounded-xl border border-white/10 bg-white/10 p-[13px] text-xs
                        text-[#cdd9e0]">
          <span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-emerald-400
                           shadow-[0_0_0_3px_rgba(95,208,138,0.2)]" />
          <b className="font-display text-white">Base conectada</b>
          <div className="mt-1 text-slate-soft">MacroGest · solo lectura</div>
        </div>
      </div>
    </aside>
  );
}
```

> El pie "Base conectada / Última sync" del mockup se puede alimentar de `GET /health` (estado de
> MacroGest + AppDb). En v1 puede quedar estático; cuando exista el health check, se conecta con una
> query de TanStack.

### 5.3 Botón circular de Procesos (el toggle de flecha)

Es el `proc-toggle` del mockup: un **círculo** crema anclado al borde izquierdo del contenido
(`left: -15px`), que **gira la flecha 180°** cuando los procesos están ocultos. Vive **dentro** del
`AppLayout` (ya está en el snippet de §4), pero su estilo merece detalle porque es un elemento
visual característico.

```css
/* En styles o como clase utilitaria; replica .proc-toggle del mockup */
.proc-toggle {
  position: absolute; top: 13px; left: -15px; z-index: 50;
  display: grid; place-items: center;
  width: 30px; height: 30px; border-radius: 9999px;
  background: var(--panel); color: var(--slate);
  border: 1px solid var(--line);
  box-shadow: 0 4px 12px -4px rgba(33,48,58,.32);
  transition: .18s;
}
.proc-toggle:hover {
  border-color: var(--amarillo-deep); color: var(--amarillo-deep);
  transform: scale(1.08);
}
```

Comportamiento (igual que `toggleProc()` del mockup):

| Estado | `procHidden` | Ancho `s-proc` | Flecha |
|---|---|---|---|
| Procesos visibles | `false` | 250px | `‹` (apunta a la izquierda, "ocultar") |
| Procesos ocultos | `true` | 0px | `›` (rotada 180°, "mostrar") |

```ascii
visible:  [Procesos 250px] ‹|  contenido
oculto:                    |› contenido (procesos colapsados a 0)
```

### 5.4 `BrandLogo` (logo full vs favicon mini)

Replica `initBrand()` del mockup: con el sidebar **expandido** muestra el **logo completo**; al
**colapsar**, cambia al **favicon mini**. Si el logo completo no carga, hace fallback al mini.

```tsx
import logoFull from '@/assets/brand/lc-logo.png';        // LC_New-logo_base-traslucida-retina.png
import logoMini from '@/assets/brand/lc-favicon-192.png'; // cropped-favicon-192x192.png

export function BrandLogo({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return <img src={logoMini} alt="LC" className="h-[38px] w-[38px] rounded-[9px]" />;
  }
  return (
    <img
      src={logoFull}
      alt="La Clementina"
      className="h-7 w-auto"
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoMini; }}
    />
  );
}
```

> Los dos PNG de marca (`LC_New-logo_base-traslucida-retina.png` y `cropped-favicon-192x192.png`)
> viven hoy en `apps/mockup-web/`. En el front van a `src/assets/brand/` y se importan como módulos
> (Vite los versiona). Mantener el favicon como `public/favicon` también para la pestaña.

### 5.5 `Topbar`

Barra superior **slate**, altura 62px. Muestra **solo la ruta** "Área / Proceso" (parte `a` apagada +
separador + parte `c` en Fraunces), una píldora de campaña, el botón de IA y el avatar con iniciales.

```tsx
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { iniciales } from '@/shared/format/iniciales';
import { tituloProcesoPorPath, type Area } from '../navigation';

export function Topbar({ area }: { area: Area }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const titulo = tituloProcesoPorPath(area, pathname) ?? area.label;

  return (
    <header className="flex h-[62px] flex-none items-center gap-3.5 border-b border-white/10
                       bg-slate px-6 text-slate-fg">
      {/* Crumb Área / Proceso */}
      <nav className="flex items-center gap-2.5 text-[15px]" aria-label="Ruta actual">
        <span className="font-medium text-slate-soft">{area.area}</span>
        <span className="text-white/25">/</span>
        <span className="font-display text-[17px] font-semibold tracking-tight text-white">
          {titulo}
        </span>
      </nav>

      <div className="flex-1" />

      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15
                       bg-white/10 px-3 py-1.5 text-[12.5px] font-medium text-slate-fg">
        <Sparkles className="h-3.5 w-3.5 text-amarillo" />
        Campaña <b className="ml-1 text-white">2025-2026</b>
      </span>

      {/* Botón IA y avatar (detalle de cada uno en sus features) */}
      {/* ... */}
      <div className="grid h-[38px] w-[38px] place-items-center rounded-[10px]
                      bg-gradient-to-br from-amarillo to-amarillo-deep text-sm font-bold
                      text-slate" title={user!.nombre}>
        {iniciales(user!.nombre)}
      </div>
    </header>
  );
}
```

> El crumb es **derivado de la URL**, no estado: `area.area` sale del área activa, `titulo` del
> proceso cuya ruta matchea. Helper:
> ```ts
> export function tituloProcesoPorPath(area: Area, pathname: string): string | undefined {
>   const p = area.procesos.find(x => x.kind === 'activo' && esRutaActiva(x.to, pathname));
>   return p?.kind === 'activo' ? p.title : undefined;
> }
> ```

---

## 6. Protección de rutas y guards por rol

### 6.1 Modelo de roles

Cuatro roles canónicos; lo que ve cada uno:

| Rol | Dashboard | Posición | Ajustes | Cuentas | Observaciones | Usuarios/Config/Auditoría |
|---|---|---|---|---|---|---|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Operador** (Acopio) | ✅ | ✅ | ✅ | — | — | — |
| **Cobranzas** | ✅ | — | — | ✅ | ✅ | — |
| **SoloLectura** | ✅ | ✅ (solo ver) | — | ✅ (solo ver) | — | — |

> **Operador es por proceso.** En el modelo del piloto, "Operador (Acopio)" ve Posición/Ajustes. Si
> en el futuro hay un "Operador (Cobranzas)", el guard lo resuelve igual porque el permiso se chequea
> contra los `roles` declarados en `NAV` por proceso, no contra un rol hardcodeado.
>
> El **gating de UI dentro de la página** (ej.: SoloLectura ve la tabla de Posición pero **no** los
> botones de crear/editar ajustes) lo maneja cada feature con un hook `usePermiso`; este doc cubre el
> gating de **acceso a la ruta**.

### 6.2 `ProtectedRoute`

Guard de **sesión** (siempre) y opcionalmente de **rol** (para el sub-árbol Admin). Se usa como
*layout route*, así que renderiza `<Outlet />`.

`src/app/ProtectedRoute.tsx`

```tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import type { Rol } from './navigation';

interface Props {
  /** Si se pasa, además de sesión exige uno de estos roles. */
  roles?: Rol[];
}

export function ProtectedRoute({ roles }: Props) {
  const { status, user } = useAuth();
  const location = useLocation();

  // Mientras se rehidrata la sesión (refresh token), no parpadear el login.
  if (status === 'loading') return <FullPageSpinner />;

  // Sin sesión → login, recordando a dónde quería ir.
  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Con sesión pero sin el rol requerido → 403 (no al login: ya está logueado).
  if (roles && !roles.includes(user.rol)) {
    return <Navigate to="/" replace state={{ forbidden: location.pathname }} />;
  }

  return <Outlet />;
}
```

> **No mandar a `/login` por falta de rol.** Si el usuario está autenticado pero no tiene permiso, se
> lo redirige al Dashboard (o a una pantalla 403), no al login — sino entra en un loop confuso. El
> Dashboard es seguro porque **todos los roles** lo ven.

### 6.3 Guard fino por proceso (dentro de la feature)

Para `/posicion` y `/cuentas`, el acceso depende de tener el proceso asignado. En vez de duplicar
sub-árboles en el router, se envuelve la página con un guard que lee los `roles` declarados en `NAV`:

```tsx
// src/app/RequireProceso.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import type { Rol } from './navigation';

export function RequireProceso({ roles, children }: { roles: Rol[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.rol)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Uso en la página:
// export const PosicionPage = () => (
//   <RequireProceso roles={['Admin', 'Operador', 'SoloLectura']}>
//     <PosicionView />
//   </RequireProceso>
// );
```

> **Una sola fuente de verdad de permisos**: los `roles` por proceso se declaran en `NAV` (§3). Tanto
> el sidebar (qué procesos listar) como el guard (quién entra) leen de ahí, así no se desincronizan.

### 6.4 Flujo de decisión

```ascii
                 ┌───────────────────────────┐
   request /x →  │  ProtectedRoute (sesión)  │
                 └────────────┬──────────────┘
            status=loading ───┤ spinner
        unauthenticated ──────┤ → /login (state.from = /x)
              authenticated ──┤
                              ▼
                 ┌───────────────────────────┐
                 │  ¿roles requeridos?       │
                 └────────────┬──────────────┘
                  sí, falla ──┤ → / (Dashboard) [403]
                  ok ─────────┤
                              ▼
                 ┌───────────────────────────┐
                 │  AppLayout + <Outlet/>     │
                 │  (página de la ruta)       │
                 └───────────────────────────┘
```

---

## 7. Theme y tokens del shell

El layout usa los colores del mockup. Se definen como tokens de Tailwind (detalle completo en
`02-design-system.md` / `theme.css`); los relevantes acá:

| Token | Valor | Uso en el shell |
|---|---|---|
| `--slate` | `#2b4150` | Sidebar Áreas, Topbar |
| `--slate-2` | `#223340` | Sidebar Procesos |
| `--amarillo` | `#ffc10e` | Ítem activo (gradiente con `--amarillo-deep`), acentos |
| `--amarillo-deep` | `#e3a400` | Hover del botón circular, fin del gradiente activo |
| `--cream` | `#f6f2e9` | Lienzo del cuerpo |
| `--panel` | `#fffdf8` | Botón circular de procesos, tarjetas |
| `--line` | `#e7e1d3` | Bordes |

- **Tipografías**: `Fraunces` (display/títulos: crumb activo, títulos de vista) + `Hanken Grotesk`
  (cuerpo/UI). El crumb del proceso activo va en Fraunces (`font-display`).
- **Variable de altura**: el topbar y la fila de marca miden **62px** (`--top` en el mockup). Mantener
  ese número para que el sidebar de Procesos arranque alineado debajo del topbar.

---

## 8. Accesibilidad y detalles

- **Botones de toggle**: hamburguesa y círculo de flecha llevan `aria-label` y `aria-expanded`
  reflejando el estado (ver snippets). El sidebar de Procesos oculto lleva `aria-hidden`.
- **`NavLink`** ya marca `aria-current="page"` en el ítem activo; se aprovecha para el resaltado.
- **Foco visible**: respetar el `:focus-visible` del theme (anillo amarillo translúcido del mockup).
- **Scroll independiente**: tanto la lista de áreas como la de procesos y el cuerpo tienen su propio
  `overflow-y-auto`; el shell nunca scrollea entero (`h-screen overflow-hidden`).
- **Responsive (fuera de alcance del mockup)**: en pantallas chicas, ambos sidebars pasan a overlay
  con scrim (como el panel IA del mockup). v1 apunta a desktop; dejar los anchos en tokens para poder
  introducir breakpoints sin reescribir.

---

## 9. Checklist de implementación

- [ ] `src/app/navigation.ts` con `NAV`, tipos y helpers (`areaActivaPorPath`, `procesosVisibles`).
- [ ] `src/app/router.tsx` con login público + shell protegido + sub-árbol Admin.
- [ ] `src/app/ProtectedRoute.tsx` (sesión + rol) y `RequireProceso` para gating fino.
- [ ] `src/app/AppLayout.tsx` con estados `areasCollapsed` / `procHidden`.
- [ ] `SidebarAreas`, `SidebarProcesos`, `Topbar`, `BrandLogo` en `src/app/components/`.
- [ ] Botón circular `proc-toggle` con rotación de flecha por estado.
- [ ] Tokens de color/tipografía cargados (ver `02-design-system.md`).
- [ ] Assets de marca en `src/assets/brand/` (logo full + favicon mini) con fallback.
- [ ] Pantalla 403 / Dashboard como destino seguro para falta de rol.
- [ ] `NotFoundPage` para `*`.

---

## Relacionado

- [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md) — visión del producto, stack y alcance de la Etapa 9.
- [`02-design-system.md`](02-design-system.md) — theme, tokens (colores/tipografías), shadcn y componentes base.
- [`05-features.md`](05-features.md) — Dashboard, Posición, Cuentas, Usuarios,
  Config, Auditoría: tablas, filtros, forms y export client-side.
- [`04-data-y-estado.md`](04-data-y-estado.md) — login, JWT access/refresh, persistencia de sesión y
  matriz de permisos por rol y proceso.
