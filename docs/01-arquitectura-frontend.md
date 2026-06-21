# 01 — Arquitectura del frontend

> Documento fundacional del front de **LcAgro** (Etapa 9 del roadmap). Define el stack, la
> organización de `src/`, las librerías elegidas y las convenciones. Es la base sobre la que se
> apoyan el resto de los docs de este repo (`docs/02..07`).
>
> El front consume la **API .NET** del repo backend (`LcAgro-Procesos`). Acá no se documenta la API
> en sí (eso vive en el backend); se documenta **cómo el front se estructura y consume esa API**.

---

## 1. De dónde venimos

El front no parte de cero conceptual. Existe un **mockup web navegable** (`apps/mockup-web/index.html`
en el repo backend) que el cliente ya validó: define la **estética**, la **navegación de dos
sidebars**, las **vistas** (Dashboard, Posición, Cuentas, Configuración, Usuarios) y los **datos de
ejemplo**. Ese mockup es una **maqueta HTML autocontenida sin build** — no es la app. El trabajo de
esta etapa es **reescribirlo como aplicación React real**, conectada a la API y con estado de
servidor, auth y permisos de verdad.

| Mockup (hoy) | Front de producción (esta etapa) |
|---|---|
| `index.html` con vistas y datos embebidos | App **Vite + React + TypeScript** |
| Datos `const POS = {...}` hardcodeados en el HTML | Respuestas de la **API .NET** vía **TanStack Query** |
| Navegación con `innerHTML` y clases `.active` | **react-router** + estado de UI en componentes |
| Login mock que no valida | **JWT** real (access + refresh) contra `/api/auth/login` |
| Export CSV / imprimir | Export **client-side** (`shared/export`) |
| Asistente IA mock | Fuera del alcance del MVP (placeholder) |

> El mockup vive en el **repo backend**, en `apps/mockup-web/`. Desde este repo lo referenciamos por
> ruta (no hay link relativo cruzado entre repos). Conviene tenerlo abierto al lado mientras se
> programa, junto a las capturas en `apps/mockup-web/capturas/`.

---

## 2. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Bundler / dev server | **Vite** | Arranque y HMR instantáneos; build a estáticos; cero config para SPA. |
| UI | **React 19 + TypeScript** | Componentes, tipado estricto end-to-end con los DTOs de la API. |
| Estilos | **Tailwind CSS** | Utilidades; replica el sistema de tokens del mockup (colores, tipos). |
| Componentes | **shadcn/ui** | Primitivas accesibles (Radix) que copiamos al repo y theme-amos a gusto. |
| Routing | **react-router** | Rutas, layouts anidados, guards por rol. |
| Estado de servidor | **TanStack Query** | Cache, refetch, invalidación, loading/error. **No** usamos Redux. |
| Formularios | **react-hook-form + zod** | Forms performantes + validación tipada que matchea los DTOs. |
| HTTP | **axios** | Cliente con interceptores (adjuntar JWT, refrescar token). |
| Toasts | **sonner** (vía shadcn) | Notificaciones de éxito/error de mutaciones. |
| Build target | SPA estática | Se sirve detrás del mismo origin o con CORS contra la API. |

> **SPA, no SSR.** Es una herramienta interna detrás de login; no necesita SEO ni server rendering.
> Vite con SPA es lo más simple y suficiente. No usamos Next.js.

**Separación de estado.** Regla de oro: **TanStack Query es la única fuente de verdad para datos del
servidor** (posición, cuentas, usuarios, config). El estado local de UI (sidebar colapsado, filtros
de un formulario, modal abierto) vive en `useState`/`useReducer` o en la URL. **No** duplicamos datos
del servidor en estado de cliente.

---

## 3. Organización: feature-first

La estructura es **por feature** (vertical), no por tipo técnico (horizontal). Cada proceso del
negocio es una carpeta autocontenida en `features/` con sus páginas, componentes, hooks de datos y
tipos. Lo **transversal** (formato, export, tabla genérica, cliente HTTP) vive en `shared/` y `lib/`.

