# 02 · Design System — LcAgro Front

> Sistema de diseño del frontend de **LcAgro** (Etapa 9). Tokens de diseño, configuración de Tailwind, setup de shadcn/ui y catálogo de componentes base.
> La fuente de verdad estética es el mockup navegable del repo backend: [`apps/mockup-web/index.html`](../../LcAgro-Procesos/apps/mockup-web/index.html). **Todos los colores, tipografías, sombras y radios de este doc salen textualmente de ahí.** Si algo se cambia en el front, se actualiza este doc.

La estética es **agro-fintech refinada**: lienzo crema, sidebars slate, acento amarillo clementina, números en tabular-nums, títulos en serif (Fraunces) y UI en grotesca (Hanken Grotesk). Distintivo, no genérico.

---

## 1. Principios de diseño

| Principio | Qué significa en la práctica |
|---|---|
| **Calma de lienzo** | El fondo es crema (`#f6f2e9`), no blanco puro. Los paneles son crema casi blanco (`#fffdf8`). Reduce fatiga en pantallas de datos densos. |
| **Slate para la estructura** | Los dos sidebars y la topbar son slate (`#2b4150`). El contenido "flota" sobre el lienzo; la navegación es el marco oscuro. |
| **Amarillo = acento, no relleno** | El amarillo clementina (`#ffc10e`) se reserva para el estado activo, el foco, los CTA primarios sobre slate y micro-detalles (sparklines, barras). Nunca como fondo de superficies grandes. |
| **Datos legibles** | Toda cifra usa `font-variant-numeric: tabular-nums` (clase `.tabular`) para que las columnas alineen. Verde/rojo semánticos para signo. |
| **Serif para jerarquía** | Fraunces solo en títulos, KPIs grandes y números "hero". El cuerpo y la UID en Hanken Grotesk. |
| **Una densidad** | Radios 10–14px, sombras suaves de dos capas, bordes hairline color crema (`#e7e1d3`). Consistencia antes que variedad. |

---

## 2. Tokens de color

Paleta canónica extraída del mockup (`:root` de `index.html`). Los nombres en negrita son los tokens que usamos en Tailwind y en las CSS variables de shadcn.

### 2.1 Tinta (texto)

| Token | Hex | Uso |
|---|---|---|
| **ink** | `#21303a` | Texto principal sobre lienzo. |
| **ink-soft** | `#6c7a83` | Texto secundario, labels, captions, placeholders. |

### 2.2 Superficies y líneas (tema claro / contenido)

| Token | Hex | Uso |
|---|---|---|
| **cream** | `#f6f2e9` | Fondo de la app (lienzo). |
| **panel** | `#fffdf8` | Fondo de cards, tablas, formularios (casi blanco cálido). |
| **panel-2** | `#fbf7ee` | Fondo de inputs, hover de fila, head de tabla. |
| **line** | `#e7e1d3` | Borde estándar de superficies (hairline). |
| **line-2** | `#efeadf` | Borde interno más sutil (separadores de filas). |

### 2.3 Slate (chrome / navegación)

| Token | Hex | Uso |
|---|---|---|
| **slate** | `#2b4150` | Sidebar de áreas, topbar, botón primario, mensajes "me" del chat. |
| **slate-2** | `#223340` | Sidebar de procesos, hover del botón primario. |
| **slate-3** | `#1c2a34` | Tonos más profundos del gradiente de login. |
| **slate-soft** | `#9fb0bb` | Texto secundario sobre slate, íconos atenuados del sidebar. |

> Sobre slate, el texto de cuerpo va en `#dce6ec` y los labels/grupos en `#ffffff66`/`#ffffffaa` (blanco con alfa). Es la convención del mockup; en Tailwind se expresan con `text-white/40`, `text-white/67`, etc.

### 2.4 Acento (amarillo clementina)

| Token | Hex | Uso |
|---|---|---|
| **clementina** (amarillo) | `#ffc10e` | Acento, estado activo (gradiente), foco, sparklines, barras. |
| **clementina-deep** | `#e3a400` | Borde de foco en inputs, hover de botones outline, fin del gradiente activo. |

El **estado activo** de navegación usa un gradiente fijo:

