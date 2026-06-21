# 07 — Plan de implementación (frontend)

> Backlog ejecutable del frontend de **LcAgro** (Etapa 9 del roadmap). Ordenado por **milestones** incrementales (M0 → M5).
> Cada milestone trae: **objetivo**, **tareas accionables** (con checkboxes), **dependencias**, **criterios de aceptación** y **qué espera del backend**.
> Fuente de verdad de arquitectura, theme, datos y features: los docs hermanos de `docs/` (ver [Relacionado](#relacionado)).
> Contrato de la API y orden de construcción del backend: [`11-plan-de-implementacion.md`](../../LcAgro-Procesos/02-desarrollo/11-plan-de-implementacion.md) del repo backend.

## Cómo leer este plan

- Los milestones se entregan **en orden**; cada uno deja el front en un estado **navegable y demostrable**.
- **Estrategia base: arrancar con datos mock y conectar feature por feature.** Mientras el backend avanza por sus milestones (M0 → M6), el front no se queda esperando: cada feature se construye primero contra **mocks** (MSW o fixtures) que respetan el contrato de datos, y cuando el endpoint real está listo se **flipea una variable de entorno** y la misma feature pasa a consumir la API. La UI no cambia: cambia de dónde vienen los datos.
- El **mapeo front ↔ backend** está pensado para que cada feature se conecte en cuanto su milestone de backend cierra (la columna "Desbloquea en el front" del [plan backend](../../LcAgro-Procesos/02-desarrollo/11-plan-de-implementacion.md) es el espejo de este documento).
- La **estética es la del mockup** [`apps/mockup-web/index.html`](../../LcAgro-Procesos/apps/mockup-web/index.html): lienzo crema, sidebar slate, acento amarillo clementina, tipografías Fraunces + Hanken Grotesk. No se reinventa el diseño; se reimplementa con Tailwind + shadcn/ui.

### Mapa de milestones (front)

```
M0  Scaffold + design system + AppLayout ......... Vite/React/TS/Tailwind/shadcn + 2 sidebars + topbar (MOCK)
        │
M1  Auth + rutas protegidas por rol .............. /auth (login real, JWT, refresh, guards)   ← backend M4
        │
M2  Posición + Ajustes + export .................. /posicion, /posicion/campanias, /ajustes    ← backend M1+M2
        │
M3  Cuentas + Observaciones + export ............. /cuentas paginado, PUT observación          ← backend M3
        │
M4  Usuarios + Config + Auditoría + Dashboard .... /usuarios, /config, /auditoria, /dashboard  ← backend M4+M5
        │
M5  Pulido + build/deploy ........................ skeletons, errores, a11y, responsive, dist
```

### Tabla resumen

| # | Milestone | Objetivo en una línea | Datos | Backend que lo habilita |
|---|---|---|---|---|
| **M0** | Scaffold + design system + AppLayout | Proyecto Vite + theme clementina + los dos sidebars + topbar de ruta | **Mock** | backend M0 (`/health`, CORS) |
| **M1** | Auth + rutas protegidas | Login real, `AuthProvider`, interceptor JWT/refresh, guards por rol | Real `/auth` | backend M4 |
| **M2** | Posición + Ajustes | Tabla + tarjetas por cereal + filtros + ABM de ajustes + export | Real `/posicion` `/ajustes` | backend M1 + M2 |
| **M3** | Cuentas + Observaciones | Listado paginado por vendedor + filtros + edición de observación + export | Real `/cuentas` | backend M3 |
| **M4** | Usuarios + Config + Auditoría + Dashboard | ABM usuarios, parámetros editables, auditoría paginada, KPIs cruzados | Real `/usuarios` `/config` `/auditoria` `/dashboard` | backend M4 + M5 |
| **M5** | Pulido + build/deploy | Skeletons, manejo de errores, accesibilidad, responsive, `dist` desplegable | Real | backend M6 |

> **Mientras un endpoint real no exista, su feature corre contra mock** (ver [§ Estrategia de mocks](#estrategia-de-mocks-msw)). Por eso M2 puede empezar antes de M1 si el backend tardó con auth: se desarrolla la feature `posicion` con datos mock y se la asegura detrás del guard cuando M1 cierre.

---

## Estrategia de mocks (MSW)

El front **no depende** del calendario del backend. Cada feature se construye contra un contrato de datos fijo (los DTOs de [`04-data-y-estado.md`](04-data-y-estado.md) y [`05-features.md`](05-features.md)) y dos posibles orígenes:

```
┌─────────────────────────────────────────────────────────────────┐
│  Componente / hook de TanStack Query                            │
│        useQuery(['posicion', filtros], () => api.getPosicion()) │
└───────────────────────────┬─────────────────────────────────────┘
                            │  mismo apiClient (axios)
              ┌─────────────┴─────────────┐
              ▼                           ▼
   VITE_USE_MOCKS=true            VITE_USE_MOCKS=false
   ┌──────────────────┐          ┌──────────────────────┐
   │  MSW intercepta  │          │  API .NET real       │
   │  fetch/XHR y     │          │  (VITE_API_URL)      │
   │  responde fixture│          │                      │
   └──────────────────┘          └──────────────────────┘
```

- **MSW** (Mock Service Worker) intercepta a nivel de red, así el `apiClient` (axios) y los hooks de TanStack Query **no se enteran** de si hablan con mock o con la API real.
- Los **fixtures** se derivan de los datos que ya validamos: para Posición, los números reales agregados del mockup / prototipo (`apps/prototipo-posicion`); para Cuentas, los **datos ficticios** del mockup (nunca PII real en fixtures versionados).
- `VITE_USE_MOCKS` decide el origen; `VITE_API_URL` apunta a la API. En CI y dev arrancan con mocks; al cerrar cada milestone de backend, se flipea por feature.

```ts
// src/lib/mocks/browser.ts
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

// src/main.tsx
async function enableMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== "true") return;
  const { worker } = await import("./lib/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}
enableMocks().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
```

---

## M0 — Scaffold + design system + AppLayout (datos mock)

**Objetivo.** Levantar el proyecto **Vite + React + TypeScript + Tailwind + shadcn/ui**, instalar el **design system clementina** (tokens del mockup) y construir el **`AppLayout`** con los **dos sidebars colapsables + topbar de ruta** del mockup. Todo navegable con **datos mock**, sin backend de negocio (solo `/health` + CORS del backend M0).

### Tareas

- [ ] `npm create vite@latest` con template **react-ts**; carpeta de código en `src/`.
- [ ] Instalar y configurar **Tailwind CSS** + **shadcn/ui** (`npx shadcn@latest init`), **react-router**, **TanStack Query**, **axios**, **react-hook-form** + **zod**, **sonner** (toasts), **MSW** (dev).
- [ ] **Estructura `src/`** (ver [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md)):
  - [ ] `app/` (router, providers `QueryClient`/`Auth`, `AppLayout`).
  - [ ] `features/{auth,dashboard,posicion,cuentas,usuarios,config,auditoria}/` (cada una: `pages/`, `components/`, `queries/` o `hooks/`, `types`).
  - [ ] `components/ui/` (shadcn).
  - [ ] `shared/` (`export/`, `format/`, `components/`, `hooks/`).
  - [ ] `lib/` (`apiClient`, `queryClient`, `auth`, `mocks/`).
  - [ ] `styles/` (theme Tailwind).
- [ ] **Design system clementina** en `styles/` (ver [`02-design-system.md`](02-design-system.md)), replicando los tokens del mockup:

  | Token | Valor | Uso |
  |---|---|---|
  | `--amarillo` / `clementina` | `#ffc10e` | acento, fila/ítem activo, foco |
  | `--amarillo-deep` | `#e3a400` | hover del acento, gradiente activo |
  | `--slate` | `#2b4150` | sidebars, topbar, botones oscuros |
  | `--slate-2` / `--slate-3` | `#223340` / `#1c2a34` | sidebar de procesos, hovers |
  | `--cream` | `#f6f2e9` | lienzo (fondo de la app) |
  | `--panel` / `--panel-2` | `#fffdf8` / `#fbf7ee` | tarjetas, cabeceras de tabla |
  | `--ink` / `--ink-soft` | `#21303a` / `#6c7a83` | texto principal / secundario |
  | `--line` / `--line-2` | `#e7e1d3` / `#efeadf` | bordes |
  | Display | **Fraunces** | títulos, KPIs, ruta de la topbar |
  | UI / datos | **Hanken Grotesk** | cuerpo, tablas, formularios |

- [ ] **`AppLayout`** con los **dos sidebars + topbar** del mockup:
  - [ ] **Sidebar de Áreas** (240px, slate): logo La Clementina + lista de áreas con **nombre + ícono** (Dashboard, Acopio, Administración y Finanzas, Comercial, Producción, Dirección, Sistema). **Colapsa a íconos** con la hamburguesa (logo → versión mini). Ítem activo con gradiente amarillo.
  - [ ] **Sidebar de Procesos** (250px, slate-2): procesos del área elegida; activo resaltado, futuros como **Próx.**. Se **oculta/muestra** con el botón circular de flecha en su borde derecho (la flecha gira según estado).
  - [ ] **Topbar** (slate): muestra **solo la ruta** "Área / Proceso" en Fraunces.
  - [ ] Estado de colapso de cada sidebar **persistido** (localStorage) y **responsive** (en móvil, sidebars como overlay).
  - [ ] **Logos**: completo (sidebar expandido) y mini (colapsado), con **respaldo** "LC / La Clementina" si falta la imagen (igual que el mockup).
- [ ] **Router** con `AppLayout` como shell y rutas placeholder para cada feature (todas renderizan una pantalla "en construcción" o el mock del mockup).
- [ ] Pantalla **"Próximamente"** para áreas sin proceso aún (refleja `areas/` del repo: hoy activos Posición de Cereal y Cuentas Corrientes USD; el resto **Próx.**).
- [ ] **Providers** globales: `QueryClientProvider`, `AuthProvider` (stub que devuelve un usuario mock con rol `Admin`), `Toaster` de sonner.
- [ ] **`apiClient`** (axios) creado con `baseURL = VITE_API_URL`, listo aunque todavía no se use contra negocio.
- [ ] **MSW** instalado con handlers vacíos + un handler de `/health` para probar el cableado.
- [ ] **`.env`**: `VITE_API_URL`, `VITE_USE_MOCKS=true`. ESLint + Prettier + scripts (`dev`, `build`, `lint`, `preview`).

### Estructura objetivo

```
LcAgro-Procesos-Front/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tailwind.config.ts
├─ .env  (VITE_API_URL, VITE_USE_MOCKS)
└─ src/
   ├─ app/            router, providers, AppLayout (2 sidebars + topbar)
   ├─ features/       auth, dashboard, posicion, cuentas, usuarios, config, auditoria
   ├─ components/ui/  shadcn
   ├─ shared/         export/, format/, components/, hooks/
   ├─ lib/            apiClient, queryClient, auth, mocks/
   └─ styles/         theme Tailwind clementina
```

### Dependencias

- Ninguna en el front (es el punto de partida).
- Backend **M0** disponible (opcional) para validar `/health` + **CORS** contra la API real.

### Criterios de aceptación

- `npm run dev` levanta y la app es **navegable**: los dos sidebars colapsan/expanden, la topbar muestra la ruta "Área / Proceso", el ítem activo se resalta en amarillo.
- El **theme** coincide con el mockup (colores, tipografías Fraunces/Hanken, lienzo crema).
- Las áreas sin proceso muestran **"Próximamente"**; Posición y Cuentas existen como rutas (aunque sea placeholder/mock).
- `npm run build` genera `dist/` sin errores; `npm run lint` pasa.
- El `apiClient` apunta a `VITE_API_URL` y, con backend M0 arriba, una llamada de prueba a `/health` **pasa CORS**.

### Qué espera del backend

- Nada de negocio. Como mucho, backend **M0** (`/health` + CORS configurado para el origin del front) para validar el cableado de red.

---

## M1 — Auth + rutas protegidas por rol

**Objetivo.** Reemplazar el `AuthProvider` stub por **auth real** contra `/api/auth`: **login**, persistencia de sesión, **interceptor axios** que adjunta el JWT y **refresca** en `401`, y **rutas protegidas por rol/proceso**. A partir de acá el front deja el login mock del mockup.

### Tareas

- [ ] **Feature `auth`** (`features/auth/`): página de **login** con la marca La Clementina (replica la pantalla de login del mockup: gradiente slate + acento), form con `react-hook-form + zod`.
- [ ] **`AuthProvider`** real (context + persistencia):
  - [ ] `login(email, password)` → `POST /api/auth/login` → guarda `accessToken` (memoria) + `refreshToken` (persistido), expone `user` (con roles/procesos).
  - [ ] `logout()` limpia tokens y cache de TanStack Query.
  - [ ] Bootstrap de sesión al cargar: si hay refresh token, intenta `GET /api/auth/me`.
- [ ] **Interceptor axios** (`lib/apiClient`):
  - [ ] **request**: adjunta `Authorization: Bearer <accessToken>`.
  - [ ] **response**: en `401`, llama a `POST /api/auth/refresh` **una sola vez** (cola de requests en vuelo), reintenta; si el refresh falla → `logout` + redirect a `/login`.
- [ ] **Rutas protegidas** (`RequireAuth`, `RequireRole`):

  ```tsx
  // app/router.tsx
  <Route element={<RequireAuth />}>
    <Route element={<AppLayout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route element={<RequireRole policy="Posicion.Read" />}>
        <Route path="/acopio/posicion" element={<PosicionPage />} />
      </Route>
      <Route element={<RequireRole policy="Cuentas.Read" />}>
        <Route path="/admin-finanzas/cuentas" element={<CuentasPage />} />
      </Route>
      <Route element={<RequireRole policy="Admin" />}>
        <Route path="/sistema/usuarios" element={<UsuariosPage />} />
        <Route path="/sistema/config" element={<ConfigPage />} />
        <Route path="/sistema/auditoria" element={<AuditoriaPage />} />
      </Route>
    </Route>
  </Route>
  <Route path="/login" element={<LoginPage />} />
  ```

- [ ] **Roles del front** alineados a las **policies** del backend (ver matriz en [`03-routing-y-layout.md`](03-routing-y-layout.md) y el plan backend):

  | Policy | Roles que la cumplen |
  |---|---|
  | `Posicion.Read` | `Operador (Acopio)`, `Admin`, `SoloLectura` |
  | `Posicion.Write` (ajustes) | `Operador (Acopio)`, `Admin` |
  | `Cuentas.Read` | `Cobranzas`, `Admin`, `SoloLectura` |
  | `Cuentas.Write` (observación) | `Cobranzas`, `Admin` |
  | `Dashboard.Read` | `SoloLectura`, `Cobranzas`, `Operador`, `Admin` |
  | `Admin` | `Admin` |

- [ ] **Navegación condicionada por rol**: el sidebar de áreas/procesos **oculta** lo que el rol no puede ver (un `Cobranzas` no ve Acopio/Posición; `SoloLectura` no ve botones de escritura).
- [ ] **`useAuth()`** y un helper `can(policy)` para mostrar/ocultar acciones (botones de alta/edición) según rol.
- [ ] Pantalla **403** (sin permiso) y redirect a `/login` cuando no hay sesión.
- [ ] **Mock de `/auth`** en MSW (login que devuelve tokens fake + usuarios de prueba por cada rol) para desarrollar antes de que backend M4 cierre.

### Dependencias

- Front **M0** (router, `AuthProvider` stub, `apiClient`).
- Backend **M4** para datos reales (`/api/auth/login` `/refresh` `/me`, policies). Hasta entonces, **mock MSW**.

### Criterios de aceptación

- `login` con credenciales válidas entra a la app y muestra el usuario; credenciales inválidas muestran error (toast / mensaje de form).
- El **JWT viaja** en cada request; un `401` dispara **un** refresh y reintenta; si el refresh falla, redirige a `/login`.
- Un usuario **`SoloLectura`** no ve los botones de escritura ni puede entrar a `/sistema/*` (403); un `Operador (Acopio)` ve Posición pero no Usuarios.
- Recargar la página **mantiene** la sesión (vía refresh token); `logout` la limpia.
- Con `VITE_USE_MOCKS=true` el flujo completo funciona contra MSW; con `false` y backend M4 arriba, contra la API real, **sin tocar componentes**.

### Qué espera del backend

- Backend **M4**: `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`, policies por rol/proceso, `401/403` como `ProblemDetails`.

---

## M2 — Posición + Ajustes + export

**Objetivo.** Construir la feature **`posicion`** completa: **tarjetas por cereal + tabla + filtros (campaña, cereal)** y el **ABM de ajustes** (que reemplaza el `ajustes.xlsx`), más **export** Excel/PDF. La **posición final viene calculada por el backend** (sin ajustes en M1, final en M2); el front **no** recalcula reglas de negocio.

### Tareas

- [ ] **Tipos** del DTO de posición (espejo del read-model backend, ver [`04-data-y-estado.md`](04-data-y-estado.md)):

  ```ts
  // features/posicion/types.ts
  export interface PosicionDto {
    campania: string;          // "2025-2026"
    cereal: string;            // "Soja"
    tnCompra: number;
    precioCompra: number | null;   // null si la campaña solo tiene ventas
    tnVenta: number;
    precioVenta: number | null;    // null si solo compras
    tnCalzadas: number;
    margenUsdTn: number | null;
    margenPct: number | null;
    resultadoUsd: number;
    posicionSinAjustes: number;
    posicionFinal: number;     // llega en backend M2 (= sinAjustes ± ajustes)
  }
  ```

- [ ] **Hooks TanStack Query** (`features/posicion/queries/`):
  - [ ] `usePosicion({ campania, cereal })` → `GET /api/posicion?campania=&cereal=`.
  - [ ] `useCampanias()` → `GET /api/posicion/campanias` (string[] para el selector).
  - [ ] `useAjustes(campania)` → `GET /api/ajustes?campania=`.
  - [ ] **Mutations** `useCrearAjuste` / `useEditarAjuste` / `useEliminarAjuste` (POST/PUT/DELETE) con **invalidación** de `['posicion']` y `['ajustes']` (al tocar un ajuste, la posición final se recalcula del lado servidor y el front refetchea).
- [ ] **`PosicionPage`** replicando el mockup:
  - [ ] **`FilterBar`** con selector de **campaña** (de `useCampanias`) y de **cereal**, más `ExportButtons`.
  - [ ] **Tarjetas por cereal** (`KpiCard` / card del mockup): tn compra/venta, precio, margen, **posición final**, con la tipografía Fraunces en los números grandes.
  - [ ] **`DataTable`** por campaña+cereal con todas las columnas; manejo de **`null`** en precios/margen (mostrar "—", **no** `0`).
- [ ] **ABM de ajustes** (solo `Posicion.Write` = `Operador (Acopio)` / `Admin`):
  - [ ] Tabla de ajustes de la campaña + botón "Nuevo ajuste".
  - [ ] **Form** `react-hook-form + zod`: `cereal`, `tipo` (`arrastre | semilla | canje | produccion_propia`), `tn`, `precioUsd?`, `signo` (`+`/`−`), `nota?`. Validaciones: `tn > 0`, cereal conocido, campaña válida.
  - [ ] **Baja** = soft-delete (DELETE) con confirmación; alta/edición con toast de éxito (`sonner`).
- [ ] **Export** (`shared/export/`, ver [`05-features.md`](05-features.md)): `exportToExcel` (filas de la tabla → `.xlsx`) y `exportToPdf` (impresión/`jsPDF`) de la posición filtrada.
- [ ] **Formato** con `shared/format/` (`usd`, `tn`, `fecha`): números en USD y toneladas con el formato del negocio (locale es-AR).
- [ ] **Mock MSW** de `/posicion`, `/posicion/campanias`, `/ajustes` con los **números reales agregados** del prototipo (sin PII) para desarrollar antes de conectar.
- [ ] **Skeletons** de carga para tarjetas y tabla.

### Flujo de datos (Posición)

```
PosicionPage
   ├─ useCampanias() ───────────► GET /api/posicion/campanias  → selector
   ├─ usePosicion(filtros) ─────► GET /api/posicion?campania=&cereal=  → cards + tabla
   └─ ABM Ajustes
        ├─ useAjustes(campania) ─► GET /api/ajustes?campania=
        └─ mutation (POST/PUT/DELETE /api/ajustes)
                 │ onSuccess → invalidate ['posicion'] + ['ajustes']
                 ▼
        refetch → la tabla muestra la nueva posición FINAL (recalculada por el backend)
```

> **El front no aplica la regla `posición_final = sinAjustes ± ajustes`**: eso lo hace `PosicionService` en el backend. El front solo **dispara** la mutación de ajuste e **invalida** la query de posición para refrescar el número.

### Dependencias

- Front **M0** (layout, theme) y **M1** (guard `Posicion.Read`/`Posicion.Write` sobre las acciones).
- Backend **M1** (posición sin ajustes + campañas) y **M2** (posición final + CRUD de ajustes). Antes de eso, **mock MSW**.

### Criterios de aceptación

- La tabla y las tarjetas muestran los **mismos números** que el prototipo / la query validada (al centavo).
- `precioCompra` / `precioVenta` / `margen` en `null` se muestran como **"—"**, nunca como `0`.
- Cargar un ajuste `+` **aumenta** la posición final tras la invalidación; un `−` la baja; una baja (soft-delete) deja de impactar.
- Solo `Operador (Acopio)` / `Admin` ven el ABM de ajustes; `SoloLectura` ve la posición pero **no** los botones de escritura.
- Export Excel descarga un `.xlsx` con las filas filtradas; export PDF imprime la vista.

### Qué espera del backend

- Backend **M1**: `GET /api/posicion`, `GET /api/posicion/campanias`.
- Backend **M2**: `posicionFinal` en el DTO + `GET/POST/PUT/DELETE /api/ajustes`.

---

## M3 — Cuentas + Observaciones + export

**Objetivo.** Construir la feature **`cuentas`**: **listado paginado por vendedor + KPIs + filtros (búsqueda, vendedor, mínimo USD)** con **paginación server-side**, edición de **Devolución / Observaciones** por cuenta, y **export**. Cuidado especial con **PII** (denominaciones).

### Tareas

- [ ] **Tipos** del DTO de cuentas (espejo del read-model + `PagedResult`, ver [`04-data-y-estado.md`](04-data-y-estado.md)):

  ```ts
  // features/cuentas/types.ts
  export interface CuentaDto {
    vendedor: string;       // viajantes.descripcion (ej. "LC AGRO")
    vendNro: number;        // Clientes.viajante
    cuenta: number;         // Clientes.numero
    denominacion: string;   // PII — no loguear ni persistir
    saldoVencido: number;   // fecha_vencimiento < corte
    saldoAVencer: number;   // fecha_vencimiento >= corte
    saldo: number;          // total USD
    devolucion?: string | null;     // de ObservacionCuenta (AppDb)
    observaciones?: string | null;  // de ObservacionCuenta (AppDb)
  }

  export interface PagedResult<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
  }
  ```

- [ ] **Hooks** (`features/cuentas/queries/`):
  - [ ] `useCuentas({ vendedor, minUsd, q, page, pageSize })` → `GET /api/cuentas?...` → `PagedResult<CuentaDto>` (TanStack Query con `keepPreviousData` para paginar sin parpadeo).
  - [ ] `useGuardarObservacion(cuenta)` → `PUT /api/cuentas/{cuenta}/observacion` `{ devolucion, observaciones }`; **invalida** `['cuentas']`.
- [ ] **`CuentasPage`** replicando el mockup:
  - [ ] **KPIs** arriba (saldo total, vencido, # cuentas) con `KpiCard`.
  - [ ] **`FilterBar`**: búsqueda (`q`), selector de **vendedor**, **mínimo USD** (`minUsd`), `ExportButtons`.
  - [ ] **`DataTable`** **paginada server-side** (controles de página/tamaño), agrupable por vendedor; columnas saldo / vencido / a vencer con formato USD y color según signo.
  - [ ] **Cartel** "datos de ejemplo (ficticios)" cuando se corre contra **mock** (igual que el mockup), que desaparece contra la API real.
- [ ] **Edición de Devolución / Observaciones** (solo `Cuentas.Write` = `Cobranzas` / `Admin`):
  - [ ] Drawer/modal por cuenta con `react-hook-form + zod` (`devolucion`, `observaciones`), guardado con toast de éxito.
- [ ] **Export** (`shared/export/`): Excel/PDF del listado filtrado.
- [ ] **PII**: la `denominacion` **no** se loguea en consola ni se manda a telemetría; los **fixtures** versionados usan datos **ficticios** (nunca razones sociales reales).
- [ ] **Mock MSW** de `/cuentas` (paginado + filtros) y del `PUT` de observación con los **datos ficticios** del mockup.
- [ ] **Skeletons** y estado **vacío** ("sin resultados para el filtro").

### Flujo de datos (Cuentas)

```
CuentasPage
   ├─ useCuentas({ vendedor, minUsd, q, page, pageSize })
   │        └─► GET /api/cuentas?...  → PagedResult<CuentaDto>  (KPIs + tabla)
   └─ Editar observación
        └─ useGuardarObservacion(cuenta)
              └─► PUT /api/cuentas/{cuenta}/observacion { devolucion, observaciones }
                       │ onSuccess → invalidate ['cuentas']
                       ▼
              refetch → la fila muestra la observación guardada
```

> El **saldo** (open-item, `estado='V'`, signo por `operación`, split vencido/a-vencer) lo calcula la **query validada en el backend**; el front solo lista, filtra, pagina y muestra. La observación se mergea por `cuenta` del lado servidor.

### Dependencias

- Front **M0** (layout, `DataTable`, `FilterBar`) y **M1** (guard `Cuentas.Read`/`Cuentas.Write`).
- Backend **M3** (`GET /api/cuentas` paginado + `PUT observación`). Antes, **mock MSW**.

### Criterios de aceptación

- El listado muestra los **mismos saldos** que la query validada, incluido el split **vencido / a vencer**.
- La **paginación server-side** funciona (cambiar de página pide al backend; `keepPreviousData` evita el parpadeo) y los filtros (`q`, `vendedor`, `minUsd`) acotan el resultado.
- Guardar una observación la **persiste** y aparece en el siguiente refetch.
- Solo `Cobranzas` / `Admin` ven la edición; `SoloLectura` solo lee.
- Contra mock se ve el **cartel de datos ficticios**; contra la API real, datos verdaderos (sin volcar PII a logs/fixtures).

### Qué espera del backend

- Backend **M3**: `GET /api/cuentas?vendedor=&minUsd=&q=&page=&pageSize=` (`PagedResult<CuentaDto>`) y `PUT /api/cuentas/{cuenta}/observacion`.

---

## M4 — Usuarios + Config + Auditoría + Dashboard

**Objetivo.** Cerrar las features de **administración** y el **dashboard**: ABM de **usuarios** (`Admin`), **parámetros editables** (`config`), **auditoría** paginada (`Admin`) y el **dashboard** con KPIs que **cruzan** posición + cuentas.

### Tareas

- [ ] **Feature `usuarios`** (`Admin`):
  - [ ] `useUsuarios()` / mutations `crear` / `editar` / `eliminar` → `GET/POST/PUT/DELETE /api/usuarios`.
  - [ ] `UsuariosPage` con `DataTable` (replica la gestión mínima del mockup) + form `react-hook-form + zod` (nombre, email, password en alta, **roles** vía multiselección, activo/inactivo). El `passwordHash` **nunca** se muestra.
- [ ] **Feature `config`** (`Admin`):
  - [ ] `useConfig()` / `useGuardarConfig()` → `GET/PUT /api/config`.
  - [ ] `ConfigPage` con los **parámetros editables** del backend (replica la pantalla de configuración del mockup):

    | Parámetro | Clave | Valor por defecto |
    |---|---|---|
    | Campaña mínima | `campania_minima` | `20232024` |
    | Precio mínimo (USD) | `precio_min` | `50` |
    | Precio máximo (USD) | `precio_max` | `700` |
    | Umbral de saldo (USD) | `umbral_saldo` | `50` |
    | Zona | `zona` | `4` |

  - [ ] Mostrar la **conexión read-only** a MacroGest como informativa (igual que el mockup), no editable desde el front.
- [ ] **Feature `auditoria`** (`Admin`):
  - [ ] `useAuditoria({ desde, hasta, usuario, page, pageSize })` → `GET /api/auditoria` → `PagedResult<AuditDto>`.
  - [ ] `AuditoriaPage` con `FilterBar` (rango de fechas, usuario) + `DataTable` paginada (acción, entidad, usuario, fecha, IP).
- [ ] **Feature `dashboard`**:
  - [ ] `useDashboard()` → `GET /api/dashboard` → `KpisDto` (cruza posición final por cereal/campaña + saldos/vencido de cuentas).
  - [ ] `DashboardPage` con los **KPIs + mini-gráficos** del mockup (`KpiCard` + un componente de gráfico liviano). Es la **home** tras el login.
- [ ] **Mock MSW** de `/usuarios`, `/config`, `/auditoria`, `/dashboard` para desarrollar antes de backend M4/M5.
- [ ] Skeletons + estados de error/empty en las cuatro pantallas.

### Dependencias

- Front **M1** (guard `Admin` para usuarios/config/auditoría; `Dashboard.Read` para dashboard), **M2** y **M3** (el dashboard cruza datos de ambas features).
- Backend **M4** (`/usuarios`) y **M5** (`/config`, `/auditoria`, `/dashboard`). Antes, **mock MSW**.

### Criterios de aceptación

- `Admin` puede dar de alta/baja/editar usuarios y asignar roles; un no-Admin recibe 403 en `/sistema/*`.
- Editar un parámetro en `config` lo **persiste**; volver `precio_max` a `700` reproduce los números validados (lo garantiza el backend; el front solo refleja).
- La auditoría lista las acciones con filtros y paginación.
- El dashboard muestra KPIs **coherentes** con `posicion` y `cuentas` (mismos totales).

### Qué espera del backend

- Backend **M4**: `GET/POST/PUT/DELETE /api/usuarios`.
- Backend **M5**: `GET/PUT /api/config`, `GET /api/auditoria`, `GET /api/dashboard`.

---

## M5 — Pulido + build/deploy

**Objetivo.** Llevar el front a **calidad de producción**: **skeletons** consistentes, **manejo de errores** uniforme (`ProblemDetails` → toasts), **accesibilidad**, **responsive** y **build/deploy** del bundle estático.

### Tareas

- [ ] **Skeletons** consistentes en todas las features (tablas, tarjetas, formularios) durante `isLoading`; estados **vacíos** y de **error** con reintento.
- [ ] **Manejo de errores uniforme**:
  - [ ] Parser de **`ProblemDetails` (RFC7807)** del backend → mensaje legible; errores de validación por campo (`errors`) mapeados al form (`react-hook-form`).
  - [ ] Toasts (`sonner`) para éxito/error de mutaciones; **error boundary** global para fallos de render.
  - [ ] `401` → refresh/redirect (de M1); `403` → pantalla/aviso "sin permiso"; `5xx` → toast genérico sin filtrar detalles internos.
- [ ] **Accesibilidad (a11y)**:
  - [ ] Navegación por teclado en sidebars, tablas y modales; **foco visible** (anillo amarillo clementina); `aria-*` en controles de shadcn.
  - [ ] Contraste suficiente (slate/crema/amarillo cumplen AA en texto principal); `alt` en logos; labels en todos los inputs.
- [ ] **Responsive**: sidebars como **overlay** en móvil/tablet; tablas con scroll horizontal o vista compacta; topbar adaptada. Probar en breakpoints sm/md/lg.
- [ ] **Performance**: **code-splitting** por ruta (lazy de las pages), memoización donde haga falta, `staleTime` razonable en TanStack Query para no sobre-fetchear.
- [ ] **PII en producción**: confirmar que ninguna `denominacion`/saldo se loguea en consola ni telemetría; quitar `console.log` de desarrollo.
- [ ] **Build/deploy**:
  - [ ] `npm run build` → `dist/` optimizado; variables por entorno (`VITE_API_URL`, `VITE_USE_MOCKS=false` en prod).
  - [ ] Servir el estático (el mismo host on-prem del backend o un reverse proxy); **MSW desactivado** en producción.
  - [ ] Smoke test contra la **API real** end-to-end (login → posición → cuentas → dashboard).
- [ ] **Pulido visual final**: comparar lado a lado con el mockup (`apps/mockup-web/capturas/`) y ajustar espaciados, sombras, gradientes del ítem activo, etc.

### Dependencias

- Front **M0–M4** (todas las features construidas).
- Backend **M6** (errores `ProblemDetails` consistentes, API endurecida y **desplegada on-prem** con conexión estable a `192.168.0.20`).

### Criterios de aceptación

- Toda llamada que falla muestra un mensaje **legible** (de `ProblemDetails`), nunca un stack o un error crudo; validaciones por campo en los forms.
- La app es **navegable por teclado**, con foco visible y contraste AA; pasa una auditoría básica de accesibilidad.
- En **móvil/tablet** los sidebars funcionan como overlay y las tablas son usables (sin desbordes rotos).
- `npm run build` genera un `dist/` desplegable; en producción **no** corre MSW y el front habla con la API real.
- El **smoke test** end-to-end (login → posición → cuentas → dashboard) pasa contra el backend on-prem.

### Qué espera del backend

- Backend **M6**: errores `ProblemDetails` RFC7807 consistentes, API endurecida y **desplegada on-prem** (red estable a `192.168.0.20`) para el **release conjunto** y la validación con el negocio.

---

## Resumen: feature ↔ milestone ↔ endpoint ↔ backend

| Feature (front) | Milestone front | Endpoint(s) | Backend que lo habilita |
|---|---|---|---|
| `app` / `AppLayout` (2 sidebars + topbar) | M0 | `/health` (cableo) | M0 |
| `auth` (login, guards, refresh) | M1 | `POST /auth/login` · `/refresh` · `GET /auth/me` | M4 |
| `posicion` (tabla + tarjetas + filtros) | M2 | `GET /posicion` · `/posicion/campanias` | M1 |
| `posicion` (ABM ajustes + posición final) | M2 | `GET/POST/PUT/DELETE /ajustes` | M2 |
| `cuentas` (listado + filtros + paginación) | M3 | `GET /cuentas` | M3 |
| `cuentas` (devolución/observaciones) | M3 | `PUT /cuentas/{cuenta}/observacion` | M3 |
| `usuarios` (ABM accesos) | M4 | `GET/POST/PUT/DELETE /usuarios` | M4 |
| `config` (parámetros editables) | M4 | `GET/PUT /config` | M5 |
| `auditoria` (listado paginado) | M4 | `GET /auditoria` | M5 |
| `dashboard` (KPIs cruzados) | M4 | `GET /dashboard` | M5 |
| Pulido / build / deploy | M5 | toda la API | M6 |

> Todas las features se construyen primero contra **mock MSW** (con el contrato de datos fijo) y se **conectan a la API real** flipeando `VITE_USE_MOCKS` cuando su milestone de backend cierra. La UI no cambia.

## Relacionado

- [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md) — estructura `src/`, providers, `AppLayout` (dos sidebars + topbar de ruta).
- [`03-routing-y-layout.md`](03-routing-y-layout.md) — react-router, rutas protegidas por rol, contexto de auth, refresh token.
- [`04-data-y-estado.md`](04-data-y-estado.md) — TanStack Query, axios + interceptores JWT/refresh, invalidación, DTOs.
- [`05-features.md`](05-features.md) — features y componentes compartidos (`DataTable`, `FilterBar`, `KpiCard`, `ExportButtons`, `PageHeader`).
- [`02-design-system.md`](02-design-system.md) — shadcn/ui, Tailwind, tema clementina/slate/crema, Fraunces + Hanken Grotesk.
- [`06-setup-y-entornos.md`](06-setup-y-entornos.md) — react-hook-form + zod, toasts (sonner), export client-side (Excel/PDF).
- [`../../LcAgro-Procesos/02-desarrollo/11-plan-de-implementacion.md`](../../LcAgro-Procesos/02-desarrollo/11-plan-de-implementacion.md) — plan de milestones del **backend** (espejo de este, columna "Desbloquea en el front").
- [`../../LcAgro-Procesos/apps/mockup-web/README.md`](../../LcAgro-Procesos/apps/mockup-web/README.md) — features y layout del mockup que este front reimplementa.
