import { Button } from "@/components/ui/button";
import { fecha, hoy, sumarDias } from "../format";
import { cursorPropio, useListado } from "../queries/use-logistica";
import type { Solicitud } from "../types";

/**
 * Lo que se le pidió a la terminal y todavía no entró a MacroGest. Un pedido de cupo no crea un
 * cupo: el cupo recién aparece en planta 0 cuando la terminal lo manda y se carga en MacroGest.
 * Sin este aviso, lo pedido no se veía en Otorgar y parecía perdido.
 */
export function PedidosCupoEsperando({ onVerHistorial }: { onVerHistorial?: () => void }) {
  const q = useListado<Solicitud>(
    "solicitudes-terminal",
    { desde: sumarDias(hoy(), -7), hastaExclusivo: sumarDias(hoy(), 31) },
    cursorPropio,
  );
  const esperando = (q.data?.pages.flatMap((p) => p.filas) ?? []).filter(
    (s) => !s.cerradaAl && (s.conseguidos === null || s.conseguidos < s.cantidadCupos),
  );
  if (!esperando.length) return null;
  return (
    <section
      aria-label="Pedidos de cupo esperando a la terminal"
      className="rounded-card border border-line bg-secondary/40 p-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-ink">Pedidos a la terminal que todavía no llegaron</p>
        {onVerHistorial && (
          <Button size="sm" variant="ghost" onClick={onVerHistorial}>
            Ver historial de pedidos de cupo
          </Button>
        )}
      </div>
      <ul className="mt-1 space-y-0.5 text-ink-soft">
        {esperando.map((s) => (
          <li key={s.id}>
            Contrato {s.contratoVenta} · {s.productoNombre ?? s.producto} {s.campania} · para el{" "}
            {fecha(s.fechaSolicitada)}:{" "}
            {s.conseguidos === null
              ? `${s.cantidadCupos} pedidos, sin verificar en MacroGest`
              : `faltan ${s.cantidadCupos - s.conseguidos} de ${s.cantidadCupos}`}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-ink-soft">
        Aparecen para otorgar cuando la terminal los manda y se cargan en MacroGest.
      </p>
    </section>
  );
}