```
src/
├── app/                  # Composición raíz: router, providers, layout global
│   ├── App.tsx           # <RouterProvider> dentro de los providers
│   ├── providers.tsx     # QueryClientProvider + AuthProvider + Toaster
│   ├── router.tsx        # Definición de rutas + guards por rol
│   └── layout/
│       ├── AppLayout.tsx     # Shell: 2 sidebars + topbar + <Outlet>
│       ├── SidebarAreas.tsx  # Sidebar 1: áreas del negocio (colapsable a íconos)
│       ├── SidebarProcesos.tsx # Sidebar 2: procesos del área (ocultable)
│       └── Topbar.tsx        # Barra slate con la ruta "Área / Proceso" + avatar
│
├── features/             # Una carpeta por proceso/dominio (feature-first)
│   ├── auth/
│   ├── dashboard/
│   ├── posicion/
│   ├── cuentas/
│   ├── usuarios/
│   ├── config/
│   └── auditoria/
│
├── components/
│   └── ui/               # shadcn/ui (button, dialog, table, input, select...)
│
├── shared/               # Transversal reutilizable entre features
│   ├── components/       # DataTable, FilterBar, KpiCard, ExportButtons, PageHeader
│   ├── format/           # usd.ts, tn.ts, fecha.ts
│   ├── export/           # exportToExcel.ts, exportToPdf.ts
│   └── hooks/            # useDebounce, usePagination, ...
│
├── lib/                  # Infraestructura: cliente HTTP, query client, auth
│   ├── apiClient.ts      # instancia axios + interceptores JWT/refresh
│   ├── queryClient.ts    # configuración de TanStack Query
│   └── auth.ts           # helpers de token (storage, decode, refresh)
│
├── styles/
│   └── index.css         # Tailwind + tokens del theme (ver doc 06)
│
└── main.tsx              # Punto de entrada Vite: render(<App/>)
```

### Qué va en cada carpeta

| Carpeta | Contenido | Regla |
|---|---|---|
| `app/` | Wiring de la aplicación: router, providers, layout global. | No tiene lógica de dominio. Solo compone. |
| `features/<x>/` | Todo lo de un proceso: pages, components, queries/hooks, types. | Una feature **no importa** de otra feature. Si necesitan compartir, sube a `shared/`. |
| `components/ui/` | Primitivas shadcn/ui (generadas por su CLI). | Tontas, sin lógica de negocio. Se theme-an con Tailwind. |
| `shared/` | Componentes y utilidades transversales. | Sin estado de servidor propio; recibe datos por props. |
| `lib/` | Infraestructura técnica (HTTP, cache, auth). | Lo importan las features vía sus hooks; las pages no tocan `apiClient` directo. |
| `styles/` | Tailwind y tokens del theme. | Fuente única de colores/tipografías (ver doc 06). |

### Anatomía de una feature

Cada feature sigue la misma forma interna. Ejemplo con `posicion/`:

```
features/posicion/
├── pages/
│   └── PosicionPage.tsx        # Página de ruta: orquesta filtros + tabla + tarjetas
├── components/
│   ├── PosicionTable.tsx       # Tabla por campaña + cereal
│   ├── PosicionCards.tsx       # Tarjetas-resumen por cereal (como el mockup)
│   └── AjusteDialog.tsx        # Alta/edición de ajuste (Operador/Admin)
├── queries/
│   ├── usePosicion.ts          # useQuery GET /api/posicion
│   ├── useCampanias.ts         # useQuery GET /api/posicion/campanias
│   └── useAjustes.ts           # useQuery + useMutation /api/ajustes
└── types.ts                    # PosicionDto, AjusteDto, filtros (espejo de los DTOs de la API)
```

> **Por qué feature-first.** Cuando se agregue el próximo proceso (Comercial · Insumos, Producción,
> etc. — los que el mockup marca como **"Próx."**), se crea **una carpeta nueva** y listo, sin tocar
> las existentes. El mockup ya enumera esos procesos futuros (ver sección 7); el front está armado
> para que cada uno entre como una feature independiente.

---

## 4. Diagrama de capas (flujo de datos)

El front respeta una dirección de dependencias clara: la **UI no conoce axios**, habla con **hooks**;
los hooks hablan con el **apiClient**; el apiClient habla con la **API**.

