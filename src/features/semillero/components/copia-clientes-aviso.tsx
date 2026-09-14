import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { avisoCopiaClientes, type NivelCopiaClientes } from "../lib/copia-clientes";
import type { EstadoCopiaClientesDto } from "../types";

interface Props {
  estado: EstadoCopiaClientesDto;
  onActualizar: () => void;
  actualizando: boolean;
}

const ESTILOS: Record<NivelCopiaClientes, string> = {
  ok: "border-verde/30 bg-verde-bg text-verde",
  desactualizada: "border-clementina/40 bg-clementina/10 text-clementina-deep",
  sinCopia: "border-rojo/30 bg-rojo-bg text-rojo",
};

/** `sinCopia` avisa lo mismo que `desactualizada` (icono de alerta): no hay copia para elegir. */
function Icono({ nivel }: { nivel: NivelCopiaClientes }) {
  const Componente = nivel === "ok" ? CheckCircle2 : AlertTriangle;
  return <Componente className="size-4 shrink-0" aria-hidden="true" />;
}

/**
 * Aviso del estado de la copia local de clientes de MacroGest (R2.3/R2.4), con el botón manual
 * "Actualizar clientes". El texto y el nivel (ok/desactualizada/sinCopia) salen de
 * `lib/copia-clientes.ts`, puro; acá sólo se decide el color y se ofrece la acción.
 */
export function CopiaClientesAviso({ estado, onActualizar, actualizando }: Props) {
  const aviso = avisoCopiaClientes(estado);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2 rounded-card border px-3 py-2 text-sm", ESTILOS[aviso.nivel])}
    >
      <Icono nivel={aviso.nivel} />
      <p className="flex-1">{aviso.mensaje}</p>
      <Button type="button" size="sm" variant="outline" onClick={onActualizar} disabled={actualizando}>
        <RefreshCw className={cn("mr-1 size-3.5", actualizando && "animate-spin")} aria-hidden="true" />
        {actualizando ? "Actualizando…" : "Actualizar clientes"}
      </Button>
    </div>
  );
}
