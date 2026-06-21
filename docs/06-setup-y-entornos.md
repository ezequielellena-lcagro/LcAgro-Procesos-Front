# 06 · Setup y entornos (frontend)

> Cómo levantar el frontend de **LcAgro** desde cero: crear el proyecto Vite + React + TypeScript, instalar y configurar Tailwind + shadcn/ui, sumar las librerías de datos/forms/UI, dejar ESLint + Prettier andando, definir las variables de entorno (`VITE_API_URL`) y entender cómo apunta a la API .NET (CORS), el build de producción y la estructura de carpetas inicial.

Este es el doc de arranque del repo **LcAgro-Procesos-Front**. El código vive en `/src`; la documentación en `docs/`. Cuando termines de seguir esta guía vas a tener un esqueleto que levanta con `npm run dev`, lintea limpio y consume la API .NET.

---

## 0. Pre-requisitos

| Herramienta | Versión mínima | Para qué |
|---|---|---|
| **Node.js** | 20 LTS (o 22 LTS) | Runtime de Vite y del toolchain. |
| **npm** | 10+ | Gestor de paquetes (viene con Node). |
| **Git** | cualquiera reciente | Control de versiones. |
| API **LcAgro.Api** corriendo | .NET 10 | Backend que sirve `/api` (ver doc backend `02-desarrollo/`). |

Comprobá las versiones antes de empezar:

```bash
node -v   # v20.x o superior
npm -v    # 10.x o superior
```

> **Editor recomendado:** VS Code con las extensiones *ESLint*, *Prettier - Code formatter* y *Tailwind CSS IntelliSense*. La config de ESLint/Prettier que dejamos abajo hace que el formateo al guardar sea consistente para todo el equipo.

---

## 1. Crear el proyecto (Vite + React + TS)

Desde la **raíz del repo** `LcAgro-Procesos-Front` (que hoy tiene solo `README.md`, `LICENSE` y `.gitignore`), creamos el scaffold de Vite **en el directorio actual** con el template `react-ts`:

```bash
# parado en la raíz del repo LcAgro-Procesos-Front
npm create vite@latest . -- --template react-ts
```

- El `.` crea el proyecto **en la carpeta actual** (no en una subcarpeta). Si Vite avisa que el directorio no está vacío, elegí **"Ignore files and continue"** (no borra tu `README.md`, `LICENSE` ni `.gitignore`).
- `--template react-ts` = React + TypeScript (sin SWC; usamos el plugin Babel por defecto, suficiente para este proyecto).

Instalá dependencias y verificá que levanta:

```bash
npm install
npm run dev    # abre http://localhost:5173
```

Quedan creados, entre otros: `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `src/main.tsx`, `src/App.tsx`, `eslint.config.js` (ESLint 9 *flat config*).

---

## 2. Tailwind CSS

Instalamos Tailwind con el **plugin oficial de Vite** (`@tailwindcss/vite`, Tailwind v4), que es la vía recomendada y la que espera el `init` de shadcn/ui.

```bash
npm install -D tailwindcss @tailwindcss/vite
```

### 2.1 Registrar el plugin en Vite

En `vite.config.ts` sumá el plugin de Tailwind y el alias `@ -> /src` (shadcn lo necesita):

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
```

### 2.2 CSS de entrada con la directiva de Tailwind y el theme Clementina

Reemplazá el contenido de `src/index.css` por la importación de Tailwind v4 más las **variables de marca** (replicamos la estética del mockup `apps/mockup-web/index.html` del repo backend):