```
┌─────────────────────────────────────────────────────────────────────┐
│  features/<x>/pages  ·  features/<x>/components   (UI: JSX, shadcn)   │
│  - Renderiza, capta eventos, muestra loading/error/skeleton          │
│  - NO sabe de URLs, headers ni axios                                 │
└───────────────┬─────────────────────────────────────────────────────┘
                │ usa hooks (useQuery / useMutation)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  features/<x>/queries   (TanStack Query hooks)                       │
│  - usePosicion(), useCuentas(), useUpdateObservacion()...            │
│  - Definen queryKey, staleTime, invalidación de cache                │
│  - Mapean filtros de UI -> params de request                         │
└───────────────┬─────────────────────────────────────────────────────┘
                │ llama funciones de servicio (fetchers tipados)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  lib/apiClient.ts   (axios)                                          │
│  - baseURL = VITE_API_URL ; Content-Type JSON                       │
│  - interceptor request: adjunta  Authorization: Bearer <accessToken> │
│  - interceptor response: 401 -> refresh -> reintenta ; 4xx/5xx ->    │
│    normaliza el ProblemDetails (RFC7807) a un Error de la app        │
└───────────────┬─────────────────────────────────────────────────────┘
                │ HTTP (JSON)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API .NET  /api/...   (otro repo: LcAgro-Procesos)                   │
│  Controller -> IService -> IRepository -> MacroGest (RO) / AppDb     │
└─────────────────────────────────────────────────────────────────────┘
```

Reglas que se derivan del diagrama:

- **Las pages/components nunca importan `lib/apiClient`.** Solo consumen hooks de `queries/`.
- **Toda llamada HTTP pasa por `apiClient`**, así el JWT y el manejo de errores quedan en un solo lugar.
- **Los tipos del front (`types.ts`) son espejo de los DTOs de la API.** Si la API cambia un DTO, se
  ajusta el tipo del front. Los nombres de dominio (`Cereal`, `Campania`, `Posicion`, `Vendedor`)
  pueden ir en español; el resto del código en inglés.

---

## 5. Librerías: rol de cada una

### react-router — navegación y guards

Define el árbol de rutas y los **layouts anidados**. El `AppLayout` (dos sidebars + topbar) es el
layout padre; cada feature cuelga como ruta hija y se renderiza en el `<Outlet>`. Las rutas se
protegen por **rol** con un wrapper.

```tsx
// app/router.tsx (esquema)
const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,            // sin sesión -> redirige a /login
    children: [
      {
        element: <AppLayout />,          // shell con los dos sidebars + topbar
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "posicion", element: <PosicionPage /> },
          { path: "cuentas", element: <CuentasPage /> },
          // solo Admin:
          {
            element: <RequireRole role="Admin" />,
            children: [
              { path: "usuarios", element: <UsuariosPage /> },
              { path: "config", element: <ConfigPage /> },
              { path: "auditoria", element: <AuditoriaPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
```

> El detalle de rutas, roles por ruta y el componente `RequireRole` va en **doc 05 (routing y auth)**.

### TanStack Query — estado de servidor

Maneja **todo** lo que viene de la API: cache por `queryKey`, refetch, estados de carga/error,
invalidación tras mutaciones. Convención de `queryKey`: `[feature, operación, params]`.

```ts
// features/posicion/queries/usePosicion.ts (esquema)
export function usePosicion(filtros: PosicionFiltros) {
  return useQuery({
    queryKey: ["posicion", "list", filtros],     // params en la key -> cache por filtro
    queryFn: () => fetchPosicion(filtros),        // usa apiClient por dentro
    staleTime: 60_000,
  });
}

// Mutación con invalidación (alta de ajuste -> recalcular posición)
export function useCreateAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: AjusteCreateDto) => createAjuste(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ajustes"] });
      qc.invalidateQueries({ queryKey: ["posicion"] }); // la posición FINAL depende de ajustes
    },
  });
}
```

> **Detalle clave de negocio:** la posición que muestra el front es la **posición FINAL** (la API
> aplica los ajustes de la BD propia sobre `posicion_sin_ajustes`). Por eso, al crear/editar/borrar
> un ajuste, hay que **invalidar también** la query de `posicion`. Esto se documenta a fondo en
> **doc 04 (features)**.

### react-hook-form + zod — formularios

`react-hook-form` para performance (re-render mínimo) y `zod` para validación tipada. El schema zod
es la fuente de verdad del tipo del form e idealmente refleja las reglas del backend
(FluentValidation), para fallar temprano en el cliente.

```ts
// features/posicion/components/ajuste-schema.ts (esquema)
export const ajusteSchema = z.object({
  campania: z.string().min(1),
  cereal: z.string().min(1),
  tipo: z.enum(["arrastre", "semilla", "canje", "produccion_propia"]),
  tn: z.coerce.number().positive(),
  precioUsd: z.coerce.number().positive(),
  signo: z.enum(["+", "-"]),
  nota: z.string().max(500).optional(),
});
export type AjusteForm = z.infer<typeof ajusteSchema>;
```