```css
background: linear-gradient(100deg, #ffc10e, #e3a400); /* texto #243744 */
box-shadow: 0 6px 16px -8px #e3a400aa;
```

### 2.5 Semánticos (señal)

| Token | Hex | Fondo (chip) | Uso |
|---|---|---|---|
| **verde** | `#3a805a` | **verde-bg** `#e7f1ea` | Posición/margen positivo, estado "Activo", tag "up". |
| **rojo** | `#bf5439` | **rojo-bg** `#f7e9e4` | Posición/margen negativo, saldo en rojo, tag "down". |

> Convención de dominio: **positivo = verde, negativo = rojo**, aplicado a posición de cereal (tn), margen (USD/tn) y saldos (USD). En JSX se resuelven con helpers (`shared/format`) que devuelven la clase `text-verde` / `text-rojo`.

### 2.6 Mapa rápido (ASCII)

```
LIENZO  ─ cream      #f6f2e9 ───────────────────────────────┐
        │  ┌── panel #fffdf8  (cards, tablas) ──────────┐   │
        │  │  texto: ink #21303a / ink-soft #6c7a83     │   │
        │  │  bordes: line #e7e1d3 / line-2 #efeadf      │   │
        │  └─────────────────────────────────────────────┘   │
NAV  ── slate #2b4150 (topbar + sidebar áreas) ──────────────┤
        slate-2 #223340 (sidebar procesos)                   │
        texto: #dce6ec  ·  activo: gradiente clementina      │
ACENTO ─ #ffc10e → #e3a400  (foco, activo, sparkline)        │
SEÑAL  ─ verde #3a805a / rojo #bf5439                        │
────────────────────────────────────────────────────────────┘
```

---

## 3. Tipografía

Dos familias de Google Fonts. En producción se cargan **self-hosted** vía `@fontsource` (no CDN) para evitar el bloqueo de red de la oficina; el mockup las trae por CDN.

| Rol | Familia | Pesos | Token Tailwind |
|---|---|---|---|
| **Display / títulos / números hero** | **Fraunces** (`opsz 9..144`) | 400, 500, 600, 700 | `font-display` |
| **Cuerpo / UI / datos** | **Hanken Grotesk** | 400, 500, 600, 700 | `font-sans` (default) |

Fallbacks: Fraunces → `Georgia, serif`; Hanken → `system-ui, sans-serif`.

```bash
npm i @fontsource-variable/fraunces @fontsource/hanken-grotesk
```

```ts
// src/styles/fonts.ts  (importar una vez en main.tsx)
import "@fontsource-variable/fraunces";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
```

### 3.1 Escala tipográfica (del mockup)

| Elemento | Familia | Tamaño | Peso | Tracking | Clase sugerida |
|---|---|---|---|---|---|
| H1 de vista (`view-head h1`) | Fraunces | 27px | 600 | `-0.015em` | `font-display text-[27px] font-semibold tracking-tight` |
| KPI valor (`kpi .v`) | Fraunces | 27px | 600 | `-0.01em` | `font-display text-[27px] font-semibold` |
| Card número hero (`.big`) | Fraunces | 34px | 600 | `-0.02em` | `font-display text-[34px] font-semibold` |
| Crumb activo topbar (`.route .c`) | Fraunces | 17px | 600 | `-0.01em` | `font-display text-[17px] font-semibold` |
| Título de panel (`.ph h3`) | Hanken | 15px | 600 | — | `text-[15px] font-semibold` |
| Cuerpo / celdas | Hanken | 13–14px | 400–500 | — | `text-sm` |
| Label de control (`.ctrl label`) | Hanken | 11px | 600 | — | `text-[11px] font-semibold text-ink-soft` |
| Head de tabla (`thead th`) | Hanken | 11px | 600 | `0.05em` UPPER | `text-[11px] font-semibold uppercase tracking-wide` |
| KPI eyebrow (`.kpi .k`) | Hanken | 11.5px | 500 | `0.1em` UPPER | `text-[11.5px] uppercase tracking-[0.1em] text-ink-soft` |

