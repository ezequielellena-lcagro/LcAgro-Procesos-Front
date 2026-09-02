import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fecha, oDash, pct } from "@/shared/format/format";
import { importe, monedaLabel } from "../format";
import type { VencimientosDto } from "../types";

interface Props {
  usd: VencimientosDto | undefined;
  ars: VencimientosDto | undefined;
  cargando: boolean;
  onDescargarExcel: () => void;
  descargando: boolean;
  onImprimir: () => void;
}

const HOY = () => new Date().toLocaleDateString("es-AR");

/**
 * El reporte en pantalla: la hoja que Administración imprime hoy, mirable sin bajar un archivo.
 *
 * <p>Sale de los <b>mismos datos</b> que el Excel — el mismo calendario de vencimientos —, así que
 * los dos no pueden decir cosas distintas. Y el PDF sale de imprimir <b>esta misma vista</b>: no hay
 * un tercer generador que se pueda desincronizar de los otros dos.</p>
 */
export function ReportePanel({
  usd,
  ars,
  cargando,
  onDescargarExcel,
  descargando,
  onImprimir,
}: Props) {
  if (cargando || (!usd && !ars)) {
    return <p className="py-10 text-center text-sm text-ink-soft">Armando el reporte…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-soft">
          Los mismos números que el Excel y que el calendario: sale del mismo cálculo.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onImprimir}>
            <Printer className="mr-1 size-3.5" />
            Imprimir / PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDescargarExcel}
            disabled={descargando}
          >
            <Download className="mr-1 size-3.5" />
            {descargando ? "Generando…" : "Excel"}
          </Button>
        </div>
      </div>

      <h2 className="font-display text-lg font-semibold text-ink">
        PRÉSTAMOS LA CLEMENTINA S.A. — al {HOY()}
      </h2>

      {/* Pesos primero, igual que en el Excel. */}
      <Bloque titulo={`PRÉSTAMOS ${monedaLabel("ARS")}`} datos={ars} />
      <Bloque titulo={`PRÉSTAMOS ${monedaLabel("USD")}`} datos={usd} />
    </div>
  );
}

/** Un bloque de moneda con su fila TOTAL, como en la planilla. */
function Bloque({ titulo, datos }: { titulo: string; datos: VencimientosDto | undefined }) {
  // Sin vencimientos no se dibuja una tabla vacía con un total en cero: no dice nada.
  if (!datos || datos.items.length === 0) return null;

  return (
    <section aria-label={titulo} className="break-inside-avoid">
      <h3 className="rounded-t-md bg-slate-brand px-3 py-1.5 text-sm font-semibold text-white">
        {titulo}
      </h3>

      <div className="overflow-x-auto rounded-b-md border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-2 py-1.5 text-left font-semibold">Fecha vto.</th>
              <th className="px-2 py-1.5 text-left font-semibold">Banco</th>
              <th className="px-2 py-1.5 text-left font-semibold">Sucursal</th>
              <th className="px-2 py-1.5 text-left font-semibold">Línea</th>
              <th className="px-2 py-1.5 text-left font-semibold">N° operación</th>
              <th className="px-2 py-1.5 text-left font-semibold">Cuota</th>
              <th className="px-2 py-1.5 text-right font-semibold">Capital</th>
              <th className="px-2 py-1.5 text-right font-semibold">Interés</th>
              <th className="px-2 py-1.5 text-right font-semibold">IVA</th>
              <th className="px-2 py-1.5 text-right font-semibold">Total</th>
              <th className="px-2 py-1.5 text-right font-semibold">TNA</th>
            </tr>
          </thead>
          <tbody>
            {datos.items.map((c, i) => (
              <tr
                key={c.cuotaId}
                className={i % 2 === 1 ? "bg-line-soft/45" : undefined}
                data-franja={i % 2 === 1 ? "" : undefined}
              >
                <td className="whitespace-nowrap px-2 py-1 tabular">{fecha(c.fechaVencimiento)}</td>
                <td className="px-2 py-1">{c.banco}</td>
                <td className="px-2 py-1">{c.sucursal ?? "—"}</td>
                <td className="px-2 py-1">{c.linea}</td>
                <td className="px-2 py-1 tabular">{c.nroOperacion ?? "—"}</td>
                <td className="whitespace-nowrap px-2 py-1 tabular">
                  {c.nroCuota}/{c.cantidadCuotas}
                </td>
                <td className="px-2 py-1 text-right tabular">{importe(c.capital)}</td>
                <td className="px-2 py-1 text-right tabular">{importe(c.interes)}</td>
                <td className="px-2 py-1 text-right tabular">{importe(c.iva)}</td>
                <td className="px-2 py-1 text-right font-medium tabular">{importe(c.total)}</td>
                <td className="px-2 py-1 text-right tabular">{oDash(c.tasaNominalAnual, pct)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-panel-soft font-semibold tabular">
              <td className="px-2 py-1.5" colSpan={6}>
                TOTAL
              </td>
              <td className="px-2 py-1.5 text-right">{importe(datos.totalCapital)}</td>
              <td className="px-2 py-1.5 text-right">{importe(datos.totalInteres)}</td>
              <td className="px-2 py-1.5 text-right">{importe(datos.totalIva)}</td>
              <td className="px-2 py-1.5 text-right">{importe(datos.totalTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