### axios — cliente HTTP

Una **única instancia** en `lib/apiClient.ts` con interceptores. Es lo único que toca `fetch`/HTTP en
todo el front. Adjunta el JWT en cada request y, ante un `401`, intenta refrescar el token y
reintentar; normaliza los errores `ProblemDetails` de la API a un objeto manejable por la UI (toasts).

```ts
// lib/apiClient.ts (esquema)
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,   // p.ej. http://localhost:5080/api
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && canRefresh()) {
      await refreshToken();
      return apiClient(error.config);       // reintenta con el token nuevo
    }
    return Promise.reject(normalizeProblemDetails(error)); // RFC7807 -> Error de app
  },
);
```

> El flujo completo de JWT (access + refresh, persistencia, expiración) va en **doc 05**.

### shadcn/ui — componentes base

No es una dependencia "instalada" tradicional: su CLI **copia el código** de cada componente a
`components/ui/`, así queda en el repo y se theme-a con Tailwind. Se usa para `button`, `dialog`,
`table`, `input`, `select`, `dropdown-menu`, `sonner` (toasts), `skeleton`, etc. Sobre estas
primitivas se construyen los componentes de `shared/` (p. ej. `DataTable` envuelve `table`).

---

## 6. Convenciones

### Path aliases

Vite + TypeScript con alias `@/` apuntando a `src/`. Evita los `../../../` y deja imports legibles.

```ts
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

```ts
// vite.config.ts
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Uso:

```ts
import { apiClient } from "@/lib/apiClient";
import { DataTable } from "@/shared/components/DataTable";
import { usePosicion } from "@/features/posicion/queries/usePosicion";
import { formatUsd } from "@/shared/format/usd";
```

### Nombres y archivos

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componente React (archivo + export) | `PascalCase.tsx` | `PosicionTable.tsx` |
| Hook | `useCamelCase.ts` | `usePosicion.ts`, `useDebounce.ts` |
| Utilidad / no-componente | `kebab-case.ts` o `camelCase.ts` | `apiClient.ts`, `ajuste-schema.ts` |
| Carpeta | `kebab-case` o nombre de feature | `cuentas/`, `components/` |
| Tipos / DTOs | `PascalCase`, sufijo `Dto` para los de la API | `PosicionDto`, `CuentaDto` |
| Docs de este repo | minúsculas-con-guiones, sin tildes | `01-arquitectura-frontend.md` |

### Idioma del código

- **Código en inglés** (variables, funciones, props): `isLoading`, `selectedCampania`, `onSubmit`.
- **Excepción: términos de dominio en español** cuando aportan claridad: `Cereal`, `Campania`,
  `Posicion`, `Ajuste`, `Vendedor`, `Cuenta`. Coincide con los nombres de los DTOs de la API.
- **Texto visible al usuario, siempre en español rioplatense** (con tildes y ñ): rótulos, toasts,
  mensajes de error, encabezados.

### Estados de carga y error

- **Loading:** skeletons (no spinners a pantalla completa) — el shell se mantiene, el contenido
  muestra esqueletos. shadcn `skeleton`.
- **Error:** estado de error en la propia vista + toast (sonner) para errores de mutación.
- **Vacío:** estado "sin datos / sin resultados" explícito en tablas filtradas.

### Variables de entorno

Solo `VITE_*` se expone al cliente (regla de Vite). La única requerida hoy:

```
VITE_API_URL=http://localhost:5080/api
```

---

## 7. Alineación con el mockup

El layout del mockup se traduce 1:1 a componentes. El shell tiene **dos sidebars colapsables** y una
**topbar slate** que solo muestra la ruta "Área / Proceso":

```
┌──────────┬───────────────────────────────────────────────────────────┐
│ SIDEBAR  │  TOPBAR (slate):  Área  /  Proceso          [avatar]       │  <- Topbar.tsx
│ ÁREAS    ├──────────────┬────────────────────────────────────────────┤
│ (slate)  │  SIDEBAR     │                                            │
│          │  PROCESOS    │   <Outlet />                                │
│ Dashboard│  (slate-2)   │   (la page de la feature activa)            │
│ Acopio   │              │                                            │
│ Adm/Fin  │ Posición ●   │   p.ej. PosicionPage:                       │
│ Comercial│ (activo)     │   - tarjetas por cereal                     │
│ Producc. │ Concil. Próx.│   - FilterBar (campaña, cereal)             │
│ Dirección│ Cupos   Próx.│   - DataTable + ExportButtons               │
│ Sistema  │              │                                            │
└──────────┴──────────────┴────────────────────────────────────────────┘
 colapsa a íconos          se oculta/muestra
 (hamburguesa)             (botón flecha en el borde)
```

