# 04 · Data y estado (front)

> Cómo el frontend habla con la API .NET y cómo maneja el estado: `apiClient` (axios) con
> JWT + refresh, **TanStack Query** para el server state, **Auth/sesión** en context, manejo
> global de errores (toasts + ProblemDetails), loading con skeletons y variables de entorno.
>
> Stack: **Vite + React + TypeScript + Tailwind + shadcn/ui**. Librerías de datos:
> **TanStack Query**, **axios**, **react-hook-form + zod**, **sonner**.

Este doc cubre la capa de datos del front. La **estructura de carpetas** y el ruteo viven en
[`03-routing-y-layout.md`](03-routing-y-layout.md); el **contrato de la API** (endpoints,
roles, ProblemDetails) en [`05-api-contratos.md`](../../LcAgro-Procesos/02-desarrollo/05-api-contratos.md).

---

## 0. Mapa mental

```
                         VITE_API_URL
                              │
  ┌───────────────┐   axios   ▼   ┌──────────────────────┐
  │  React (UI)   │ ───────────►  │   apiClient (lib/)    │
  │  components   │               │  baseURL = API_URL    │
  └──────┬────────┘               │  interceptor request: │
         │ hooks                  │   adjunta Bearer JWT   │
         ▼                        │  interceptor response:│
  ┌───────────────┐   queryFn     │   401 → refresh + retry│
  │ TanStack Query│ ────────────► │  errores → ProblemDet. │
  │  cache + keys │               └──────────┬───────────┘
  └──────┬────────┘                          │ HTTP JSON
         │ data / isLoading / error          ▼
         ▼                          ┌──────────────────┐
  ┌───────────────┐                 │  API .NET (/api) │
  │ Skeletons     │                 │  JWT, RFC7807    │
  │ Toasts (sonner)                 └──────────────────┘
  └───────────────┘
         ▲
         │ usuario + roles
  ┌───────────────┐
  │ AuthContext   │  access token en memoria · refresh persistido
  └───────────────┘
```

Tres piezas y una regla por pieza:

| Pieza | Responsabilidad | Regla de oro |
|---|---|---|
| `apiClient` (axios) | transporte HTTP, adjuntar JWT, refrescar ante 401, normalizar errores | los componentes **nunca** usan `fetch`/`axios` directo; siempre vía hooks |
| TanStack Query | cache del **server state**, dedupe, invalidación, loading/error | nada de server state en `useState`/Redux; va en la cache de Query |
| AuthContext | usuario + roles + tokens, login/logout | el **access token vive en memoria**; el refresh se persiste aparte |

---

## 1. Variables de entorno

Vite expone al cliente **solo** las variables con prefijo `VITE_`. Tipamos `import.meta.env`
para no usar strings sueltos.

`.env.development` / `.env.production` (no se commitean los `.env.local`):

```bash
# URL base de la API .NET. Sin slash final.
VITE_API_URL=http://localhost:5080/api
```

`.env.example` (sí se commitea, como plantilla):

```bash
VITE_API_URL=
```

Tipado en `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Acceso centralizado (un único lugar que lee `import.meta.env`, así el resto del código no
depende de Vite y falla temprano si falta la var):

```ts
// src/lib/env.ts
const env = {
  apiUrl: import.meta.env.VITE_API_URL,
} as const;

if (!env.apiUrl) {
  throw new Error(
    "Falta VITE_API_URL. Copiá .env.example a .env.development y completala.",
  );
}

export { env };
```

> **Nota:** `VITE_API_URL` ya incluye el `/api`. Por eso en `apiClient` las rutas se escriben
> sin ese prefijo: `apiClient.get("/posicion")`, no `/api/posicion`.

---

## 2. apiClient (axios)

Vive en `src/lib/api-client.ts`. Una sola instancia de axios con `baseURL`, dos interceptores
(request: adjunta el JWT; response: maneja 401 con refresh y normaliza errores) y un puente
para que el `AuthContext` le inyecte cómo leer/refrescar/limpiar tokens sin crear un import
circular.

### 2.1 El problema del ciclo (apiClient ↔ Auth)

`apiClient` necesita el access token (que vive en el AuthContext) y el AuthContext necesita
`apiClient` para hacer login/refresh. Para no acoplarlos, el cliente expone un pequeño
**registro de callbacks** que Auth completa al montar:

```ts
// src/lib/api-client.ts
import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { env } from "./env";