> **Regla:** Fraunces nunca para texto corrido. Si un número entra en una tabla densa va en Hanken con `tabular-nums`; si es un número "protagonista" (KPI, card hero) va en Fraunces.

---

## 4. Espaciado, radios, sombras

### 4.1 Radios

| Token | Valor | Uso |
|---|---|---|
| `rounded-lg` | 10px | Botones, inputs, controles, íconos cuadrados. |
| `rounded-card` (`--r`) | **14px** | Cards, paneles, KPIs, formcards. |
| `rounded-xl` | 20px | Card de login. |
| `rounded-full` | 999px | Pills, tags, chips, switches, toggle de procesos. |

### 4.2 Sombras (dos capas, suaves)

```css
--shadow:    0 1px 2px rgba(33,48,58,.04), 0 8px 24px -12px rgba(33,48,58,.18);
--shadow-lg: 0 24px 60px -20px rgba(33,48,58,.35);
```

| Token Tailwind | Mapea a | Uso |
|---|---|---|
| `shadow-card` | `--shadow` | Cards, paneles, KPIs, toolbars. |
| `shadow-float` | `--shadow-lg` | Modales/Dialog, panel IA, card de login. |

### 4.3 Espaciado

Tailwind por defecto (escala de 4px). Convenciones del mockup:

- Padding de card/panel: `p-[18px]` a `p-[22px]` (≈ `p-5`).
- Padding de celda de tabla: `px-4 py-2.5`.
- Gap de grillas (KPIs/cards): `gap-3.5` (14px).
- Contenido centrado con `max-w-[1240px] mx-auto`, padding `px-7 pt-6 pb-14`.
- Altura de topbar y brand: **62px** (`--top`).

---

## 5. tailwind.config

Tailwind 3 con `theme.extend`. shadcn/ui usa CSS variables HSL, pero **los tokens de marca los exponemos como colores literales** (vienen del mockup en hex) para no diluir la identidad.

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.75rem", screens: { "2xl": "1240px" } },
    extend: {
      colors: {
        // --- Marca LcAgro (literales del mockup) ---
        ink: { DEFAULT: "#21303a", soft: "#6c7a83" },
        cream: "#f6f2e9",
        panel: { DEFAULT: "#fffdf8", soft: "#fbf7ee" },
        line: { DEFAULT: "#e7e1d3", soft: "#efeadf" },
        slate: {
          DEFAULT: "#2b4150", 2: "#223340", 3: "#1c2a34", soft: "#9fb0bb",
        },
        clementina: { DEFAULT: "#ffc10e", deep: "#e3a400" },
        verde: { DEFAULT: "#3a805a", bg: "#e7f1ea" },
        rojo: { DEFAULT: "#bf5439", bg: "#f7e9e4" },

        // --- Tokens shadcn (CSS vars HSL, ver §6.3) ---
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
      },
      fontFamily: {
        display: ["'Fraunces Variable'", "Fraunces", "Georgia", "serif"],
        sans: ["'Hanken Grotesk'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
        lg: "var(--radius)",       // 10px
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(33,48,58,.04), 0 8px 24px -12px rgba(33,48,58,.18)",
        float: "0 24px 60px -20px rgba(33,48,58,.35)",
      },
      backgroundImage: {
        "clementina-grad": "linear-gradient(100deg, #ffc10e, #e3a400)",
        "avatar-grad": "linear-gradient(150deg, #ffce3a, #e3a400)",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "none" } },
        fade: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        rise: "rise .7s cubic-bezier(.2,.8,.2,1)",
        fade: "fade .45s ease both",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
```

> `--radius: 10px` y los tokens HSL de shadcn se definen en `src/styles/globals.css` (ver §6.3). La grilla del mockup usa `repeat(auto-fit, minmax(190px,1fr))` para KPIs y `minmax(250px,1fr)` para cards — se replica con `grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))]`.

---

## 6. Setup de shadcn/ui

shadcn/ui no es una dependencia: copia componentes a `src/components/ui/` que después editamos. Encaja con la decisión de "componentes propios sobre primitivas Radix".

### 6.1 Inicialización

```bash
# desde la raíz del repo Front, con Vite + Tailwind ya configurados
npx shadcn@latest init
```

Respuestas alineadas a nuestra estructura:

| Pregunta del CLI | Respuesta |
|---|---|
| Style | **New York** |
| Base color | **Slate** (lo sobrescribimos con nuestros tokens) |
| CSS variables for colors | **Yes** |
| `tailwind.config` location | `tailwind.config.ts` |
| Global CSS | `src/styles/globals.css` |
| Import alias components | `@/components` |
| Import alias utils | `@/lib/utils` |
| RSC | **No** (es Vite SPA) |

### 6.2 `components.json` resultante

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "utils": "@/lib/utils",
    "hooks": "@/shared/hooks",
    "lib": "@/lib"
  },
  "iconLibrary": "lucide"
}
```

