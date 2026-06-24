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
    <div className="space-y-4">
      {campanias.map(([campania, rows]) => (
        <CampaniaBloque key={campania} campania={campania} rows={rows} />
      ))}
    </div>
  );
}

function CampaniaBloque({ campania, rows }: { campania: string; rows: PosicionDto[] }) {
  const sinVentas = rows.every((r) => r.tnVenta === 0);
  const totCompra = rows.reduce((s, r) => s + r.tnCompra, 0);
  const totVenta = rows.reduce((s, r) => s + r.tnVenta, 0);
  const totPosicion = rows.reduce((s, r) => s + r.posicionFinal, 0);

  return (
    <section className="rounded-card border border-line bg-panel p-5 shadow-card">
      <header className="mb-3 flex items-center gap-2">
        <h3 className="font-display text-lg text-ink">Campaña {campania}</h3>
        {sinVentas && (
          <span className="rounded bg-clementina/15 px-2 py-0.5 text-xs font-semibold text-clementina-deep">
            sin ventas cargadas
          </span>
        )}
      </header>
      <table className="tabular w-full text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
            <th className="py-1.5 text-left font-semibold">Cereal</th>
            <th className="py-1.5 text-right font-semibold">Compra tn</th>
            <th className="py-1.5 text-right font-semibold">P. compra</th>
            <th className="py-1.5 text-right font-semibold">Venta tn</th>
            <th className="py-1.5 text-right font-semibold">P. venta</th>
            <th className="py-1.5 text-right font-semibold">Posición</th>
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
    </section>
  );
}

function CerealFilas({ fila }: { fila: PosicionDto }) {
  return (
    <>
      <tr className="border-b border-line-soft">
        <td className="py-1.5 text-left font-medium text-ink">{fila.cereal}</td>
        <td className="py-1.5 text-right text-verde">{fila.tnCompra ? numero(fila.tnCompra) : "—"}</td>
        <td className="py-1.5 text-right">{oDash(fila.precioCompra, usd)}</td>
        <td className="py-1.5 text-right text-rojo">{fila.tnVenta ? numero(fila.tnVenta) : "—"}</td>
        <td className="py-1.5 text-right">{oDash(fila.precioVenta, usd)}</td>
        <td className={cn("py-1.5 text-right font-semibold", fila.posicionFinal >= 0 ? "text-verde" : "text-rojo")}>
          {numero(fila.posicionFinal)}
        </td>
      </tr>
      {fila.ajustesDetalle.map((a) => (
        <tr key={a.tipo} className="italic text-ink-soft">
          <td className="py-1 pl-6 text-left text-xs">{tipoLabel[a.tipo] ?? a.tipo}</td>
          <td />
          <td />
          <td className="py-1 text-right text-xs">{numero(a.tn)}</td>
          <td className="py-1 text-right text-xs">{oDash(a.precioUsd, usd)}</td>
          <td />
        </tr>
      ))}
    </>
  );
}