// --- Puente con la capa de Auth (lo completa AuthProvider) ---
type TokenBridge = {
  getAccessToken: () => string | null;
  // Devuelve el nuevo access token o null si no se pudo refrescar.
  refresh: () => Promise<string | null>;
  // Se llama cuando el refresh falla → forzar logout.
  onAuthFailure: () => void;
};

let bridge: TokenBridge = {
  getAccessToken: () => null,
  refresh: async () => null,
  onAuthFailure: () => {},
};

export function setTokenBridge(b: TokenBridge) {
  bridge = b;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiUrl, // ya incluye /api
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});
```

### 2.2 Interceptor de request — adjunta el Bearer

```ts
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = bridge.getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});
```

### 2.3 Interceptor de response — refresh ante 401

Reglas del flujo:

- Un **401** dispara un intento de refresh **una sola vez** por request (flag `_retry`).
- Si llegan **varios 401 en paralelo**, comparten **un único** refresh en vuelo
  (`refreshPromise`); no se dispara un refresh por cada request.
- Si el refresh **funciona**, se reintenta el request original con el token nuevo.
- Si el refresh **falla**, se llama `onAuthFailure()` (logout) y se propaga el error.
- El endpoint de **refresh** y el de **login** se excluyen del retry (si fallan, fallan).

```ts
type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

const AUTH_PATHS = ["/auth/login", "/auth/refresh"];

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";
    const isAuthCall = AUTH_PATHS.some((p) => url.includes(p));

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;

      // Coalescemos: un solo refresh para todos los 401 concurrentes.
      refreshPromise ??= bridge.refresh().finally(() => {
        refreshPromise = null;
      });

      const newToken = await refreshPromise;

      if (newToken) {
        original.headers.set("Authorization", `Bearer ${newToken}`);
        return apiClient(original); // reintento
      }

      bridge.onAuthFailure(); // refresh falló → logout
    }

    return Promise.reject(error);
  },
);
```

> **Por qué `??=` para `refreshPromise`:** garantiza que aunque cinco queries reciban 401 al
> mismo tiempo, se llame `bridge.refresh()` **una vez**. Las demás esperan la misma promesa.

---

## 3. Errores y ProblemDetails

La API devuelve errores con **ProblemDetails (RFC 7807)**. Los normalizamos a una forma propia
para que toda la UI los consuma igual, y mostramos toasts con **sonner**.

### 3.1 Forma del ProblemDetails que manda la API

```jsonc
// 400 de validación (FluentValidation → ValidationProblemDetails)
{
  "type": "https://httpstatuses.io/400",
  "title": "Hubo errores de validación.",
  "status": 400,
  "errors": {
    "Tn": ["Las toneladas deben ser mayores a 0."],
    "PrecioUsd": ["El precio debe estar entre 50 y 700."]
  },
  "traceId": "00-abc...-01"
}
```

```jsonc
// 403, 404, 409, 500 → ProblemDetails simple
{
  "type": "https://httpstatuses.io/409",
  "title": "Ya existe un ajuste para esa campaña y cereal.",
  "status": 409,
  "detail": "El ajuste de arrastre para Soja 2025-2026 ya fue cargado.",
  "traceId": "00-def...-01"
}
```

### 3.2 Tipos y parser

```ts
// src/lib/api-error.ts
import { AxiosError } from "axios";

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>; // validación (campo → mensajes)
  traceId?: string;
}

