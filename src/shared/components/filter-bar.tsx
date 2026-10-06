import type { FormEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Barra de filtros sobre una tabla o panel.
 *
 * El `mb-4` es lo que la separa de lo que viene abajo: NO lo anules con `mb-0` confiando en el
 * `space-y-*` del contenedor. Tailwind v4 genera `space-y` como `:where(& > :not(:last-child))`,
 * y el `:where()` deja la especificidad en 0 → cualquier `mb-*` del hijo lo pisa y la barra queda
 * pegada a la tabla.
 *
 * Con `onSubmit` la barra se renderiza como `<form>`: los filtros que no se aplican al tipear sino
 * con un botón (un período que dispara una consulta) necesitan que Enter dentro de un campo valga
 * lo mismo que apretar ese botón.
 */
export function FilterBar({
  children,
  className,
  onSubmit,
}: {
  children: ReactNode;
  className?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  const clases = cn(
    "no-print mb-4 flex flex-wrap items-end gap-3 rounded-card border border-line bg-panel p-3.5 shadow-card",
    className,
  );
  return onSubmit ? (
    <form className={clases} onSubmit={onSubmit}>
      {children}
    </form>
  ) : (
    <div className={clases}>{children}</div>
  );
}

/**
 * Campo etiquetado para la FilterBar (label arriba, control abajo).
 * `title` va en el label y no solo en el control: un control deshabilitado no dispara el tooltip.
 */
export function FilterField({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <label title={title} className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
      {label}
      {children}
    </label>
  );
}
