# 05 · Features (pantalla por pantalla)

> Documento de **features del frontend** de LcAgro: el catálogo de pantallas que vamos a programar en React + TypeScript, una por una. Es la traducción del **mockup navegable** (`apps/mockup-web/index.html` del repo backend) a la app real, conectada a la **API .NET** (Etapa 9 del roadmap).
>
> Para cada pantalla detallamos: **propósito**, **componentes**, **datos** (qué query/endpoint del backend consume), **estados** (loading / vacío / error), **permisos por rol** y **export**. Cada endpoint queda mapeado explícitamente.

Para arquitectura de carpetas, cliente HTTP, theming y convenciones generales, ver los docs hermanos enlazados en [Relacionado](#relacionado). Acá nos centramos en **el qué de cada pantalla**, no en el cómo transversal.

---

## Índice de pantallas

| # | Pantalla | Ruta | Endpoint(s) principal(es) | Roles que la ven |
|---|---|---|---|---|
| 1 | [Login](#1-login) | `/login` | `POST /api/auth/login` | Público (sin auth) |
| 2 | [Dashboard](#2-dashboard) | `/` | `GET /api/dashboard` | Todos los autenticados |
| 3 | [Posición de Cereal](#3-posicion-de-cereal) | `/posicion` | `GET /api/posicion`, CRUD `/api/ajustes` | Operador(Acopio) · Admin · SoloLectura |
| 4 | [Cuentas Corrientes](#4-cuentas-corrientes-usd) | `/cuentas` | `GET /api/cuentas`, `PUT /api/cuentas/{cuenta}/observacion` | Cobranzas · Admin · SoloLectura |
| 5 | [Usuarios](#5-usuarios) | `/usuarios` | CRUD `/api/usuarios` | Admin |
| 6 | [Configuración](#6-configuracion) | `/config` | `GET/PUT /api/config` | Admin |
| 7 | [Auditoría](#7-auditoria) | `/auditoria` | `GET /api/auditoria` | Admin |
| 8 | [Asistente IA](#8-asistente-ia-mock) | panel embebido | — (mock) | Todos los autenticados |

> Las rutas viven en `app/router` y cada pantalla es una *feature* bajo `features/<nombre>/` (con `pages`, `components`, `queries/hooks`, `types`). La estética, los dos sidebars colapsables y la topbar de ruta replican el mockup: amarillo clementina `#ffc10e`, slate `#2b4150`, lienzo crema; tipografías **Fraunces** (títulos) + **Hanken Grotesk** (cuerpo).

---

## Layout base (común a todas las pantallas autenticadas)

Todas las pantallas salvo Login viven dentro de `AppLayout` (`app/AppLayout.tsx`), que replica el shell del mockup:

```
┌──────────┬──────────────────────────────────────────────────────────┐
│  BRAND   │  TOPBAR (slate):  Área / Proceso        [Campaña] [IA] [EE]│
│ (logo LC)├──────────────┬───────────────────────────────────────────┤
│          │  SIDEBAR 2   │                                            │
│ SIDEBAR 1│  PROCESOS    │   CONTENT (lienzo crema)                   │
│  ÁREAS   │ (del área    │   <Outlet /> de la feature activa          │
│ (íconos+ │  elegida;    │                                            │
│  labels) │  activo res- │   PageHeader · FilterBar · KpiCards ·      │
│          │  altado,     │   DataTable · ...                          │
│ colapsa  │  futuros     │                                            │
│ a íconos │  "Próx.")    │   ◄ botón circular oculta/muestra sidebar 2│
└──────────┴──────────────┴───────────────────────────────────────────┘
                                                   ┌──────────────────┐
                                                   │  PANEL IA (drawer│
                                                   │  lateral derecho)│
                                                   └──────────────────┘
```

- **Sidebar 1 — Áreas:** Dashboard, Acopio, Administración y Finanzas, Comercial · Insumos, Producción, Dirección, Administración del sistema. Se colapsa a íconos con la hamburguesa (el logo pasa a su versión mini). Las áreas sin proceso activo muestran una pantalla "Próximamente".
- **Sidebar 2 — Procesos:** lista los procesos del área elegida; el activo queda resaltado en amarillo y los futuros como `Próx.`. Se oculta/muestra con el círculo de flecha en su borde derecho.
- **Topbar (slate):** muestra la **ruta** `Área / Proceso`, el selector de campaña, el botón del Asistente IA y el avatar del usuario.
- **Item de menú visible por rol:** el menú se arma según los permisos del usuario logueado (ver `04-auth` / matriz de roles). Un usuario Cobranzas no ve el proceso de Acopio, etc.

Componentes compartidos (`shared/components`): `PageHeader`, `FilterBar`, `KpiCard`, `DataTable`, `ExportButtons`. Helpers de formato (`shared/format`): `usd`, `tn`, `fecha`.

---

## 1. Login

**Ruta:** `/login` · **Feature:** `features/auth` · **Mockup:** `capturas/login.png`

### Propósito
Autenticar al usuario y obtener el par de tokens JWT (access + refresh). Es la única pantalla pública; todo lo demás está detrás de rutas protegidas.

### Componentes
- `LoginPage` con el logo de La Clementina sobre fondo slate degradado (replica el mockup).
- Formulario `LoginForm` con **react-hook-form + zod**: campos `email` y `password`, botón **Ingresar**.
- Manejo de error inline (credenciales inválidas) + toast con **sonner**.

```ts
// features/auth/schema.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá la contraseña"),
});
export type LoginInput = z.infer<typeof loginSchema>;
```

### Datos — endpoint
| Acción | Método · endpoint | Request | Response |
|---|---|---|---|
| Iniciar sesión | `POST /api/auth/login` | `{ email, password }` | `{ accessToken, refreshToken, user }` |
| Refresh (automático, vía interceptor axios) | `POST /api/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| Usuario actual (al rehidratar sesión) | `GET /api/auth/me` | — | `UserDto` |

```ts
// features/auth/queries.ts
export function useLogin() {
  const { setSession } = useAuth();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiClient.post<LoginResponse>("/auth/login", input).then(r => r.data),
    onSuccess: (data) => setSession(data),       // guarda tokens + user
    onError: () => toast.error("Email o contraseña incorrectos"),
  });
}
```

El access token se guarda en memoria (context `AuthProvider`) y el refresh persiste para rehidratar; `lib/apiClient` adjunta el `Authorization: Bearer` y refresca ante un `401`. Detalle en `04-auth`.

### Estados
| Estado | UI |
|---|---|
| Inicial | formulario habilitado |
| Enviando | botón con spinner, inputs deshabilitados |
| Error 400/401 | mensaje "Email o contraseña incorrectos" + toast |
| Error de red / API caída | toast "No se pudo conectar con el servidor" |
| Éxito | redirige a `/` (Dashboard) o a la ruta `from` previa |

### Permisos
Público. Si ya hay sesión válida, redirige directo a `/`.

### Export
No aplica.

---

## 2. Dashboard

**Ruta:** `/` · **Feature:** `features/dashboard` · **Mockup:** `capturas/dashboard.png`

### Propósito
Vista de aterrizaje que **cruza los dos procesos** (Posición de Cereal + Cuentas Corrientes) en KPIs y mini-gráficos. Es el "resumen vivo de los procesos conectados a MacroGest".

### Componentes
- `PageHeader` "Dashboard / Resumen vivo de los procesos conectados a MacroGest".
- **Tira de KPIs** (`KpiCard` × 4) con sparkline opcional:
  - **Resultado calzado** (Acopio · campaña actual) — verde.
  - **Compras campaña** (toneladas, 4 cereales).
  - **Cartera vencida** (USD, cuentas) — con badge "datos de ejemplo" mientras Cuentas use ficticios.
  - **Cartera a vencer** (USD).
- **Dos paneles de barras** (`cols2`):
  - *Posición por cereal · campaña actual*: barra por cereal (tn) + posición tn con color (verde/rojo).
  - *Cartera vencida por vendedor*: barra por vendedor con el saldo vencido.

### Datos — endpoint
| Dato | Método · endpoint | Notas |
|---|---|---|
| Todo el dashboard | `GET /api/dashboard` | Devuelve `KpisDto` que cruza posición + cuentas. El backend resuelve el cruce server-side (no se hace en el front). |

```ts
// features/dashboard/types.ts
export interface KpisDto {
  campania: string;                       // ej. "2025-2026"
  resultadoCalzadoUsd: number;
  comprasCampaniaTn: number;
  carteraVencidaUsd: number;
  carteraAVencerUsd: number;
  posicionPorCereal: { cereal: string; tnCompra: number; posicionTn: number }[];
  carteraPorVendedor: { vendedor: string; saldoVencidoUsd: number }[];
}

// features/dashboard/queries.ts
export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiClient.get<KpisDto>("/dashboard").then(r => r.data),
    staleTime: 60_000,
  });
```

> **Regla de negocio (no romper):** los KPIs de posición usan la **posición FINAL** (con ajustes ya aplicados por el backend), no `posicion_sin_ajustes`. El backend aplica los ajustes de `AjustePosicion` antes de devolver. La cartera USD respeta el modelo open-item (solo `estado = 'V'`).

### Estados
| Estado | UI |
|---|---|
| Loading | skeletons en las 4 KPI cards y en los dos paneles |
| Vacío (sin datos de campaña) | KPIs en `—` y panel con "Sin datos para la campaña" |
| Error | banner de error con botón "Reintentar" (refetch) |
| OK | render normal |

### Permisos
Todos los roles autenticados ven el Dashboard (Admin, Operador, Cobranzas, SoloLectura). Lo que se muestra puede recortarse por permisos: un usuario solo-Cuentas podría no ver el bloque de Posición. La política base es **GET de dashboard** habilitado para todos los roles.

### Export
No aplica (el Dashboard no exporta; los datos detallados se exportan desde cada pantalla).

---

## 3. Posición de Cereal

**Ruta:** `/posicion` · **Feature:** `features/posicion` · **Mockup:** `capturas/posicion-cereal.png`

### Propósito
Mostrar la **posición neta por campaña y cereal**: compras − ventas + ajustes, con margen sobre toneladas calzadas. Datos en vivo de MacroGest **validados al centavo** contra el reporte oficial, más los **ajustes** que vienen de la BD propia. Permite **editar ajustes** y **exportar**.

### Componentes
- `PageHeader` "Posición de Cereal / Compras − ventas + ajustes, por campaña y cereal".
- `FilterBar` con:
  - **Campaña** (select, opciones de `GET /api/posicion/campanias`).
  - **Cereal** (select: Todos / Maíz / Trigo / Soja / Girasol / Sorgo / Colza).
- `ExportButtons` (Excel / PDF) + botón **Preguntar a la IA**.
- **Tarjetas por cereal** (`PosicionCard` × N): por cada cereal, margen US$/tn destacado, % de margen como tag verde/rojo, filas Compra / Venta / Resultado calzado / Posición (tn con color según signo). El borde izquierdo es verde si la posición es ≥ 0, rojo si es negativa.
- **Tabla de detalle** (`DataTable`): columnas Cereal · Compra tn · P. compra · Venta tn · P. venta · Calzadas · Margen US$/tn · Resultado US$ · Posición tn.
- **Editor de ajustes** (`AjustesDialog`): tabla CRUD de ajustes de la campaña activa, abierta desde un botón "Ajustes" (visible solo para Operador/Acopio y Admin).

### Datos — endpoints

| Dato | Método · endpoint | Origen backend |
|---|---|---|
| Filas de posición (FINAL, con ajustes) | `GET /api/posicion?campania=&cereal=` → `PosicionDto[]` | Read-model `PosicionRow` de `posicion-combinada.sql` + ajustes aplicados por `PosicionService`. |
| Lista de campañas | `GET /api/posicion/campanias` → `string[]` | Distintas campañas disponibles. |
| Listar ajustes | `GET /api/ajustes?campania=` | Tabla `AjustePosicion` (AppDb Postgres). |
| Crear ajuste | `POST /api/ajustes` | |
| Editar ajuste | `PUT /api/ajustes/{id}` | |
| Baja ajuste | `DELETE /api/ajustes/{id}` | (baja lógica vía `FechaBaja`). |

#### Shape de `PosicionDto` (sale de `posicion-combinada.sql`)

| Campo | Tipo | Significado |
|---|---|---|
| `campania` | string | Formato `2025-2026`. |
| `cereal` | string | Nombre (mapeo `producto`→cereal). |
| `tnCompra` | number | Toneladas compradas (fijadas). |
| `precioCompra` | number \| null | Precio promedio ponderado compra USD. **Puede venir `null`** si la campaña tiene solo ventas. |
| `tnVenta` | number | Toneladas vendidas de producción propia (fijadas). |
| `precioVenta` | number \| null | Precio promedio ponderado venta USD. **`null`** si solo compras. |
| `tnCalzadas` | number | `min(tnCompra, tnVenta)`. |
| `margenUsdTn` | number \| null | `precioVenta − precioCompra`. **`null`** si falta algún precio. |
| `margenPct` | number \| null | `margenUsdTn / precioCompra × 100`. **`null`** si falta precio de compra. |
| `resultadoUsd` | number | `margenUsdTn × tnCalzadas`. |
| `posicionSinAjustes` | number | `tnCompra − tnVenta` (solo MacroGest). |
| `posicionFinal` | number | `posicionSinAjustes ± ajustes` (lo que el front muestra como "Posición"). |

> **Regla de oro (no romper):** la columna **Posición** que se ve en pantalla es `posicionFinal`. La query solo da `posicionSinAjustes`; los **ajustes** (arrastre / semilla / canje / producción propia) viven en `AjustePosicion` (AppDb) y los aplica el **PosicionService** del backend (`Tn × Signo` por campaña+cereal). El front **no** recalcula la posición: la consume ya resuelta. Manejar `precioCompra`/`precioVenta`/`margen*` **nullable** en la UI (mostrar `—` cuando vengan `null`).

```ts
// features/posicion/queries.ts
export const usePosicion = (campania: string, cereal?: string) =>
  useQuery({
    queryKey: ["posicion", campania, cereal ?? "todos"],
    queryFn: () =>
      apiClient
        .get<PosicionDto[]>("/posicion", { params: { campania, cereal } })
        .then(r => r.data),
    enabled: !!campania,
  });

export const useCampanias = () =>
  useQuery({
    queryKey: ["posicion", "campanias"],
    queryFn: () => apiClient.get<string[]>("/posicion/campanias").then(r => r.data),
  });
```

#### Ajustes — shape y mutaciones

```ts
// features/posicion/types.ts
export type TipoAjuste = "arrastre" | "semilla" | "canje" | "produccion_propia";

export interface AjusteDto {
  id: number;
  campania: string;
  cereal: string;
  tipo: TipoAjuste;
  tn: number;
  precioUsd: number | null;
  signo: "+" | "-";
  nota: string | null;
}

// react-hook-form + zod en AjusteForm
export const ajusteSchema = z.object({
  campania: z.string(),
  cereal: z.string(),
  tipo: z.enum(["arrastre", "semilla", "canje", "produccion_propia"]),
  tn: z.number().positive(),
  precioUsd: z.number().min(0).nullable(),
  signo: z.enum(["+", "-"]),
  nota: z.string().max(500).nullable(),
});
```

```ts
// features/posicion/mutations.ts
export function useCrearAjuste(campania: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AjusteInput) =>
      apiClient.post<AjusteDto>("/ajustes", input).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ajustes", campania] });
      qc.invalidateQueries({ queryKey: ["posicion"] });   // la posición final cambia
      toast.success("Ajuste guardado");
    },
  });
}
```

> Al crear/editar/borrar un ajuste hay que **invalidar tanto `["ajustes", …]` como `["posicion", …]`** (y opcionalmente `["dashboard"]`), porque la posición final depende de los ajustes.

### Estados
| Estado | UI |
|---|---|
| Loading | skeletons en las tarjetas y filas de tabla |
| Vacío (campaña sin datos) | "No hay posición para esta campaña / cereal" |
| Error | banner + "Reintentar" |
| Editando ajuste | diálogo modal con form; guardar deshabilita botón y muestra spinner |
| Mutación OK / error | toast (sonner) |

### Permisos por rol
| Acción | Admin | Operador (Acopio) | SoloLectura | Cobranzas |
|---|:---:|:---:|:---:|:---:|
| Ver posición (`GET /api/posicion`) | ✔ | ✔ | ✔ | ✖ |
| Ver campañas | ✔ | ✔ | ✔ | ✖ |
| Exportar Excel/PDF | ✔ | ✔ | ✔ | ✖ |
| CRUD ajustes (`/api/ajustes`) | ✔ | ✔ | ✖ | ✖ |

El botón "Ajustes" y las acciones de editar solo se renderizan si el rol tiene permiso (`<RequireRole roles={["Admin","Operador"]}>`); el backend igual valida por policy.

### Export
- **Excel:** `shared/export/exportToExcel` — exporta las filas filtradas (campaña + cereal) con las columnas de la tabla de detalle. Client-side.
- **PDF:** `shared/export/exportToPdf` — el mockup imprime la vista; en la app se genera un PDF con el detalle + las tarjetas. Client-side.
- Si en el futuro hiciera falta export server-side, el backend expone un `IExportService` (vive en `LcAgro.Shared`); el front lo descargaría como blob. Por defecto **el export es client-side**.

---

## 4. Cuentas Corrientes USD

**Ruta:** `/cuentas` · **Feature:** `features/cuentas` · **Mockup:** `capturas/cuentas-corrientes.png`

### Propósito
Listar los **saldos en USD por cuenta** (cliente), agrupados por vendedor, separando **vencido** y **a vencer** (modelo open-item). Permite filtrar, buscar, editar **Devolución / Observaciones** por cuenta y exportar.

### Componentes
- `PageHeader` "Cuentas Corrientes / Saldos vencidos y a vencer en USD, modelo open-item". Badge "datos de ejemplo" mientras se use data ficticia.
- **Tira de KPIs** (`KpiCard` × 4): Cuentas (en zona 4) · Saldo vencido · Saldo a vencer · Cartera total.
- `FilterBar`:
  - **Buscar cliente** (input `q`, busca por denominación o número de cuenta).
  - **Vendedor** (select, opciones derivadas de los datos / endpoint).
  - **Zona** (fijo en `4 · Clientes`, configurable).
  - **Mín. USD** (input numérico, default `50`).
- `ExportButtons` (Excel / PDF) + **Preguntar a la IA**.
- **Tabla agrupada por vendedor** (`DataTable` con subtotales): filas de grupo "Vendedor · X", filas de cuenta (Cuenta · Cliente · Vencido US$ · A vencer US$ · Saldo US$ · Devolución · Observaciones) y fila de subtotal por vendedor.
- **Celdas editables** Devolución / Observaciones (inline o popover) con guardado por cuenta.

### Datos — endpoints

| Dato | Método · endpoint | Origen backend |
|---|---|---|
| Listado paginado de cuentas | `GET /api/cuentas?vendedor=&minUsd=&q=&page=&pageSize=` → `PagedResult<CuentaDto>` | Read-model `CuentaCorrienteRow` de `cuentas-corrientes-usd.sql` + observaciones de AppDb. |
| Guardar observación de una cuenta | `PUT /api/cuentas/{cuenta}/observacion` con `{ devolucion, observaciones }` | Tabla `ObservacionCuenta` (AppDb). |

#### Shape de `CuentaDto` (sale de `cuentas-corrientes-usd.sql` + observaciones)

| Campo | Tipo | Significado |
|---|---|---|
| `vendedor` | string | `viajantes.descripcion` (ej. `LC AGRO`). |
| `vendNro` | number | Código de viajante (`Clientes.viajante`). |
| `cuenta` | number | Número de cuenta (`Clientes.numero`). |
| `denominacion` | string | Razón social (**PII** — no se versiona; viaja por API autenticada). |
| `saldoVencido` | number | USD con `fecha_vencimiento < corte`. |
| `saldoAVencer` | number | USD con `fecha_vencimiento >= corte`. |
| `saldo` | number | `saldoVencido + saldoAVencer`. |
| `devolucion` | string \| null | Campo editable (AppDb). |
| `observaciones` | string \| null | Campo editable (AppDb). |

> **Regla de negocio (no romper):** el saldo USD = `SUM(±importe_dolar)` (signo según `operacion`) **solo** sobre movimientos `estado = 'V'` (open-item; `'D'` se excluye). El **vendedor** sale de `Clientes.viajante → viajantes`, **no** de la tabla `vendedor`. Filtros: `zona = 4`, `fecha_baja IS NULL`, `|saldo| ≥ umbral` (default 50 USD, configurable). El **corte** que separa vencido / a vencer es parametrizable (default = hoy). Nada de esto lo recalcula el front: lo resuelve la query backend; el front solo filtra/pagina/muestra.

```ts
// features/cuentas/queries.ts
export interface CuentasFilters {
  vendedor?: string;
  minUsd?: number;
  q?: string;
  page: number;
  pageSize: number;
}

export const useCuentas = (filters: CuentasFilters) =>
  useQuery({
    queryKey: ["cuentas", filters],
    queryFn: () =>
      apiClient
        .get<PagedResult<CuentaDto>>("/cuentas", { params: filters })
        .then(r => r.data),
    placeholderData: keepPreviousData,   // paginación sin parpadeo
  });
```

```ts
// features/cuentas/mutations.ts
export function useGuardarObservacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cuenta, ...body }: { cuenta: number; devolucion: string; observaciones: string }) =>
      apiClient.put(`/cuentas/${cuenta}/observacion`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuentas"] });
      toast.success("Observación guardada");
    },
  });
}
```

> Los **KPIs y subtotales por vendedor** se calculan sobre las filas devueltas. Si el listado es paginado server-side, los totales globales (cartera vencida / a vencer) deberían venir del backend en el `PagedResult` (o de un agregado del endpoint) para no totalizar solo la página visible.

### Estados
| Estado | UI |
|---|---|
| Loading | skeletons en KPIs y filas |
| Vacío (sin cuentas que pasen el filtro) | "No hay cuentas con esos filtros" |
| Error | banner + "Reintentar" |
| Guardando observación | celda en estado "guardando", botón deshabilitado |
| Mutación OK / error | toast |
| Paginación | `keepPreviousData` para que la tabla no parpadee |

### Permisos por rol
| Acción | Admin | Cobranzas | SoloLectura | Operador (Acopio) |
|---|:---:|:---:|:---:|:---:|
| Ver listado (`GET /api/cuentas`) | ✔ | ✔ | ✔ | ✖ |
| Exportar Excel/PDF | ✔ | ✔ | ✔ | ✖ |
| Editar Devolución/Observaciones (`PUT …/observacion`) | ✔ | ✔ | ✖ | ✖ |

Las celdas editables solo se vuelven editables para Cobranzas/Admin; SoloLectura las ve en modo lectura.

### Export
- **Excel** (`exportToExcel`) y **PDF** (`exportToPdf`), client-side, con las columnas del listado (Vendedor · Cuenta · Cliente · Vencido · A vencer · Saldo). **Cuidado con la PII:** la `denominacion` es dato personal; el export local del usuario autorizado es válido, pero **no** se versiona ni se sube al repo (regla del proyecto).

---

## 5. Usuarios

**Ruta:** `/usuarios` · **Feature:** `features/usuarios` · **Mockup:** sección "Usuarios" del `index.html` (Administración del sistema)

### Propósito
Gestión de accesos: alta/baja/edición de usuarios, asignación de **rol** y de **procesos** habilitados, y estado activo/inactivo.

### Componentes
- `PageHeader` "Usuarios / Gestión de accesos. Roles y permisos por proceso".
- Botón **Nuevo usuario** (abre `UsuarioDialog`).
- `DataTable`: Usuario · Email · Rol · Procesos · Estado · acciones (Editar).
- `UsuarioForm` (react-hook-form + zod): nombre, email, rol, procesos, activo, password (solo en alta / reset).
- Badge de rol (Admin destacado), `dotstate` Activo/Inactivo.

### Datos — endpoints
| Acción | Método · endpoint |
|---|---|
| Listar | `GET /api/usuarios` |
| Crear | `POST /api/usuarios` |
| Editar | `PUT /api/usuarios/{id}` |
| Baja / desactivar | `DELETE /api/usuarios/{id}` (baja lógica: `Activo = false`) |

```ts
// features/usuarios/types.ts
export interface UsuarioDto {
  id: number;
  nombre: string;
  email: string;
  roles: string[];          // ej. ["Admin"] | ["Operador"] | ["Cobranzas"] | ["SoloLectura"]
  activo: boolean;
  fechaAlta: string;        // ISO
}
```

> Las contraseñas nunca viajan al front en GET: el backend guarda `PasswordHash` (BCrypt). El front solo manda password en el alta o en un reset explícito.

### Estados
Loading (skeleton de filas) · Vacío ("Sin usuarios") · Error · Guardando (dialog con spinner) · toast OK/error · validación de email único (error 409 → mensaje "Ya existe un usuario con ese email").

### Permisos por rol
Solo **Admin**. La ruta está protegida con `<RequireRole roles={["Admin"]}>` y no aparece en el menú para otros roles. El backend valida por policy (`Rol: Admin`).

### Export
No prioritario. Si se agrega, Excel client-side del listado (sin password, sin PII sensible más allá del email corporativo).

---

## 6. Configuración

**Ruta:** `/config` · **Feature:** `features/config` · **Mockup:** sección "Configuración" del `index.html`

### Propósito
Editar los **parámetros del negocio** sin tocar código y mostrar el estado de la conexión a MacroGest (solo lectura). Reemplaza los valores hoy hardcodeados en las queries.

### Componentes
- `PageHeader` "Configuración / Parámetros de la plataforma, conexión y reglas de negocio".
- **Card "Conexión a MacroGest"** (solo lectura): Servidor `192.168.0.20`, Base `msgestion01`, Modo `SOLO LECTURA`, Estado (health check). Datos de salud vienen de `/health`.
- **Card "Reglas de negocio"** (editable): rango de precio plausible, umbral de saldo, campaña mínima, zona, fecha de corte, acceso al editor de **ajustes** y al **mapeo de cereales**.
- `ConfigForm` (react-hook-form + zod) para los parámetros editables.

### Datos — endpoints
| Acción | Método · endpoint |
|---|---|
| Leer parámetros | `GET /api/config` |
| Guardar parámetros | `PUT /api/config` |
| Salud de las conexiones | `GET /health` (MacroGest + AppDb) |

#### Parámetros (tabla `Configuracion` de AppDb)

| Clave | Default | Uso |
|---|---|---|
| `campania_minima` | `20232024` | Filtro de campañas en posición. |
| `precio_min` | `50` | Rango de precio plausible (USD). |
| `precio_max` | `700` | Rango de precio plausible (USD). |
| `umbral_saldo` | `50` | `|saldo| ≥` en cuentas corrientes (USD). |
| `zona` | `4` | `Clientes.zona`. |

```ts
// features/config/types.ts
export interface ConfigDto {
  clave: string;
  valor: string;
  tipo: "int" | "decimal" | "string" | "bool";
  descripcion: string;
}
```

> **Regla:** estos parámetros **no se hardcodean** en el front ni en las queries: salen de `Configuracion`. El **mapeo producto→cereal** (1 Maíz, 2 Trigo, 9 Sorgo, 10 Soja, 18 Girasol, 65 Colza) vive como constante en `LcAgro.Shared` (o en `Configuracion`) y está **a confirmar con el cliente** — la pantalla lo muestra como "a confirmar con el negocio".

### Estados
Loading (skeleton) · Error · Guardando · toast OK/error · validación zod (rango de precios coherente: `precio_min < precio_max`, umbrales ≥ 0).

### Permisos por rol
Solo **Admin** (ruta protegida + policy backend). Las cards de conexión son solo lectura para todos; la edición de reglas es exclusiva de Admin.

### Export
No aplica.

---

## 7. Auditoría

**Ruta:** `/auditoria` · **Feature:** `features/auditoria` · **Mockup:** no figura en el mockup (capability nueva de la app real, definida en las decisiones canónicas)

### Propósito
Registro de **quién hizo qué y cuándo**: consultas y ediciones sobre ajustes, observaciones, usuarios y configuración. Trazabilidad para Dirección/Admin.

### Componentes
- `PageHeader` "Auditoría / Registro de acciones de la plataforma".
- `FilterBar`: rango de fechas (`desde` / `hasta`), usuario, y paginación.
- `DataTable` paginada: Fecha · Usuario · Acción · Entidad · EntidadId · IP · (detalle/diff en `Datos` jsonb, expandible).

### Datos — endpoint
| Acción | Método · endpoint |
|---|---|
| Listar auditoría | `GET /api/auditoria?desde=&hasta=&usuario=&page=&pageSize=` → `PagedResult<AuditDto>` |

```ts
// features/auditoria/types.ts
export interface AuditDto {
  id: number;
  usuarioId: number;
  usuario: string;
  accion: string;          // ej. "crear", "editar", "eliminar", "consultar"
  entidad: string;         // ej. "AjustePosicion", "ObservacionCuenta", "Usuario"
  entidadId: string | null;
  datos: unknown;          // jsonb (diff / payload)
  ip: string | null;
  fecha: string;           // ISO
}
```

> El backend escribe `AuditLog` vía un **interceptor de auditoría** (Infrastructure). El front solo **lee**; nunca escribe auditoría directamente.

### Estados
Loading (skeleton) · Vacío ("Sin registros en el rango") · Error · Paginación con `keepPreviousData`.

### Permisos por rol
Solo **Admin**.

### Export
Opcional: Excel client-side del rango filtrado (útil para reportes a Dirección). Sin PII más allá de lo que el log guarde.

---

## 8. Asistente IA (mock)

**Ubicación:** panel/drawer lateral derecho, accesible desde el botón de la topbar y desde el botón "Preguntar a la IA" de Posición y Cuentas · **Feature:** `features/asistente` (o `shared/components/AiPanel`) · **Mockup:** `capturas/asistente-ia.png`

### Propósito
Materializar la visión de "IA en la app": un panel conversacional que responde sobre los datos (posición de cereal y cuentas corrientes). **Hoy es un mock** (respuestas embebidas), como en el mockup; en el futuro se integra con un modelo real + las consultas validadas.

### Componentes
- `AiPanel`: drawer lateral (380px) con `scrim` de fondo, cabecera slate con ícono spark, cuerpo de mensajes (`msg bot` / `msg me`), chips de sugerencias y un input de pregunta.
- Botón en topbar (`toggleAI`) y botones "Preguntar a la IA" en las toolbars de Posición y Cuentas.

### Datos — endpoint
- **Hoy:** **mock**, sin endpoint. Respuestas predefinidas (como en el mockup: soja / mayor saldo vencido / mejor margen / default). Se implementa como un servicio local que matchea palabras clave.
- **Futuro:** endpoint tipo `POST /api/asistente` (streaming) que combine un modelo con los datos de posición y cuentas. **No** está en el alcance de v1 — el panel queda cableado para enchufarlo después.

```ts
// features/asistente/mock.ts  (placeholder hasta integrar el endpoint real)
const RESPUESTAS = {
  soja: "En 2025-2026 la soja tiene posición −1.977 tn. Margen +3,79 USD/tn …",
  vencido: "El mayor saldo vencido es Estancia Los Álamos …",
  margen: "El mejor margen es Trigo: +8,94 USD/tn …",
  default: "Puedo ayudarte con posición de cereal y cuentas corrientes.",
};
export function responderMock(pregunta: string): string {
  const t = pregunta.toLowerCase();
  if (t.includes("soja")) return RESPUESTAS.soja;
  if (t.includes("venc") || t.includes("cobr")) return RESPUESTAS.vencido;
  if (t.includes("margen") || t.includes("mejor")) return RESPUESTAS.margen;
  return RESPUESTAS.default;
}
```

### Estados
Cerrado (drawer fuera de pantalla) · Abierto · "Pensando" (delay simulado antes de la respuesta del bot) · Mensaje del usuario / del bot.

### Permisos por rol
Todos los autenticados pueden abrir el panel. Cuando se integre el endpoint real, la IA solo respondería con datos a los que el rol tenga acceso (un Cobranzas no obtendría detalle de posición).

### Export
No aplica.

---

## Mapa pantalla → endpoint (resumen)

```
Login            ──> POST /api/auth/login   (+ /auth/refresh, /auth/me)
Dashboard        ──> GET  /api/dashboard
Posición         ──> GET  /api/posicion           ?campania=&cereal=
                     GET  /api/posicion/campanias
                     GET/POST/PUT/DELETE /api/ajustes