export interface AppError {
  status: number;
  /** Mensaje listo para mostrar en un toast. */
  message: string;
  /** Errores por campo, para mapear a react-hook-form. */
  fieldErrors?: Record<string, string[]>;
  traceId?: string;
}

const FALLBACK = "Ocurrió un error inesperado. Probá de nuevo.";

export function toAppError(error: unknown): AppError {
  if (error instanceof AxiosError) {
    // Sin respuesta del server (red caída, VPN de MacroGest, CORS).
    if (!error.response) {
      return { status: 0, message: "No se pudo conectar con el servidor." };
    }

    const pd = error.response.data as ProblemDetails | undefined;
    const status = error.response.status;

    // 401 ya lo maneja el interceptor; si llega acá, sesión vencida.
    if (status === 401) {
      return { status, message: "Tu sesión expiró. Iniciá sesión de nuevo." };
    }

    return {
      status,
      message: pd?.detail ?? pd?.title ?? mensajePorStatus(status),
      fieldErrors: pd?.errors,
      traceId: pd?.traceId,
    };
  }

  return { status: 0, message: FALLBACK };
}

function mensajePorStatus(status: number): string {
  switch (status) {
    case 403:
      return "No tenés permiso para esta acción.";
    case 404:
      return "No se encontró el recurso.";
    case 409:
      return "El recurso entró en conflicto con el estado actual.";
    case 422:
      return "Los datos enviados no son válidos.";
    case 500:
      return "Error del servidor. Avisale al equipo si persiste.";
    default:
      return FALLBACK;
  }
}
```

### 3.3 Toasts globales desde el QueryClient

En vez de poner un `try/catch` con toast en cada hook, centralizamos en el **QueryCache /
MutationCache** del `QueryClient`. Así toda query/mutation que falle muestra un toast salvo que
explícitamente lo silencie.

```ts
// src/lib/query-client.ts
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { toAppError } from "./api-error";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Las queries "de fondo" (refetch silencioso) no spamean toasts.
      if (query.meta?.silentError) return;
      const e = toAppError(error);
      // 401 lo gestiona el flujo de auth; no lo mostramos como toast suelto.
      if (e.status === 401) return;
      toast.error(e.message);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      // Si la mutation maneja su propio error (ej. errores por campo en un form),
      // marca meta.silentError y se encarga ella.
      if (mutation.meta?.silentError) return;
      const e = toAppError(error);
      if (e.status === 401) return;
      toast.error(e.message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min: datos "frescos" sin refetch
      gcTime: 5 * 60_000, // 5 min en cache tras quedar sin observadores
      retry: (failureCount, error) => {
        const e = toAppError(error);
        // No reintentar errores "de negocio" ni auth; sí los 5xx/red.
        if (e.status === 401 || e.status === 403 || e.status === 404) return false;
        if (e.status >= 400 && e.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // datos contables: no recargar al volver al tab
    },
    mutations: {
      retry: false,
    },
  },
});
```

Tipado de `meta` (para que `silentError` sea type-safe):

```ts
// src/lib/query-meta.d.ts
import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { silentError?: boolean };
    mutationMeta: { silentError?: boolean };
  }
}
```

> Las **toasts de éxito** (ej. "Ajuste guardado") **no** son globales: van en el `onSuccess`
> de cada mutation, porque el copy depende del caso. Ver §6.

---

## 4. Sonner (montaje)

Un solo `<Toaster />` en el árbol, en los providers raíz (ver §8). Tema alineado al mockup
(slate + crema), posición arriba a la derecha.

```tsx
// dentro de AppProviders
import { Toaster } from "sonner";

<Toaster
  position="top-right"
  richColors
  closeButton
  toastOptions={{ duration: 4000 }}