```css
/* src/index.css */
@import "tailwindcss";

/* Tipografías de marca (cargadas en index.html, ver 2.3) */
@theme {
  --font-display: "Fraunces", Georgia, serif;        /* títulos */
  --font-sans: "Hanken Grotesk", system-ui, sans-serif; /* cuerpo / UI / datos */

  /* Paleta Clementina (tomada del mockup) */
  --color-clementina: #ffc10e;        /* amarillo acento */
  --color-clementina-deep: #e3a400;
  --color-slate-brand: #2b4150;       /* sidebars y topbar */
  --color-cream: #f6f2e9;             /* lienzo */
  --color-panel: #fffdf8;
  --color-ink: #21303a;
  --color-ink-soft: #6c7a83;
  --color-verde: #3a805a;             /* positivos */
  --color-rojo: #bf5439;              /* negativos */
}

body {
  font-family: var(--font-sans);
  color: var(--color-ink);
  background: var(--color-cream);
}
```

> Nota: con Tailwind v4 el theme se declara en CSS (`@theme`), **no** hay `tailwind.config.js` obligatorio. Si shadcn/ui genera uno, lo respetamos. La paleta completa (slate-2/3, líneas crema, sombras) está en el `<style>` del mockup; acá dejamos las claves; el detalle fino va en el doc de **theme** (ver `Relacionado`).

### 2.3 Cargar las tipografías

En `index.html`, dentro de `<head>`, sumá los `<link>` de Google Fonts (mismas familias y pesos del mockup):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

Asegurate de que `src/main.tsx` importe el CSS:

```ts
// src/main.tsx
import "./index.css";
```

---

## 3. shadcn/ui

shadcn/ui no es una dependencia "instalable" clásica: es una **CLI que copia componentes a tu repo** (`src/components/ui/`). Vos los versionás y editás. Por eso necesita el alias `@`, Tailwind ya configurado y un `tsconfig` que resuelva `@/*`.

### 3.1 Configurar paths en TypeScript

En `tsconfig.json` (y, si existe, replicar en `tsconfig.app.json`) agregá:

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
    // ...resto de la config que dejó Vite
  }
}
```

### 3.2 Inicializar shadcn/ui

```bash
npx shadcn@latest init
```

Respuestas sugeridas al asistente:

| Pregunta | Respuesta |
|---|---|
| Base color | **Slate** (combina con la marca; el acento amarillo lo seteamos en el theme). |
| CSS variables for colors | **Yes**. |
| Global CSS file | `src/index.css`. |
| Import alias for components | `@/components`. |
| Import alias for utils | `@/lib/utils`. |

Esto crea `components.json`, `src/lib/utils.ts` (con el helper `cn`) y ajusta el CSS con las variables de shadcn (`--background`, `--foreground`, etc.). Reconciliá esas variables con la paleta Clementina del paso 2.2.

### 3.3 Agregar componentes (a demanda)

Instalamos solo lo que el mockup necesita. Para arrancar:

```bash
npx shadcn@latest add button input label card table dialog \
  dropdown-menu select badge skeleton sonner tabs tooltip \
  form
```

- `form` trae el wrapper de **react-hook-form + zod** que usa shadcn.
- `sonner` es el sistema de **toasts** (notificaciones).
- `skeleton` para los estados de carga.

Cada uno aterriza en `src/components/ui/<componente>.tsx` y queda bajo tu control.

---

## 4. Librerías de runtime

Instalá el set de librerías de datos, ruteo, formularios y HTTP definido en el stack canónico:

```bash
npm install @tanstack/react-query react-router-dom axios \
  react-hook-form zod @hookform/resolvers