> Requiere los alias en `tsconfig.json` (`"@/*": ["./src/*"]`) y en `vite.config.ts` (`resolve.alias`). Íconos: **lucide-react** (el mockup dibuja SVGs inline equivalentes a `Home`, `Wheat`/`grain`, `Banknote`, `Box`, `Sprout`, `BarChart3`, `Settings`, `Calendar`, `Sparkles`, `Search`, `FileSpreadsheet`, `FileText`, `Plus`, `Send`).

### 6.3 CSS variables de shadcn (mapeadas a la marca)

En `src/styles/globals.css`, los tokens HSL de shadcn se setean con **nuestros** colores para que cualquier componente shadcn salga ya con la identidad LcAgro:

```css
@layer base {
  :root {
    --radius: 10px;

    --background: 43 43% 94%;        /* cream  #f6f2e9 */
    --foreground: 203 27% 18%;       /* ink    #21303a */
    --card: 43 60% 99%;              /* panel  #fffdf8 */
    --card-foreground: 203 27% 18%;
    --popover: 43 60% 99%;
    --popover-foreground: 203 27% 18%;

    --primary: 207 30% 24%;          /* slate  #2b4150 */
    --primary-foreground: 0 0% 100%;
    --secondary: 40 50% 95%;         /* panel-2 #fbf7ee */
    --secondary-foreground: 203 27% 18%;
    --muted: 40 50% 95%;
    --muted-foreground: 200 9% 47%;  /* ink-soft #6c7a83 */
    --accent: 44 100% 53%;           /* clementina #ffc10e */
    --accent-foreground: 207 30% 18%;
    --destructive: 13 54% 48%;       /* rojo   #bf5439 */
    --destructive-foreground: 0 0% 100%;

    --border: 41 35% 86%;            /* line   #e7e1d3 */
    --input: 41 35% 86%;
    --ring: 42 100% 45%;             /* clementina-deep #e3a400 (foco) */
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-cream text-ink font-sans antialiased; font-size: 14px; line-height: 1.5; }
  h1, h2, h3 { @apply font-display; }
  .tabular { font-variant-numeric: tabular-nums; }
  .pos { @apply text-verde; }
  .neg { @apply text-rojo; }
}
```

> El **ring de foco** es amarillo (`clementina-deep`), coherente con el mockup: `input:focus { border-color:#e3a400; box-shadow:0 0 0 3px #ffc10e33; }`. Esto se traduce a `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0`.

### 6.4 Agregar componentes

```bash
npx shadcn@latest add button card table input select badge dialog tabs sonner \
  dropdown-menu label form skeleton tooltip separator
```

Cada uno aterriza en `src/components/ui/<nombre>.tsx` y queda editable. **Sonner** trae el `<Toaster />`; lo montamos una vez en `AppLayout`.

---

## 7. Componentes base

Catálogo de los componentes shadcn que usamos, con su mapeo al mockup y los estados. La variante por defecto ya queda con la marca por las CSS vars de §6.3; abajo se documentan las variantes que el producto necesita.

### 7.1 Button

| Variante | Equivalente mockup | Clase resultante | Uso |
|---|---|---|---|
| `default` (primary) | `.btn-primary` / `.btn.dark` | slate, texto blanco | CTA: "Ingresar", "Nuevo usuario", "Preguntar a la IA". |
| `outline` | `.btn` | panel + borde `line`, hover borde `clementina-deep` | Acciones secundarias: "Excel", "PDF", "Editar". |
| `ghost` | `.burger`, `.icon-btn` | transparente, hover sutil | Íconos de topbar/sidebar. |
| `link` | — | texto + subrayado | Enlaces inline. |