/>;
```

---

## 5. TanStack Query — convenciones

### 5.1 Query keys por feature (key factories)

Cada feature exporta un objeto `xxxKeys` con sus claves. Esto evita strings mágicos y hace la
**invalidación quirúrgica**: invalidás `posicionKeys.all` y se refrescan todas las variantes;
invalidás una key específica y solo esa.

| Feature | Key | Significado |
|---|---|---|
| posición | `["posicion"]` | raíz (invalida todo lo de posición) |
| posición | `["posicion","list",{campania,cereal}]` | tabla filtrada |
| posición | `["posicion","campanias"]` | combo de campañas |
| ajustes | `["ajustes","list",{campania}]` | ajustes de una campaña |
| cuentas | `["cuentas","list",{vendedor,minUsd,q,page,pageSize}]` | listado paginado |
| dashboard | `["dashboard"]` | KPIs cruzados |
| usuarios | `["usuarios","list"]` / `["usuarios","detail",id]` | ABM |
| config | `["config"]` | parámetros |
| auditoría | `["auditoria","list",{desde,hasta,usuario,page,pageSize}]` | log paginado |

```ts
// src/features/posicion/queries/keys.ts
export const posicionKeys = {
  all: ["posicion"] as const,
  lists: () => [...posicionKeys.all, "list"] as const,
  list: (filtros: { campania?: string; cereal?: string }) =>
    [...posicionKeys.lists(), filtros] as const,
  campanias: () => [...posicionKeys.all, "campanias"] as const,
};
```

```ts
// src/features/cuentas/queries/keys.ts
export interface CuentasFiltros {
  vendedor?: string;
  minUsd?: number;
  q?: string;
  page: number;
  pageSize: number;
}

export const cuentasKeys = {
  all: ["cuentas"] as const,
  lists: () => [...cuentasKeys.all, "list"] as const,
  list: (f: CuentasFiltros) => [...cuentasKeys.lists(), f] as const,
};
```

> **Regla:** los filtros van **dentro** de la key como objeto. Cambiar un filtro = otra key =
> otra entrada de cache (y otro fetch). Volver al filtro anterior = **cache hit** instantáneo.

### 5.2 Tipos de respuesta (alineados al contrato de la API)

Espejan los DTOs/read-models del backend. Definidos en `features/<x>/types.ts`. Recordá: los
precios y márgenes de posición pueden venir **`null`** (campañas con solo compras o solo ventas).

```ts
// src/features/posicion/types.ts
// La API ya aplicó los ajustes de la BD propia: posicionFinal es la definitiva.
export interface PosicionDto {
  campania: string;
  cereal: string;
  tnCompra: number;
  precioCompra: number | null;
  tnVenta: number;
  precioVenta: number | null;
  tnCalzadas: number;
  margenUsdTn: number | null;
  margenPct: number | null;
  resultadoUsd: number;
  posicionSinAjustes: number;
  posicionFinal: number; // posicionSinAjustes ± ajustes (AppDb)
}
```

```ts
// src/shared/types/paged.ts
// Espeja PagedResult<T> del backend (LcAgro.Shared).
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

```ts
// src/features/cuentas/types.ts
export interface CuentaDto {
  vendedor: string;
  vendNro: number;
  cuenta: number;
  denominacion: string; // PII: no se loguea ni se cachea fuera de la sesión
  saldoVencido: number;
  saldoAVencer: number;
  saldo: number;
}
```

### 5.3 Queries (hooks)

```ts
// src/features/posicion/queries/use-posicion.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { posicionKeys } from "./keys";
import type { PosicionDto } from "../types";

interface Filtros {
  campania?: string;
  cereal?: string;
}

async function fetchPosicion(f: Filtros): Promise<PosicionDto[]> {
  const { data } = await apiClient.get<PosicionDto[]>("/posicion", {
    params: { campania: f.campania, cereal: f.cereal || undefined },
  });
  return data;
}

export function usePosicion(filtros: Filtros) {
  return useQuery({
    queryKey: posicionKeys.list(filtros),
    queryFn: () => fetchPosicion(filtros),
    // Solo dispara cuando ya hay una campaña elegida.
    enabled: Boolean(filtros.campania),
    // Mientras cambia el filtro, mantiene la data vieja visible (sin parpadeo).
    placeholderData: (prev) => prev,
  });
}
```

