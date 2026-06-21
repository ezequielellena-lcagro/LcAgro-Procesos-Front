# docs — Frontend de LcAgro (React)

Especificación del **frontend** de la plataforma de procesos de La Clementina: una **SPA React** (Vite + TypeScript + Tailwind + shadcn/ui) que consume la **API .NET** del repo hermano **`LcAgro-Procesos`**. Está basada en el **mockup navegable** ya validado (`apps/mockup-web` en ese repo).

> **Cómo leerlo:** empezá por [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md). El **plan ejecutable** está en [`07-plan-de-implementacion.md`](07-plan-de-implementacion.md).

## Decisiones (resumen)

- **Stack:** Vite + React + TypeScript + Tailwind CSS + **shadcn/ui**.
- **Datos/estado:** **TanStack Query** + `axios` (interceptor JWT + refresh); auth en context.
- **Estética:** agro-fintech — **Fraunces** (display) + **Hanken Grotesk** (cuerpo), amarillo clementina `#ffc10e`, slate `#2b4150`.
- **Export** Excel/PDF del lado cliente. Rutas protegidas por rol.

## Documentos

| # | Documento | Tema |
|---|---|---|
| 01 | [`01-arquitectura-frontend.md`](01-arquitectura-frontend.md) | Estructura `src/`, librerías, convenciones |
| 02 | [`02-design-system.md`](02-design-system.md) | Theme, tokens (colores/fuentes), shadcn, componentes base |
| 03 | [`03-routing-y-layout.md`](03-routing-y-layout.md) | Routing, layout (dos sidebars + topbar), guards por rol |
| 04 | [`04-data-y-estado.md`](04-data-y-estado.md) | `apiClient`, TanStack Query, auth/sesión, errores |
| 05 | [`05-features.md`](05-features.md) | Pantalla por pantalla, mapeada a los endpoints |
| 06 | [`06-setup-y-entornos.md`](06-setup-y-entornos.md) | Setup (Vite/Tailwind/shadcn), scripts, build/deploy |
| 07 | [`07-plan-de-implementacion.md`](07-plan-de-implementacion.md) | **Backlog por milestones (plan ejecutable)** |

## Backend

La especificación del **backend (.NET 10)** y, sobre todo, el **contrato de la API** que consume este front, están en el repo `LcAgro-Procesos`:

- Índice de desarrollo: `../../LcAgro-Procesos/02-desarrollo/README.md`
- **Contrato de la API:** `../../LcAgro-Procesos/02-desarrollo/05-api-contratos.md`