Cuentas          ──> GET  /api/cuentas            ?vendedor=&minUsd=&q=&page=&pageSize=
                     PUT  /api/cuentas/{cuenta}/observacion
Usuarios         ──> GET/POST/PUT/DELETE /api/usuarios          (Admin)
Configuración    ──> GET/PUT /api/config           (+ GET /health)  (Admin)
Auditoría        ──> GET  /api/auditoria           ?desde=&hasta=&usuario=&page= (Admin)
Asistente IA     ──> (mock; futuro POST /api/asistente)
```

Todos los endpoints van bajo `/api`, devuelven JSON, los errores siguen **ProblemDetails (RFC 7807)** y requieren **JWT** salvo `login`. La paginación usa `PagedResult<T>` (`items`, `total`, `page`, `pageSize`).

---

## Matriz de roles × pantalla (resumen)

| Pantalla | Admin | Operador (Acopio) | Cobranzas | SoloLectura |
|---|:---:|:---:|:---:|:---:|
| Login | público | público | público | público |
| Dashboard | ✔ | ✔ | ✔ | ✔ |
| Posición · ver/export | ✔ | ✔ | ✖ | ✔ |
| Posición · CRUD ajustes | ✔ | ✔ | ✖ | ✖ |
| Cuentas · ver/export | ✔ | ✖ | ✔ | ✔ |
| Cuentas · observaciones | ✔ | ✖ | ✔ | ✖ |
| Usuarios | ✔ | ✖ | ✖ | ✖ |
| Configuración | ✔ | ✖ | ✖ | ✖ |
| Auditoría | ✔ | ✖ | ✖ | ✖ |
| Asistente IA | ✔ | ✔ | ✔ | ✔ |

Las rutas se protegen con un wrapper `RequireRole` en el router; el menú se arma según permisos; y el backend **siempre** revalida por policy (la UI esconde, pero no es la fuente de verdad de autorización).

---

## Relacionado

- [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md) — visión del frontend y su relación con el backend; estructura de carpetas (`app/`, `features/`, `shared/`, `lib/`) y stack.
- [`02-design-system.md`](02-design-system.md) — colores, tipografías y replicación de la estética del mockup; `DataTable`, `FilterBar`, `KpiCard`, `ExportButtons`, helpers de formato y export.
- [`03-routing-y-layout.md`](03-routing-y-layout.md) — routing, layout (dos sidebars + topbar), guards por rol.
- [`04-data-y-estado.md`](04-data-y-estado.md) — TanStack Query, `apiClient` axios, invalidación, paginación; JWT access/refresh, context de auth y manejo de errores.
