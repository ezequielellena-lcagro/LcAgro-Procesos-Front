import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { fecha, oDash, usd } from "@/shared/format/format";
import { ORDEN_CONTADO } from "../estado-contado";
import { useFacturasContado } from "../queries/use-facturas-contado";
import type { CuentaDto, EstadoContado, FacturaContado } from "../types";
import { EstadoContadoBadge } from "./estado-contado-badge";

const columns: Column<FacturaContado>[] = [
  { key: "comprobante", header: "Comprobante", className: "whitespace-nowrap", cell: (f) => f.comprobante },
  { key: "emision", header: "Emisión", align: "right", className: "whitespace-nowrap", cell: (f) => fecha(f.emision) },
  { key: "vencimiento", header: "Vencimiento", align: "right", className: "whitespace-nowrap", cell: (f) => fecha(f.vencimiento) },
  { key: "plazo", header: "Plazo", align: "right", cell: (f) => `${f.plazoDias} d` },
  { key: "importe", header: "Importe", align: "right", className: "whitespace-nowrap", cell: (f) => usd(f.importe) },
  {
    key: "pendiente",
    header: "Pendiente",
    align: "right",
    className: "whitespace-nowrap",
    cell: (f) => <span className={cn(f.pendiente > 0.01 && "font-medium text-rojo")}>{usd(f.pendiente)}</span>,
  },
  { key: "fechaPago", header: "Pago", align: "right", className: "whitespace-nowrap", cell: (f) => oDash(f.fechaPago, fecha) },
  { key: "estado", header: "Estado", cell: (f) => <EstadoContadoBadge estado={f.estado} /> },
];

/**
 * Detalle de las facturas de contado de una cuenta. El umbral "a vencer" (días) es editable acá
 * mismo y se comparte con el listado (misma señal de semáforo). El backend ya ordena por importancia
 * (Mora → A vencer → Al día → Pagó tarde → Pagada en plazo → Saldada por canje).
 */
export function FacturasContadoDialog({
  cuenta,
  umbralAvencer,
  onUmbralAvencer,
  onClose,
}: {
  cuenta: CuentaDto | null;
  umbralAvencer: number;
  onUmbralAvencer: (dias: number) => void;
  onClose: () => void;
}) {
  const q = useFacturasContado(cuenta?.cuenta ?? null, umbralAvencer);

  // Conteo por estado (desc por importancia) para el resumen tipo "agrupado".
  const tally = useMemo(() => {
    const counts = {} as Record<EstadoContado, number>;
    for (const f of q.data ?? []) counts[f.estado] = (counts[f.estado] ?? 0) + 1;
    return (Object.keys(counts) as EstadoContado[])
      .sort((a, b) => ORDEN_CONTADO[b] - ORDEN_CONTADO[a])
      .map((estado) => ({ estado, n: counts[estado] }));
  }, [q.data]);

  return (
    <Modal
      open={cuenta !== null}
      onClose={onClose}
      title={cuenta ? `Facturas de contado · Cuenta ${cuenta.cuenta}` : ""}
      className="max-w-4xl"
    >
      {cuenta && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{cuenta.denominacion}</p>
              <p className="text-xs text-ink-soft">
                "De contado" = plazo emisión→vencimiento ≤ 30 días. El estado surge del pago real (o del vencimiento si sigue abierta).
              </p>
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              A vencer (días)
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={90}
                className="w-24"
                value={umbralAvencer}
                onChange={(e) => onUmbralAvencer(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          </div>

          {tally.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {tally.map(({ estado, n }) => (
                <span key={estado} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                  <span className="tabular font-semibold text-ink">{n}</span>
                  <EstadoContadoBadge estado={estado} />
                </span>
              ))}
            </div>
          )}

          {q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : q.isPending ? (
            <p className="py-10 text-center text-sm text-ink-soft">Cargando facturas…</p>
          ) : q.data.length === 0 ? (
            <EmptyState mensaje="Esta cuenta no tiene facturas de contado." />
          ) : (
            <DataTable columns={columns} rows={q.data} getRowKey={(f) => f.comprobante} />
          )}
        </div>
      )}
    </Modal>
  );
}
