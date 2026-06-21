import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { numero, oDash, pct, usd } from "@/shared/format/format";
import type { PosicionDto } from "../types";

export function PosicionCard({ fila }: { fila: PosicionDto }) {
  const positiva = fila.posicionFinal >= 0;
  const margenPositivo = (fila.margenUsdTn ?? 0) >= 0;

  return (
    <div className={cn("rounded-card border border-line bg-panel p-4 shadow-card", positiva ? "border-l-4 border-l-verde" : "border-l-4 border-l-rojo")}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-ink">{fila.cereal}</h3>
        {fila.margenPct != null && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              margenPositivo ? "bg-verde-bg text-verde" : "bg-rojo-bg text-rojo",
            )}
          >
            {pct(fila.margenPct)}
          </span>
        )}
      </div>

      <div className="mt-1 font-display text-2xl font-semibold tabular text-ink">
        {oDash(fila.margenUsdTn, usd)}
        <span className="ml-1 text-sm font-normal text-ink-soft">/tn</span>
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <Row k="Compra" v={`${numero(fila.tnCompra)} tn`} sub={oDash(fila.precioCompra, usd)} />
        <Row k="Venta" v={`${numero(fila.tnVenta)} tn`} sub={oDash(fila.precioVenta, usd)} />
        <Row k="Resultado calzado" v={usd(fila.resultadoUsd)} />
        <Row
          k="Posición"
          v={
            <span className={cn("font-semibold", positiva ? "text-verde" : "text-rojo")}>
              {numero(fila.posicionFinal)} tn
            </span>
          }
        />
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
