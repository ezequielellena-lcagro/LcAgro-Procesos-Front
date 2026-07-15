import { useMemo } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import type { ExportColumn, ExportSpec } from "@/shared/export/export-types";
import { exportToXlsx } from "@/shared/export/export-xlsx";
import { fecha, oDash, usd } from "@/shared/format/format";
import { EstadoContadoBadge } from "../components/estado-contado-badge";
import { ESTADO_CONTADO_META, ORDEN_CONTADO } from "../estado-contado";
import { useFacturasContado } from "../queries/use-facturas-contado";
import type { CuentaDto, EstadoContado, FacturaContado } from "../types";

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

const exportColumns: ExportColumn<FacturaContado>[] = [
  { header: "Comprobante", get: (f) => f.comprobante },
  { header: "Emisión", get: (f) => fecha(f.emision) },
  { header: "Vencimiento", get: (f) => fecha(f.vencimiento) },
  { header: "Plazo (días)", get: (f) => f.plazoDias },
  { header: "Importe (USD)", get: (f) => f.importe, format: "usd", total: true },
  { header: "Pendiente (USD)", get: (f) => f.pendiente, format: "usd", total: true },
  { header: "Pago", get: (f) => (f.fechaPago ? fecha(f.fechaPago) : "") },
  { header: "Estado", get: (f) => ESTADO_CONTADO_META[f.estado].label },
];

/**
 * Detalle de las facturas "de contado" de una cuenta, en su propia página (no modal). El resumen de la
 * cuenta (denominación + saldos) llega por router state al venir del listado; si se entra en frío
 * (deep-link/refresh) se muestra solo el N° de cuenta. El umbral "a vencer" va en la URL (?av=) para que
 * el link sea compartible y el Excel salga con el mismo criterio.
 */
export function CuentaContadoPage() {
  const params = useParams();
  const cuenta = Number(params.cuenta);
  const location = useLocation();
  const info = (location.state as { cuenta?: CuentaDto } | null)?.cuenta;

  const [searchParams, setSearchParams] = useSearchParams();
  const umbralAvencer = Math.max(0, Number(searchParams.get("av")) || 7);
  const setUmbral = (n: number) => setSearchParams({ av: String(Math.max(0, n)) }, { replace: true });

  const q = useFacturasContado(Number.isFinite(cuenta) ? cuenta : null, umbralAvencer);

  // Conteo por estado (desc por importancia) para el resumen tipo "agrupado".
  const tally = useMemo(() => {
    const counts = {} as Record<EstadoContado, number>;
    for (const f of q.data ?? []) counts[f.estado] = (counts[f.estado] ?? 0) + 1;
    return (Object.keys(counts) as EstadoContado[])
      .sort((a, b) => ORDEN_CONTADO[b] - ORDEN_CONTADO[a])
      .map((estado) => ({ estado, n: counts[estado] }));
  }, [q.data]);

  const exportar = () => {
    const rows = q.data ?? [];
    if (!rows.length) return;
    const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const spec: ExportSpec<FacturaContado> = {
      filename: `Contado_Cuenta_${cuenta}_${hoy}`,
      title: `Contado ${cuenta}`.slice(0, 28),
      columns: exportColumns,
      rows,
    };
    void exportToXlsx(spec).catch(() => toast.error("No se pudo generar el Excel."));
  };

  return (
    <>
      <div className="no-print mb-3">
        <Link
          to="/cuentas"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Volver a Cuentas Corrientes USD
        </Link>
      </div>

      <PageHeader
        title={`Facturas de contado · Cuenta ${cuenta}`}
        subtitle={info?.denominacion}
        actions={
          <>
            <label className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              A vencer (días)
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={90}
                className="w-20"
                value={umbralAvencer}
                onChange={(e) => setUmbral(Number(e.target.value) || 0)}
              />
            </label>
            <Button type="button" variant="outline" size="sm" onClick={exportar} disabled={!q.data?.length}>
              <Download className="size-4" /> Excel
            </Button>
          </>
        }
      />

      {/* Ancla de conciliación: la verdad es el saldo global (validado), no el pendiente por factura. */}
      {info && (
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-card border border-line bg-panel px-4 py-3 text-sm text-ink-soft shadow-card">
          <span>
            Vendedor: <span className="text-ink">{info.vendedor}</span>
          </span>
          <span>
            Vencido: <span className="tabular font-medium text-rojo">{usd(info.saldoVencido)}</span>
          </span>
          <span>
            A vencer: <span className="tabular text-ink">{usd(info.saldoAVencer)}</span>
          </span>
          <span>
            Saldo total: <span className="tabular font-semibold text-ink">{usd(info.saldo)}</span>
          </span>
        </div>
      )}

      <p className="mb-4 text-xs text-ink-soft">
        "De contado" = plazo emisión→vencimiento ≤ 30 días. <strong className="font-semibold text-ink">Pendiente</strong> y{" "}
        <strong className="font-semibold text-ink">Pago</strong> por factura son informativos: los pagos por canje/LSG o a
        cuenta bajan el saldo global sin imputarse a una factura, así que una factura puede figurar pendiente aunque la
        cuenta ya esté saldada. El <strong className="font-semibold text-ink">saldo total</strong> manda.
      </p>

      {tally.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
    </>
  );
}