```

| Paquete | Rol en LcAgro |
|---|---|
| **@tanstack/react-query** | *Server state*: queries y mutations contra `/api`, cache e invalidación. |
| **react-router-dom** | Ruteo SPA; rutas protegidas por rol. |
| **axios** | Cliente HTTP con interceptor que adjunta el **JWT** y refresca el token. |
| **react-hook-form** | Manejo de formularios (login, ajustes, observaciones, usuarios, config). |
| **zod** + **@hookform/resolvers** | Validación de esquemas y resolver para react-hook-form. |
| **sonner** | Toasts (ya viene vía shadcn, paso 3.3). |

> **Iconos:** shadcn usa `lucide-react`; si no quedó instalado, agregalo con `npm install lucide-react`.

> **Export client-side:** el export a Excel/PDF es **del lado del cliente** (`shared/export/`). Cuando lo implementes vas a sumar libs livianas (p. ej. `xlsx`/SheetJS para Excel y `jspdf`+`jspdf-autotable` para PDF, o `window.print()` con estilos de impresión como hace el mockup). No las instalamos en el arranque; se detallan en el doc de **export** (ver `Relacionado`).

---

## 5. ESLint + Prettier

Vite ya dejó **ESLint 9** con *flat config* (`eslint.config.js`). Sumamos **Prettier** y el plugin que evita que ESLint y Prettier se peleen por el formato.

```bash
npm install -D prettier eslint-config-prettier \
  eslint-plugin-react-hooks eslint-plugin-react-refresh
```

### 5.1 `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

### 5.2 `.prettierignore`

```
dist
node_modules
coverage
*.md
```

### 5.3 ESLint flat config

Editá `eslint.config.js` para sumar `eslint-config-prettier` **al final** (apaga las reglas de formato que choquen con Prettier):

```js
// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  prettier, // <- siempre último
);
```

> `eslint-config-prettier` va **último** para que su único trabajo (desactivar reglas de estilo) no quede pisado por configs anteriores.

---

## 6. Scripts de `package.json`

Dejá la sección `scripts` así:

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css}\""
  }
}
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR en `http://localhost:5173`. |
| `npm run build` | Chequeo de tipos (`tsc -b`) + build de producción a `dist/`. |
| `npm run preview` | Sirve el `dist/` ya buildeado para probarlo localmente. |
| `npm run lint` | Corre ESLint sobre todo el repo. |
| `npm run lint:fix` | ESLint con autofix. |
| `npm run format` | Formatea con Prettier. |
| `npm run format:check` | Verifica formato sin escribir (útil en CI). |

---

## 7. Variables de entorno

Vite expone al cliente **solo** las variables que empiezan con `VITE_` (las accedés como `import.meta.env.VITE_XXX`). El frontend necesita saber **a qué API .NET apuntar**.

### 7.1 Archivos

| Archivo | Versionado | Uso |
|---|---|---|
| `.env.example` | **Sí** (plantilla, sin secretos) | Documenta las variables disponibles. |
| `.env.local` | **No** (lo cubre `.gitignore`) | Tu config local de desarrollo. |
| `.env.development` | opcional | Defaults de desarrollo compartidos. |
| `.env.production` | opcional | URL de la API en producción. |

`.env.example` (versionado):

```bash
# URL base de la API .NET (LcAgro.Api). Sin barra final.
VITE_API_URL=http://localhost:5080/api
```

`.env.local` (tu copia local, NO se versiona):

```bash
VITE_API_URL=http://localhost:5080/api
```

> Confirmá el **puerto** real de `LcAgro.Api` en su `launchSettings.json`. Acá usamos `5080` como ejemplo; ajustalo al que exponga el backend.

### 7.2 Tipado de `import.meta.env`

Para tener autocompletado y chequeo de tipos, declará la variable en `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 7.3 Consumo en el cliente axios

El `apiClient` (en `src/lib/`) toma la base URL del env. Esqueleto:

```ts
// src/lib/api-client.ts
import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // http://localhost:5080/api
  headers: { "Content-Type": "application/json" },
});

// Interceptor de request: adjunta el JWT (detalle en el doc de auth).
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken(); // desde el AuthContext / memoria
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

El detalle del **interceptor de refresh** (401 → `/api/auth/refresh` → reintento) vive en el doc de auth/data-fetching (ver `Relacionado`).

---

## 8. Cómo apunta a la API .NET (CORS)