```ts
// src/features/posicion/queries/use-campanias.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { posicionKeys } from "./keys";

export function useCampanias() {
  return useQuery({
    queryKey: posicionKeys.campanias(),
    queryFn: async () => {
      const { data } = await apiClient.get<string[]>("/posicion/campanias");
      return data;
    },
    staleTime: 30 * 60_000, // las campañas casi no cambian: 30 min
  });
}
```

Listado **paginado** de cuentas, con `placeholderData` para que la paginación no parpadee:

```ts
// src/features/cuentas/queries/use-cuentas.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { cuentasKeys, type CuentasFiltros } from "./keys";
import type { CuentaDto } from "../types";
import type { PagedResult } from "@/shared/types/paged";

export function useCuentas(filtros: CuentasFiltros) {
  return useQuery({
    queryKey: cuentasKeys.list(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<PagedResult<CuentaDto>>("/cuentas", {
        params: {
          vendedor: filtros.vendedor || undefined,
          minUsd: filtros.minUsd,
          q: filtros.q || undefined,
          page: filtros.page,
          pageSize: filtros.pageSize,
        },
      });
      return data;
    },
    placeholderData: (prev) => prev, // mantiene la página anterior al pasar de página
  });
}
```

### 5.4 Consumo en la página + estados loading/error

```tsx
// src/features/posicion/pages/posicion-page.tsx (extracto)
import { usePosicion } from "../queries/use-posicion";
import { PosicionTableSkeleton } from "../components/posicion-table-skeleton";
import { ErrorState } from "@/shared/components/error-state";

export function PosicionPage({ campania, cereal }: { campania?: string; cereal?: string }) {
  const { data, isPending, isError, error, refetch, isFetching } = usePosicion({
    campania,
    cereal,
  });

  if (isPending) return <PosicionTableSkeleton rows={6} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <PosicionTable
      rows={data}
      // refetch en segundo plano (cambio de filtro): overlay sutil, no skeleton
      refreshing={isFetching}
    />
  );
}
```

| Estado de Query | Qué mostrar |
|---|---|
| `isPending` (primer fetch, sin data) | **skeleton** (placeholder de la forma final) |
| `isFetching` con data previa (cambio de filtro/página) | data vieja + overlay/spinner sutil |
| `isError` | `ErrorState` con mensaje (`toAppError`) + botón "Reintentar" |
| `data` vacío (`[]`) | empty state ("No hay datos para estos filtros") |

> **`isPending` vs `isLoading`:** en TanStack Query v5 usá `isPending` (no hay data todavía).
> `isLoading` = `isPending && isFetching`. Para "primera carga = skeleton" alcanza `isPending`.

---

## 6. Mutations (escrituras)

Todo lo que escribe va a la **BD propia** vía API (MacroGest es solo lectura). Patrón: la
mutation hace el `POST/PUT/DELETE`, en `onSuccess` **invalida** las keys afectadas y muestra
toast de éxito; los errores **por campo** se mapean al form (silenciando el toast global).

```ts
// src/features/ajustes/queries/use-guardar-ajuste.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { ajustesKeys } from "./keys";
import { posicionKeys } from "@/features/posicion/queries/keys";
import type { AjusteDto, AjusteInput } from "../types";

export function useGuardarAjuste() {
  const qc = useQueryClient();

  return useMutation({
    // El form maneja errores 400 por campo → silenciamos el toast global.
    meta: { silentError: true },
    mutationFn: async (input: AjusteInput) => {
      const { data } = input.id
        ? await apiClient.put<AjusteDto>(`/ajustes/${input.id}`, input)
        : await apiClient.post<AjusteDto>("/ajustes", input);
      return data;
    },
    onSuccess: (_data, vars) => {
      // Un ajuste cambia la POSICIÓN FINAL → invalidar ambas features.
      qc.invalidateQueries({ queryKey: ajustesKeys.list({ campania: vars.campania }) });
      qc.invalidateQueries({ queryKey: posicionKeys.all }); // recalcula posición con ajustes
      toast.success("Ajuste guardado.");
    },
  });
}
```

