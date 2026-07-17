import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { numero, oDash, usd } from "@/shared/format/format";
import type { PosicionDto } from "../types";

// Tarjeta centrada en la POSICIÓN neta en toneladas (lo que importa al negocio), no en el margen.
export function PosicionCard({ fila }: { fila: PosicionDto }) {
  const positiva = fila.posicionFinal >= 0;

  return (
    <div
      className={cn(
        "rounded-card border border-line bg-panel p-4 shadow-card",
        positiva ? "border-l-4 border-l-verde" : "border-l-4 border-l-rojo",
      )}
    >
      <h3 className="font-display text-lg font-semibold text-ink">{fila.cereal}</h3>

      <div className="mt-1 font-display text-2xl font-semibold tabular">
        <span className={cn(positiva ? "text-verde" : "text-rojo")}>{numero(fila.posicionFinal)}</span>
        <span className="ml-1 text-sm font-normal text-ink-soft">tn de posición</span>
      </div>

      {/* Totales consolidados (ya con arrastre/semilla, a precio ponderado): el desglose va en Detalle. */}
      <dl className="mt-3 space-y-1 text-sm">
        <Row k="Compra" v={`${numero(fila.tnCompraTotal)} tn`} sub={oDash(fila.precioCompraTotal, usd)} />
        <Row k="Venta" v={`${numero(fila.tnVentaTotal)} tn`} sub={oDash(fila.precioVentaTotal, usd)} />
      </dl>
    </div>
  );
}

function Row({ k, v, sub }: { k: string; v: ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="tabular text-right text-ink">
        {v}
        {sub && <span className="ml-1.5 text-xs text-ink-soft">{sub}</span>}
      </dd>
    </div>
  );
}