```
┌─────────────────────────────┐         HTTP + JSON          ┌──────────────────────────────┐
│  Frontend (Vite/React)      │  ──────────────────────────▶ │  LcAgro.Api (ASP.NET Core)   │
│  http://localhost:5173      │   Authorization: Bearer JWT  │  http://localhost:5080/api   │
│  VITE_API_URL ───────────┐  │ ◀────────────────────────── │  CORS allow origin :5173      │
│  axios baseURL ◀─────────┘  │      ProblemDetails (RFC7807)│  (read-only MacroGest + AppDb)│
└─────────────────────────────┘                              └──────────────────────────────┘
```

- El front (origin `http://localhost:5173`) y la API (origin `http://localhost:5080`) son **orígenes distintos** → el navegador exige **CORS**.
- La API **ya tiene configurado CORS** para el origin del front (ver doc backend de `Program.cs`/CORS). En desarrollo, el origin permitido es `http://localhost:5173`; en producción, el dominio donde se sirva el estático.
- Si en algún momento querés evitar CORS en desarrollo, podés usar un **proxy de Vite** (`server.proxy` en `vite.config.ts`) para que `/api` se reenvíe a la API; pero la vía canónica es **CORS server-side** (mantiene el mismo `apiClient` para dev y prod).

Ejemplo opcional de proxy (no es la vía por defecto):

```ts
// vite.config.ts (opcional, solo si querés evitar CORS en dev)
server: {
  port: 5173,
  proxy: {
    "/api": {
      target: "http://localhost:5080",
      changeOrigin: true,
    },
  },
}
```

> Si usás el proxy, `VITE_API_URL` pasa a ser `/api` (relativo) en desarrollo. Para no complicar, recomendamos **CORS** y URL absoluta del backend.

---

## 9. Build de producción y dónde se sirve el estático

```bash
npm run build     # genera dist/ (HTML + JS/CSS hasheados, assets)
npm run preview   # sirve dist/ localmente para verificarlo
```

- El build produce una **SPA estática** en `dist/`: `index.html` + bundles con hash + assets.
- Esos archivos se sirven desde un **servidor de estáticos** (Nginx, IIS, o el host on-prem de la oficina). No requieren Node en producción.
- Por ser una **SPA con react-router**, el servidor debe hacer **fallback a `index.html`** para cualquier ruta que no sea un archivo (si no, recargar `/posicion` da 404). Configurá el *try_files* / *URL rewrite* correspondiente.
- En producción, `VITE_API_URL` debe apuntar a la **URL pública de la API** (la que tenga acceso estable a la LAN `192.168.0.20` de MacroGest — ver la decisión de hosting on-prem en el doc de preparación del backend).

> **Nota de entorno:** el valor de `VITE_API_URL` se **incrusta en el bundle en tiempo de build**. Si cambia la URL de la API, hay que **re-buildear** (no es una config de runtime). Por eso `.env.production` debe estar bien seteado antes de `npm run build`.

---

## 10. Estructura inicial de carpetas

Creá este esqueleto bajo `src/` (alineado con la estructura canónica del frontend). Los componentes de shadcn van en `components/ui/`; el resto es código propio organizado por **feature**.

```
LcAgro-Procesos-Front/
├─ docs/                       ← este doc y sus hermanos
├─ public/
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ components.json             ← config de shadcn/ui
├─ .env.example
├─ .env.local                  ← (gitignored)
└─ src/
   ├─ main.tsx
   ├─ index.css                ← Tailwind + theme Clementina
   ├─ vite-env.d.ts
   ├─ app/                     ← router, providers, layout
   │  ├─ router.tsx            ← rutas + rutas protegidas por rol
   │  ├─ providers.tsx         ← QueryClientProvider + AuthProvider
   │  └─ AppLayout.tsx         ← 2 sidebars colapsables + topbar (del mockup)
   ├─ features/                ← una carpeta por proceso/pantalla
   │  ├─ auth/                 ← login, me, context
   │  ├─ dashboard/            ← KPIs que cruzan posición + cuentas
   │  ├─ posicion/             ← tarjetas por cereal + tabla + filtros + ajustes
   │  ├─ cuentas/              ← listado por vendedor + filtros + observaciones
   │  ├─ usuarios/             ← ABM de usuarios (Admin)
   │  ├─ config/              ← parámetros configurables (Admin)
   │  └─ auditoria/            ← log de auditoría (Admin)
   │     └─ (cada feature: pages/ components/ queries/ types.ts)
   ├─ components/
   │  └─ ui/                   ← shadcn/ui (button, table, dialog, ...)
   ├─ shared/                  ← reutilizable entre features
   │  ├─ components/           ← DataTable, FilterBar, KpiCard, ExportButtons, PageHeader
   │  ├─ export/               ← exportToExcel, exportToPdf
   │  ├─ format/               ← usd, tn, fecha
   │  └─ hooks/
   ├─ lib/                     ← apiClient (axios + interceptores), queryClient, auth
   └─ styles/                  ← theme Tailwind / overrides
```