### 6.1 Mapear errores por campo a react-hook-form

```tsx
// dentro del componente del form (react-hook-form + zod)
import { toAppError } from "@/lib/api-error";

const guardar = useGuardarAjuste();

const onSubmit = form.handleSubmit(async (values) => {
  try {
    await guardar.mutateAsync(values);
    form.reset();
  } catch (err) {
    const e = toAppError(err);
    if (e.fieldErrors) {
      // ProblemDetails.errors: { "Tn": ["..."], "PrecioUsd": ["..."] }
      for (const [campo, mensajes] of Object.entries(e.fieldErrors)) {
        const name = campo.charAt(0).toLowerCase() + campo.slice(1); // Tn → tn
        form.setError(name as never, { message: mensajes[0] });
      }
    } else {
      toast.error(e.message); // error no-de-validación: toast manual (lo silenciamos arriba)
    }
  }
});
```

> **`mutateAsync` vs `mutate`:** usamos `mutateAsync` cuando queremos `await`/`try-catch` en el
> submit (caso forms con errores por campo). Para "disparar y olvidar" alcanza `mutate` con
> `onError`/`onSuccess`.

### 6.2 Observación de cuenta (Cobranzas)

```ts
// src/features/cuentas/queries/use-guardar-observacion.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cuentasKeys } from "./keys";

interface ObservacionInput {
  cuenta: number;
  devolucion: string;
  observaciones: string;
}

export function useGuardarObservacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cuenta, ...body }: ObservacionInput) =>
      apiClient.put(`/cuentas/${cuenta}/observacion`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKeys.lists() });
      toast.success("Observación guardada.");
    },
  });
}
```

### 6.3 Reglas de invalidación (quién invalida a quién)

| Mutation | Invalida |
|---|---|
| crear/editar/borrar **ajuste** | `ajustesKeys.list(campania)` **+** `posicionKeys.all` **+** `["dashboard"]` |
| guardar **observación** de cuenta | `cuentasKeys.lists()` |
| ABM **usuario** | `usuariosKeys.all` |
| guardar **config** (parámetros) | `["config"]` **+** `posicionKeys.all` **+** `cuentasKeys.all` (cambian filtros/umbral/corte) |

> El **dashboard** (`GET /api/dashboard`) cruza posición + cuentas: cualquier cambio que afecte
> esos números debería invalidar también `["dashboard"]`.

---

## 7. Auth / sesión

### 7.1 Estrategia de tokens

- **Access token (JWT): en memoria** (variable del context). Corto, expira rápido. No va a
  `localStorage` (mitiga XSS).
- **Refresh token: persistido** para sobrevivir un reload. Idealmente en **cookie HttpOnly**
  puesta por el backend (la mejor opción); como mínimo viable, `localStorage` con la consciencia
  del trade-off. Este doc asume **refresh persistido por el front** (`localStorage`) y deja la
  cookie HttpOnly como mejora del backend.
- Al **montar la app**: si hay refresh guardado, se intenta `POST /auth/refresh` para
  rehidratar la sesión (silenciosamente). Mientras tanto, la UI muestra un estado "cargando
  sesión".

```
   Reload de la página
          │
          ▼
  ¿hay refresh token?  ── no ──►  estado "anónimo" → /login
          │ sí
          ▼
   POST /auth/refresh ── falla ──►  limpiar y → /login
          │ ok
          ▼
   access en memoria + user en context → app
```

### 7.2 Tipos

```ts
// src/features/auth/types.ts
export type RolNombre = "Admin" | "Operador" | "Cobranzas" | "SoloLectura";

export interface User {
  id: string;
  nombre: string;
  email: string;
  roles: RolNombre[];
  // Procesos habilitados para el Operador (ej. "Acopio"). Lo emite el backend.
  procesos: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
```