```tsx
// variante "dark" del mockup = default primary, con ícono lucide
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

<Button className="gap-2">           {/* default = slate */}
  <Sparkles className="size-4" /> Preguntar a la IA
</Button>

<Button variant="outline" className="gap-2">
  <FileSpreadsheet className="size-4" /> Excel
</Button>
```

**Estados** (válidos para todos los botones):

```
default   bg-slate         text-white
hover     bg-slate-2       translate-y-[-1px]        (lift sutil)
focus     ring-2 ring-clementina-deep ring-offset-0
disabled  opacity-50 pointer-events-none
loading   <Loader2 className="size-4 animate-spin" /> + disabled
```

```tsx
<Button disabled={isPending}>
  {isPending && <Loader2 className="size-4 animate-spin" />}
  Guardar
</Button>
```

### 7.2 Card

Mapea a `.card` / `.kpi` / `.panel-box` / `.formcard` del mockup: `bg-panel border border-line rounded-card shadow-card`.

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

<Card className="rounded-card border-line bg-panel shadow-card">
  <CardHeader className="border-b border-line py-3.5 px-[18px]">
    <CardTitle className="text-[15px] font-semibold">Detalle por cereal</CardTitle>
  </CardHeader>
  <CardContent className="p-0">{/* tabla */}</CardContent>
</Card>
```

Variante **KpiCard** (`shared/components/KpiCard`) — eyebrow + valor Fraunces + delta, con borde lateral de color según signo (el mockup pinta `::before` con verde/rojo):

```tsx
<Card className="relative overflow-hidden rounded-card border-line bg-panel p-4 shadow-card">
  <p className="text-[11.5px] uppercase tracking-[0.1em] text-ink-soft">Resultado calzado</p>
  <p className="mt-1.5 font-display text-[27px] font-semibold tabular pos">US$ 145.230</p>
  <p className="mt-1 text-xs text-ink-soft">Acopio · campaña actual</p>
