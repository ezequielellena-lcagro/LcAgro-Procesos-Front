import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { numero, oDash, usd } from "@/shared/format/format";
import { type PosicionDto, TIPOS_AJUSTE } from "../types";

const tipoLabel: Record<string, string> = Object.fromEntries(TIPOS_AJUSTE.map((t) => [t.value, t.label]));

/** Agrupa por campaña y ordena de la más nueva a la más vieja. */
function agruparPorCampania(filas: PosicionDto[]): [string, PosicionDto[]][] {
  const mapa = new Map<string, PosicionDto[]>();
  for (const f of filas) {
    const arr = mapa.get(f.campania) ?? [];
    arr.push(f);
    mapa.set(f.campania, arr);
  }
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export function PosicionDetalle({ filas }: { filas: PosicionDto[] }) {
  const campanias = agruparPorCampania(filas);
  return (
    <div className="space-y-3">
      {campanias.map(([campania, rows], i) => (
        // Solo la campaña más nueva arranca abierta: el resto se despliega a pedido para no scrollear
        // toda la historia. El estado vive en cada bloque y React lo conserva por la key (campaña).
        <CampaniaBloque key={campania} campania={campania} rows={rows} defaultAbierto={i === 0} />
      ))}
    </div>
  );
}

function CampaniaBloque({
  campania,
  rows,
  defaultAbierto,
}: {
  campania: string;
  rows: PosicionDto[];
  defaultAbierto: boolean;
}) {
  const [abierto, setAbierto] = useState(defaultAbierto);
  const sinVentas = rows.every((r) => r.tnVenta === 0);
  // Los totales de la campaña suman los CONSOLIDADOS (con ajustes), que es lo que el cliente compara.
  const totCompra = rows.reduce((s, r) => s + r.tnCompraTotal, 0);
  const totVenta = rows.reduce((s, r) => s + r.tnVentaTotal, 0);
  const totPosicion = rows.reduce((s, r) => s + r.posicionFinal, 0);
  const panelId = `detalle-${campania}`;

  return (
    <section className="rounded-card border border-line bg-panel px-5 py-4 shadow-card">
      <header className={cn("flex flex-wrap items-center gap-2", abierto && "mb-3")}>
        <h3 className="font-display text-lg text-ink">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-controls={panelId}
            className="flex items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {abierto ? (
              <ChevronDown className="size-4 flex-none text-ink-soft" />
            ) : (
              <ChevronRight className="size-4 flex-none text-ink-soft" />
            )}
            Campaña {campania}
          </button>
        </h3>
        {sinVentas && (
          <span className="rounded bg-clementina/15 px-2 py-0.5 text-xs font-semibold text-clementina-deep">
            sin ventas cargadas
          </span>
        )}
        {/* Colapsada, la campaña sigue diciendo lo esencial: es la fila Total en una línea. */}
        {!abierto && (
          <span className="tabular ml-auto flex items-center gap-3 text-xs text-ink-soft">
            <span>Compra {numero(totCompra)}</span>
            <span>Venta {numero(totVenta)}</span>
            <span className={cn("font-semibold", totPosicion >= 0 ? "text-verde" : "text-rojo")}>
              Posición {numero(totPosicion)}
            </span>
          </span>
        )}
      </header>

      {abierto && (
        <table id={panelId} className="tabular w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <th scope="col" className="py-1.5 text-left font-semibold">Cereal</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Compra tn</th>
              <th scope="col" className="py-1.5 text-right font-semibold">P. compra</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Venta tn</th>
              <th scope="col" className="py-1.5 text-right font-semibold">P. venta</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Posición</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <CerealFilas key={`${r.campania}-${r.cereal}`} fila={r} />
            ))}
            <tr className="border-t-2 border-line font-semibold text-ink">
              <td className="py-2 text-left">Total</td>
              <td className="py-2 text-right">{numero(totCompra)}</td>
              <td />
              <td className="py-2 text-right">{numero(totVenta)}</td>
              <td />
              <td className={cn("py-2 text-right", totPosicion >= 0 ? "text-verde" : "text-rojo")}>
                {numero(totPosicion)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * Un cereal = el TOTAL arriba (título, con precio ponderado) y debajo el desglose de dónde sale:
 * lo que da el sistema + cada ajuste en SU lado (el arrastre/semilla que restan van a ventas; los que
 * suman, a compras). Es el formato que el cliente controla contra su planilla.
 */
function CerealFilas({ fila }: { fila: PosicionDto }) {
  return (
    <>
      <tr className="border-b border-line-soft">
        <td className="py-1.5 text-left font-semibold text-ink">{fila.cereal}</td>
        <td className="py-1.5 text-right font-semibold text-verde">
          {fila.tnCompraTotal ? numero(fila.tnCompraTotal) : "—"}
        </td>
        <td className="py-1.5 text-right font-semibold">{oDash(fila.precioCompraTotal, usd)}</td>
        <td className="py-1.5 text-right font-semibold text-rojo">
          {fila.tnVentaTotal ? numero(fila.tnVentaTotal) : "—"}
        </td>
        <td className="py-1.5 text-right font-semibold">{oDash(fila.precioVentaTotal, usd)}</td>
        <td className={cn("py-1.5 text-right font-semibold", fila.posicionFinal >= 0 ? "text-verde" : "text-rojo")}>
          {numero(fila.posicionFinal)}
        </td>
      </tr>

      <tr className="text-ink-soft">
        <td className="py-1 pl-6 text-left text-xs">del sistema</td>
        <td className="py-1 text-right text-xs">{fila.tnCompra ? numero(fila.tnCompra) : "—"}</td>
        <td className="py-1 text-right text-xs">{oDash(fila.precioCompra, usd)}</td>
        <td className="py-1 text-right text-xs">{fila.tnVenta ? numero(fila.tnVenta) : "—"}</td>
        <td className="py-1 text-right text-xs">{oDash(fila.precioVenta, usd)}</td>
        <td />
      </tr>

      {fila.ajustesDetalle.map((a) => (
        <tr key={a.tipo} className="text-ink-soft">
          <td className="py-1 pl-6 text-left text-xs">{tipoLabel[a.tipo] ?? a.tipo}</td>
          <td className="py-1 text-right text-xs">{a.tn > 0 ? numero(a.tn) : ""}</td>
          <td className="py-1 text-right text-xs">{a.tn > 0 ? oDash(a.precioUsd, usd) : ""}</td>
          <td className="py-1 text-right text-xs">{a.tn < 0 ? numero(-a.tn) : ""}</td>
          <td className="py-1 text-right text-xs">{a.tn < 0 ? oDash(a.precioUsd, usd) : ""}</td>
          <td />
        </tr>
      ))}
    </>
  );
}
