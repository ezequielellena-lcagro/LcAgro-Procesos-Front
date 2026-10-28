import { useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Acción de una fila como ícono solo, con el nombre en un tooltip. Con texto, cuatro acciones
 * ocupaban media fila. El tooltip se dibuja en el body: dentro de la tabla, su scroll horizontal
 * lo recortaba.
 */
export function BotonIcono({
  icono: Icono,
  etiqueta,
  className,
  variant = "ghost",
  ...props
}: Omit<ButtonProps, "children" | "size"> & {
  icono: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  etiqueta: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const mostrar = (e: { currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
  };
  const ocultar = () => setPos(null);
  return (
    <>
      <Button
        type="button"
        size="icon"
        variant={variant}
        aria-label={etiqueta}
        className={cn("size-9", className)}
        onMouseEnter={mostrar}
        onMouseLeave={ocultar}
        onFocus={mostrar}
        onBlur={ocultar}
        {...props}
      >
        <Icono className="size-4" aria-hidden />
      </Button>
      {pos && (
        <Tooltip x={pos.x} y={pos.y}>
          {etiqueta}
        </Tooltip>
      )}
    </>
  );
}

function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return createPortal(
    <span
      role="tooltip"
      style={{ left: x, top: y - 6 }}
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-brand px-2 py-1 text-xs font-medium text-white shadow-card"
    >
      {children}
    </span>,
    document.body,
  );
}