### 7.3 Almacenamiento del refresh

```ts
// src/features/auth/token-storage.ts
const KEY = "lcagro.refresh";

export const tokenStorage = {
  getRefresh: () => localStorage.getItem(KEY),
  setRefresh: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};
```

### 7.4 AuthContext / AuthProvider

El provider guarda el **access en `useRef`** (no en estado, así no re-renderiza ni se pierde
entre renders) y el **user en `useState`** (sí afecta la UI). Conecta el `tokenBridge` del
`apiClient` para cerrar el ciclo de §2.1.

```tsx
// src/features/auth/auth-context.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiClient, setTokenBridge } from "@/lib/api-client";
import { tokenStorage } from "./token-storage";
import type { LoginResponse, RolNombre, User } from "./types";

interface AuthState {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: RolNombre[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const accessRef = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  const setSession = (data: LoginResponse) => {
    accessRef.current = data.accessToken;
    tokenStorage.setRefresh(data.refreshToken);
    setUser(data.user);
    setStatus("authenticated");
  };

  const clearSession = useCallback(() => {
    accessRef.current = null;
    tokenStorage.clear();
    setUser(null);
    setStatus("anonymous");
  }, []);

  // refresh devuelve el nuevo access (o null). Lo usa el interceptor.
  const refresh = useCallback(async (): Promise<string | null> => {
    const rt = tokenStorage.getRefresh();
    if (!rt) return null;
    try {
      const { data } = await apiClient.post<LoginResponse>("/auth/refresh", {
        refreshToken: rt,
      });
      setSession(data);
      return data.accessToken;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  // Cerramos el ciclo apiClient ↔ auth (una sola vez).
  useEffect(() => {
    setTokenBridge({
      getAccessToken: () => accessRef.current,
      refresh,
      onAuthFailure: clearSession,
    });
  }, [refresh, clearSession]);

  // Rehidratación al montar.
  useEffect(() => {
    (async () => {
      const token = await refresh();
      setStatus(token ? "authenticated" : "anonymous");
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post<LoginResponse>("/auth/login", {
      email,
      password,
    });
    setSession(data);
  };

  const logout = () => clearSession();

  const hasRole = (...roles: RolNombre[]) =>
    !!user && roles.some((r) => user.roles.includes(r));

  return (
    <AuthContext.Provider value={{ user, status, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return ctx;
}
```

### 7.5 Login con react-hook-form + zod

```tsx
// src/features/auth/pages/login-page.tsx (extracto)
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { toAppError } from "@/lib/api-error";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      navigate("/dashboard");
    } catch (err) {
      const e = toAppError(err);
      // 401 en login = credenciales mal (no es "sesión vencida").
      toast.error(e.status === 401 ? "Email o contraseña incorrectos." : e.message);
    }
  });

  // ...inputs shadcn/ui, replicando la estética del mockup (slate + amarillo).
}
```

### 7.6 Rutas protegidas por rol

`RequireAuth` corta por sesión; `RequireRole` corta por rol. Detalle de ruteo en
[`03-routing-y-layout.md`](03-routing-y-layout.md); acá la lógica de datos:

```tsx
// src/features/auth/components/require-auth.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth-context";
import { SessionSkeleton } from "./session-skeleton";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <SessionSkeleton />; // rehidratando sesión
  if (status === "anonymous")
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
```

```tsx
// src/features/auth/components/require-role.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth-context";
import type { RolNombre } from "../types";

export function RequireRole({ roles }: { roles: RolNombre[] }) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) return <Navigate to="/sin-permiso" replace />;
  return <Outlet />;
}
```

Mapa rol → vistas (espejo del backend; ver [`05-api-contratos.md`](../../LcAgro-Procesos/02-desarrollo/05-api-contratos.md)):