</Card>
```

### 7.3 Table

El mockup usa una tabla rica con `thead` crema, hover de fila, filas de grupo (`grouprow`) y de total (`totalrow`). El `DataTable` de `shared/components` envuelve TanStack Table + el `<Table>` de shadcn.

| Parte | Clase |
|---|---|
| `thead th` | `bg-panel-soft text-[11px] font-semibold uppercase tracking-wide text-ink-soft border-b border-line` |
| `th.num` / `td.num` | `text-right` |
| `tbody td` | `px-4 py-2.5 border-t border-line-soft` |
| Hover fila | `hover:bg-panel-soft` |
| Fila grupo (vendedor/cereal) | `bg-[#f0ece0] font-bold text-[11px] uppercase tracking-wide text-slate` |
| Fila total/subtotal | `bg-[#fff8e3] font-bold border-t-2 border-line` |
| Celdas numéricas | clase `tabular`; signo con `pos`/`neg` |

```tsx
<TableCell className="text-right tabular">{fmtTn(row.tnCompra)}</TableCell>
<TableCell className={cn("text-right tabular", row.posicion >= 0 ? "pos" : "neg")}>
  {fmtSigned(row.posicion)}
</TableCell>
```

> Las cifras pasan **siempre** por `shared/format` (`usd`, `tn`, `fecha`) — locale `es-AR`, separador de miles `.`, decimales según campo. No formatear inline.

### 7.4 Input

Mapea a `.field input` / `.ctrl input`: `bg-panel-soft border-line rounded-lg`, foco amarillo.

```
default   bg-panel-soft  border-line  rounded-lg  px-3 py-2.5
focus     border-clementina-deep  bg-white  ring-[3px] ring-clementina/20  (outline-none)
disabled  opacity-60  cursor-not-allowed
error     border-rojo  (mensaje de zod debajo en text-rojo text-xs)
```

Con react-hook-form + zod, vía el `<Form>` de shadcn:

```tsx
<FormField name="precioUsd" control={form.control} render={({ field }) => (
  <FormItem>
    <FormLabel className="text-[12px] font-semibold text-ink-soft">Precio USD</FormLabel>
    <FormControl><Input type="number" {...field} /></FormControl>
    <FormMessage /> {/* error de zod en text-rojo */}
  </FormItem>
)} />
```

### 7.5 Select

Para filtros (campaña, cereal, vendedor, zona). Mapea a `.ctrl select` envuelto en una píldora con label.

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

<div className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2">
  <label className="text-[11px] font-semibold text-ink-soft">Cereal</label>
  <Select value={cereal} onValueChange={setCereal}>
    <SelectTrigger className="h-auto border-0 bg-transparent p-0 font-medium shadow-none focus:ring-0">
      <SelectValue placeholder="Todos" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">Todos</SelectItem>
      <SelectItem value="Maíz">Maíz</SelectItem>
      <SelectItem value="Trigo">Trigo</SelectItem>
      <SelectItem value="Soja">Soja</SelectItem>
      <SelectItem value="Girasol">Girasol</SelectItem>
      <SelectItem value="Sorgo">Sorgo</SelectItem>
    </SelectContent>
  </Select>
</div>
```

> Las opciones de campaña y cereal vienen de la API (`GET /api/posicion/campanias`) vía TanStack Query; no se hardcodean en producción.

### 7.6 Badge

Tres familias del mockup: **tag de signo** (`tag up/down`), **rol** (`role`/`role.admin`), **demo** (`badge-demo`).

```tsx
// signo (margen / variación)
<Badge className="rounded-full bg-verde-bg text-verde">+4,85%</Badge>
<Badge className="rounded-full bg-rojo-bg text-rojo">-1,2%</Badge>

// rol
<Badge className="rounded-full bg-[#eef1f4] text-slate">Operador</Badge>
<Badge className="rounded-full bg-[#fff0c9] text-[#9a6b00]">Admin</Badge>

// estado / aviso "datos de ejemplo"
<Badge className="rounded-md border border-[#f0d68a] bg-[#fff6e0] text-[#a9791a]">
  Datos de ejemplo
</Badge>
```

| Badge | Fondo | Texto |
|---|---|---|
| up / positivo | `verde-bg #e7f1ea` | `verde #3a805a` |
| down / negativo | `rojo-bg #f7e9e4` | `rojo #bf5439` |
| rol estándar | `#eef1f4` | `slate` |
| rol Admin | `#fff0c9` | `#9a6b00` |
| solo-lectura (read-only) | `verde-bg` | `verde` |
| aviso demo | `#fff6e0` | `#a9791a` |

### 7.7 Dialog

Para "Nuevo/Editar usuario", "Editar ajuste de posición", "Editar observación de cuenta". Usa `shadow-float` y overlay slate translúcido (`#21303a44`), igual que el `.scrim` del mockup.

```tsx
<Dialog>
  <DialogTrigger asChild><Button>Nuevo usuario</Button></DialogTrigger>
  <DialogContent className="rounded-card border-line bg-panel shadow-float">
    <DialogHeader>
      <DialogTitle className="font-display text-[19px] font-semibold">Nuevo usuario</DialogTitle>
      <DialogDescription className="text-ink-soft">Roles y permisos por proceso.</DialogDescription>
    </DialogHeader>
    {/* form react-hook-form + zod */}
  </DialogContent>
</Dialog>
```

### 7.8 Tabs

Para vistas con sub-secciones (ej. Configuración: Conexión / Reglas de negocio / Parámetros). Estado activo en slate, inactivo en `ink-soft`.

```tsx
<Tabs defaultValue="conexion">
  <TabsList className="bg-panel-soft">
    <TabsTrigger value="conexion">Conexión</TabsTrigger>
    <TabsTrigger value="reglas">Reglas de negocio</TabsTrigger>
    <TabsTrigger value="parametros">Parámetros</TabsTrigger>
  </TabsList>
  <TabsContent value="conexion">{/* ... */}</TabsContent>
</Tabs>
```

### 7.9 Sonner (toasts)

Notificaciones de mutaciones (guardar ajuste, observación, usuario, login). Montaje único en `AppLayout`, tematizado con la marca.

```tsx
// en AppLayout
import { Toaster } from "@/components/ui/sonner";

<Toaster
  position="bottom-right"
  toastOptions={{
    classNames: {
      toast: "rounded-lg border-line bg-panel text-ink shadow-card",
      success: "[&_svg]:text-verde",
      error: "[&_svg]:text-rojo",
    },
  }}
/>
```

```tsx
// en una mutation de TanStack Query
import { toast } from "sonner";

onSuccess: () => toast.success("Ajuste guardado");
onError:   (e) => toast.error("No se pudo guardar", { description: e.message });
```

### 7.10 Skeleton (loading)

Mientras TanStack Query está `isLoading`, se muestran skeletons con tono crema, no spinners en bloque.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

<Skeleton className="h-7 w-32 rounded-md bg-line-soft" />     {/* KPI valor */}
<Skeleton className="h-10 w-full rounded-md bg-line-soft" />  {/* fila de tabla */}
```

---

## 8. Estados de interacción (resumen transversal)

| Estado | Convención LcAgro |
|---|---|
| **hover** (acción) | Oscurece el slate (`slate → slate-2`) o cambia borde a `clementina-deep`; lift de `-1px` en botones primarios. |
| **focus** (teclado) | `ring-2`/`ring-[3px]` amarillo (`clementina-deep`), `ring-offset-0`. **Siempre `focus-visible`**, nunca quitar el outline sin reemplazo (accesibilidad). |
| **active / seleccionado** (nav) | Gradiente clementina `100deg #ffc10e→#e3a400`, texto `#243744`, `shadow` ámbar. |
| **disabled** | `opacity-50` + `pointer-events-none` / `cursor-not-allowed`. |
| **loading** | Botón: `<Loader2 className="animate-spin" />` + disabled. Datos: `Skeleton`. Nunca dejar la UI "muda". |
| **error** (form) | Borde `rojo`, mensaje zod debajo en `text-rojo text-xs`. |
| **error** (request) | Toast `sonner` error + estado vacío con reintento; en HTTP el back devuelve ProblemDetails. |
| **empty** | Mensaje en `ink-soft` centrado + ícono lucide tenue (ej. tabla sin resultados de filtro). |

Animaciones de entrada: vistas con `animate-fade` (8px, .45s), login con `animate-rise` (16px, .7s). El mockup escalona hijos (`.stagger`) con delays de 50ms; en React se replica con `[animation-delay]` por índice o `framer-motion` si hace falta.

---

## 9. Accesibilidad y notas

- **Contraste:** `ink` sobre `cream` y blanco sobre `slate` superan AA. El amarillo es **acento**, no texto sobre claro (no usar `clementina` como color de texto sobre crema).
- **Foco visible siempre:** el ring amarillo es la señal de teclado; no removerlo.
- **Tabular-nums obligatorio** en toda columna numérica para alineación.
- **Signo + color:** nunca comunicar positivo/negativo solo por color; va acompañado de signo (`+`/`−`) y, en tablas, alineación.
- **Idioma:** `<html lang="es">`. Textos en español rioplatense; términos de dominio (Cereal, Campaña, Posición, Ajuste, Vendedor) en español.

---

## Relacionado

- [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md) — stack, estructura `src/`, providers y decisiones base.
- [`03-routing-y-layout.md`](03-routing-y-layout.md) — `AppLayout`, los dos sidebars colapsables, topbar de ruta y componentes compartidos (`DataTable`, `FilterBar`, `KpiCard`, `ExportButtons`, `PageHeader`).
- [`04-data-y-estado.md`](04-data-y-estado.md) — TanStack Query, `apiClient` axios, interceptores JWT/refresh y manejo de errores.
- [`05-features.md`](05-features.md) — features (`posicion`, `cuentas`, `dashboard`, `usuarios`, `config`, `auditoria`) y su mapeo a los endpoints de la API.
- Mockup de referencia (repo backend): [`apps/mockup-web/index.html`](../../LcAgro-Procesos/apps/mockup-web/index.html) y su [`README`](../../LcAgro-Procesos/apps/mockup-web/README.md).