El **sidebar de áreas** se colapsa a íconos (el logo pasa a su versión mini); el **sidebar de
procesos** se oculta/muestra con un botón flecha. El proceso activo queda resaltado y los futuros
aparecen como **"Próx."**.

**Áreas y procesos** (del array `RAIL` del mockup). Los procesos **activos hoy** son los dos pilotos;
el resto figuran como "Próx." (hoja de ruta visible para el cliente):

| Área (Sidebar 1) | Procesos activos | Procesos "Próx." (futuras features) |
|---|---|---|
| Dashboard | Resumen general | — |
| Acopio | **Posición de Cereal** | Conciliación con corredores/exportadores · Otorgamiento de cupos |
| Administración y Finanzas | **Cuentas Corrientes USD** | Conciliación de bancos · Proyección de cash flow |
| Comercial · Insumos | — | Resumen de cuenta · Cotizador de presupuestos · Mercadería pendiente |
| Producción | — | Margen por campo · Liquidación de arrendamientos · Centro de costo |
| Dirección | — | Tablero consolidado · Informe financiero · Informe de producción |
| Administración del sistema | **Configuración** · **Usuarios** | — |

> En el front, **cada proceso activo = una feature** en `features/`. Las áreas y el menú de procesos
> se modelan como **datos de navegación** (un array análogo a `RAIL`) que el `SidebarAreas` /
> `SidebarProcesos` consumen para pintar el menú y resaltar el activo. Agregar un proceso futuro =
> agregar una feature + un ítem en ese array, sin "Próx.".

### Theme

El front replica los tokens del mockup: **amarillo clementina `#ffc10e`**, **slate `#2b4150`**,
**lienzo crema**, tipografías **Fraunces** (títulos/display) + **Hanken Grotesk** (cuerpo/UI). Estos
tokens se configuran como variables CSS y en el `tailwind.config`. El detalle del sistema de diseño
(paleta completa, escalas, mapeo a clases Tailwind y a variables de shadcn) está en **doc 06**.

---

## 8. Por qué estas decisiones

- **Feature-first** porque el producto es un agregado de **procesos independientes** que crece
  proceso a proceso (el mockup ya muestra 6 áreas con procesos futuros). Aislar por feature mantiene
  el costo de agregar un proceso constante.
- **TanStack Query y no Redux** porque casi todo el estado es **estado de servidor**: listados,
  filtros, paginación. Query resuelve cache/refetch/invalidación sin boilerplate. El poco estado de
  UI local no justifica un store global.
- **shadcn/ui y no una librería cerrada** porque necesitamos **theme-ar fuerte** para clavar la
  estética del mockup. Tener el código de los componentes en el repo da control total.
- **axios con un interceptor central** porque el JWT (access + refresh) y el manejo de
  `ProblemDetails` deben estar en **un solo lugar**, no repartidos por cada llamada.
- **Tipos espejo de los DTOs** porque las queries de MacroGest ya están **validadas al centavo** en
  el backend; el front no recalcula nada, solo presenta. Mantener los tipos alineados evita drift.

---

## Relacionado

- [02 — Sistema de diseño y theme](02-design-system.md)
- [03 — Routing, layout y guards por rol](03-routing-y-layout.md)
- [04 — Data, estado y cliente de API](04-data-y-estado.md)
- [05 — Features y vistas (Posición, Cuentas, Dashboard)](05-features.md)
- [06 — Setup y entornos (Vite, Tailwind, scripts, build)](06-setup-y-entornos.md)
- [07 — Plan de implementación frontend](07-plan-de-implementacion.md)

> **Mockup de referencia (repo backend `LcAgro-Procesos`):** `apps/mockup-web/index.html`,
> `apps/mockup-web/README.md` y capturas en `apps/mockup-web/capturas/`. Son informativos: viven en
> el otro repo, por eso se citan por ruta y no por link relativo.