Comandos para crear las carpetas base de un saque:

```bash
mkdir -p src/app \
  src/features/auth src/features/dashboard src/features/posicion \
  src/features/cuentas src/features/usuarios src/features/config \
  src/features/auditoria \
  src/components/ui \
  src/shared/components src/shared/export src/shared/format src/shared/hooks \
  src/lib src/styles
```

> El detalle de **qué archivos** van en `app/` (router, providers, layout de los dos sidebars) y en cada `feature` está en el doc de **arquitectura del frontend** (ver `Relacionado`). Acá solo dejamos el esqueleto para que el repo tenga forma desde el día uno.

---

## 11. `.gitignore` (verificar)

Asegurate de que el `.gitignore` del repo (ya presente) ignore al menos:

```
node_modules
dist
dist-ssr
*.local
.env.local
.env.*.local
.vite
coverage
```

`.env.example` **sí** se versiona (es plantilla); `.env.local` y `.env.*.local` **no** (pueden tener URLs internas).

---

## 12. Checklist de "arranque OK"

- [ ] `node -v` ≥ 20 y `npm -v` ≥ 10.
- [ ] `npm create vite@latest . -- --template react-ts` ejecutado en la raíz, sin pisar `README.md`/`LICENSE`.
- [ ] `npm install` y `npm run dev` levantan en `http://localhost:5173`.
- [ ] Tailwind v4 vía `@tailwindcss/vite`, `@import "tailwindcss"` en `src/index.css`, tipografías Fraunces + Hanken Grotesk cargadas.
- [ ] Alias `@ -> /src` en `vite.config.ts` y `tsconfig.json`.
- [ ] `npx shadcn@latest init` corrido; `components.json` y `src/lib/utils.ts` creados; componentes base agregados.
- [ ] Librerías de runtime instaladas (TanStack Query, react-router-dom, axios, react-hook-form, zod, @hookform/resolvers).
- [ ] ESLint + Prettier configurados; `npm run lint` y `npm run format:check` pasan.
- [ ] Scripts `dev/build/preview/lint/format` en `package.json`.
- [ ] `.env.example` versionado y `.env.local` con `VITE_API_URL` apuntando a la API .NET.
- [ ] `npm run build` genera `dist/` sin errores de tipos.
- [ ] Estructura de carpetas `src/` creada.

---

## Relacionado

- [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md) — qué es LcAgro y el alcance del frontend.
- [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md) — estructura `src/`, capas, router, providers y layout de los dos sidebars.
- [`02-design-system.md`](02-design-system.md) — paleta Clementina, tipografías y replicación de la estética del mockup.
- [`04-data-y-estado.md`](04-data-y-estado.md) — TanStack Query, `apiClient` axios, interceptores JWT/refresh y rutas protegidas por rol.
- [`04-data-y-estado.md`](04-data-y-estado.md) — endpoints `/api`, DTOs y shapes (posición, cuentas, dashboard, usuarios, config, auditoría).
- [`05-features.md`](05-features.md) — export client-side a Excel/PDF y helpers de formato (USD, toneladas, fechas).