| Rol | Posición / Ajustes | Cuentas / Observ. | Dashboard | Usuarios | Config | Auditoría |
|---|---|---|---|---|---|---|
| **Admin** | sí | sí | sí | sí | sí | sí |
| **Operador** (Acopio) | sí | — | sí (lectura) | — | — | — |
| **Cobranzas** | — | sí | sí (lectura) | — | — | — |
| **SoloLectura** | lectura | lectura | sí | — | — | — |

> El front **no** es la frontera de seguridad: oculta lo que el usuario no puede tocar, pero la
> API **siempre** revalida por policy. Una llamada no autorizada igual responde **403**, que el
> front muestra como toast.

---

## 8. Composición de providers

Orden de montaje en `src/app/providers.tsx` (de afuera hacia adentro): Query → Auth → Router.
El `Toaster` puede ir arriba de todo.

```tsx
// src/app/providers.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/features/auth/auth-context";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

> **Por qué Auth dentro de Query:** el `AuthProvider` usa `apiClient` (que ya está creado), y
> sus mutations de login/refresh pueden vivir en la misma cache. El `RouterProvider` va dentro
> para que las rutas vean tanto la cache como la sesión.

---

## 9. Loading con skeletons

Un skeleton **imita la forma final** (misma cantidad de filas/columnas/cards) para evitar el
salto de layout. Base con shadcn/ui (`<Skeleton />` = `div` con `animate-pulse`).

```tsx
// src/features/posicion/components/posicion-table-skeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

export function PosicionTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* cards de cereal (4 columnas como en el mockup) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-[14px]" />
        ))}
      </div>
      {/* filas de la tabla de detalle */}
      <div className="space-y-2 rounded-[14px] border p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
```

Convención:

| Vista | Skeleton |
|---|---|
| Posición | 4 cards + N filas de tabla |
| Cuentas | 4 KPIs + filas agrupadas por vendedor |
| Dashboard | 4 KPI cards + 2 paneles de barras |
| Rehidratando sesión | `SessionSkeleton` (shell con sidebars en gris) |

> Para refetch **en segundo plano** (cambio de filtro, ya hay data) **no** se usa skeleton: se
> mantiene la data anterior (`placeholderData`) con un overlay/spinner sutil. El skeleton es
> solo para el **primer** fetch (`isPending`).

---

## 10. Checklist de implementación

- [ ] `VITE_API_URL` tipada en `vite-env.d.ts` y leída solo desde `lib/env.ts`.
- [ ] `apiClient` único con interceptores request (Bearer) y response (refresh coalescido).
- [ ] `tokenBridge` conectado desde `AuthProvider` (sin import circular).
- [ ] `toAppError` parsea ProblemDetails (simple y de validación) a `AppError`.
- [ ] Toasts globales en `QueryCache`/`MutationCache`; éxito por mutation; `silentError` en forms.
- [ ] Key factories por feature; filtros dentro de la key; `placeholderData` en listas/paginado.
- [ ] Invalidación cruzada: ajuste/config → `posicion` + `dashboard`.
- [ ] Access token **en memoria**; refresh persistido; rehidratación al montar.
- [ ] `RequireAuth` + `RequireRole`; el front oculta, la API decide (403).
- [ ] Skeletons que imitan la forma; refetch de fondo sin skeleton.

---

## Relacionado

- [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md) — qué es el front, alcance y relación con el backend.
- [`06-setup-y-entornos.md`](06-setup-y-entornos.md) — Vite, Tailwind, shadcn/ui, scripts y entorno.
- [`05-api-contratos.md`](../../LcAgro-Procesos/02-desarrollo/05-api-contratos.md) — endpoints, DTOs, roles y ProblemDetails (la fuente de los tipos de este doc).
- [`03-routing-y-layout.md`](03-routing-y-layout.md) — estructura `src/`, ruteo y los dos sidebars del layout.
- [`05-features.md`](05-features.md) — posición, cuentas, dashboard, usuarios, config y auditoría en detalle.
- [`02-design-system.md`](02-design-system.md) — theme clementina, tipografías y componentes compartidos (DataTable, FilterBar, ExportButtons).
