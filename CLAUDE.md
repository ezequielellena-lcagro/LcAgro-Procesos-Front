# CLAUDE.md — LcAgro-Procesos-Front

> Contexto raíz del repo de **frontend**. Claude Code lo lee automáticamente al abrir el repo.

## Qué es

Frontend de la **plataforma de procesos de La Clementina S.A.** (empresa agropecuaria, Argentina). Es una **SPA React** que consume la **API .NET** del repo hermano **`LcAgro-Procesos`** (que además contiene toda la documentación de negocio, las queries validadas y el mockup).

La idea integral ya está validada en un **mockup navegable** (`apps/mockup-web` en el repo `LcAgro-Procesos`); este repo es la **implementación real** de esa idea.

## Idioma

Responder **siempre en español** (rioplatense, claro y directo). Mantener tildes y ñ. El código va en inglés salvo términos de dominio (`Cereal`, `Campania`, `Posicion`, `Ajuste`, `Vendedor`).

## Stack

- **Vite + React + TypeScript.**
- **Tailwind CSS + shadcn/ui** para la UI.
- **TanStack Query** (estado de servidor) + **axios** (cliente HTTP con interceptor JWT/refresh).
- **react-router** (ruteo), **react-hook-form + zod** (formularios), **sonner** (toasts).

## Estética (del mockup)

- Amarillo clementina `#ffc10e`, slate `#2b4150`, lienzo crema.
- Tipografías **Fraunces** (display/títulos) + **Hanken Grotesk** (cuerpo/UI).
- Layout: dos sidebars colapsables (Áreas + Procesos) + topbar con la ruta. Detalle en [`docs/03-routing-y-layout.md`](docs/03-routing-y-layout.md).

## Dónde está la especificación

Todo el diseño del front está en [`docs/`](docs/README.md) (7 documentos: arquitectura, design system, routing/layout, data/estado, features, setup, plan). El **contrato de la API** que se consume vive en el repo backend: `../LcAgro-Procesos/02-desarrollo/05-api-contratos.md`.

## Convenciones

- Archivos y carpetas **nuestros**: minúsculas, con guiones, sin tildes ni espacios.
- Organización **feature-first** (`src/features/<feature>/`), UI compartida en `src/shared/` y `src/components/ui/` (shadcn).
- Fechas **absolutas**. Variables de entorno con prefijo `VITE_` (ej. `VITE_API_URL`).

## Estado

Especificación escrita (`docs/`). **Código aún no scaffoldeado** — el primer paso es seguir [`docs/06-setup-y-entornos.md`](docs/06-setup-y-entornos.md) y [`docs/07-plan-de-implementacion.md`](docs/07-plan-de-implementacion.md).
