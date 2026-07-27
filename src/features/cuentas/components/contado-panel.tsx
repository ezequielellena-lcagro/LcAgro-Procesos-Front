import { useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { exportToXlsx } from "@/shared/export/export-xlsx";
import type { ExportColumn, ExportSpec } from "@/shared/export/export-types";
import { fecha, usd } from "@/shared/format/format";
import { useContado } from "../queries/use-contado";
import type { Contado, CuentaContado, FacturaContado, VendedorContado } from "../types";

const AVISO =
  "El pendiente por factura es informativo: canje/LSG bajan el saldo global sin imputarse a la factura, " +
  "así que una factura puede figurar impaga aunque la cuenta ya esté saldada — manda el saldo total.";

/** Fila plana del Excel: una por factura, con su cuenta y vendedor repetidos. */
interface FilaExportContado {
  vendedor: string;
  cuenta: number;
  denominacion: string;
  saldoCuenta: number;
  factura: FacturaContado;
}

function filasPlanas(datos: Contado): FilaExportContado[] {
  return datos.vendedores.flatMap((v) =>
    v.detalle.flatMap((c) =>
      c.facturas.map((f) => ({
        vendedor: v.vendedor,
        cuenta: c.cuenta,
        denominacion: c.denominacion,
        saldoCuenta: c.saldo,
        factura: f,
      })),
    ),
  );
}

const COLUMNAS_EXPORT: ExportColumn<FilaExportContado>[] = [
  { header: "Vendedor", get: (r) => r.vendedor },
  { header: "Cuenta", get: (r) => r.cuenta },
  { header: "Cliente", get: (r) => r.denominacion },
  { header: "Comprobante", get: (r) => r.factura.comprobante },
  { header: "Emisión", get: (r) => fecha(r.factura.emision) },
  { header: "Vencimiento", get: (r) => fecha(r.factura.vencimiento) },
  { header: "Plazo (días)", get: (r) => r.factura.plazoDias, format: "number" },
  { header: "Estado", get: (r) => (r.factura.vencida ? "Vencida" : "A vencer") },
  { header: "Días atraso", get: (r) => r.factura.diasAtraso, format: "number" },
  { header: "Importe (USD)", get: (r) => r.factura.importe, format: "usd", total: true },
  { header: "Pendiente (USD)", get: (r) => r.factura.pendiente, format: "usd", total: true },
  { header: "Saldo total cuenta (USD)", get: (r) => r.saldoCuenta, format: "usd" },
];

function specExport(datos: Contado): ExportSpec<FilaExportContado> {
  return {
    filename: `Facturas_Contado_${datos.corte.replace(/-/g, "")}`,
    title: "Facturas de contado",
    subtitle: `Corte ${fecha(datos.corte)}`,
    columns: COLUMNAS_EXPORT,
    rows: filasPlanas(datos),
  };
}

/** Badge de estado de la factura: Vencida (rojo) vs A vencer (verde/neutro). */
function EstadoBadge({ vencida }: { vencida: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        vencida ? "bg-rojo-bg text-rojo" : "bg-verde-bg text-verde",
      )}
    >
      {vencida ? "Vencida" : "A vencer"}
    </span>
  );
}

const COLUMNAS_FACTURAS: Column<FacturaContado>[] = [
  {
    key: "comprobante",
    header: "Comprobante",
    cell: (f) => <span className="font-medium text-ink">{f.comprobante}</span>,
  },
  { key: "emision", header: "Emisión", cell: (f) => fecha(f.emision) },
  { key: "vencimiento", header: "Vencimiento", cell: (f) => fecha(f.vencimiento) },
  { key: "plazo", header: "Plazo", align: "right", cell: (f) => `${f.plazoDias} d` },
  { key: "estado", header: "Estado", cell: (f) => <EstadoBadge vencida={f.vencida} /> },
  {
    key: "atraso",
    header: "Días atraso",
    align: "right",
    cell: (f) =>
      f.vencida ? (
        <span className="font-medium text-rojo">{f.diasAtraso}</span>
      ) : (
        <span className="text-ink-soft">—</span>
      ),
  },
  { key: "importe", header: "Importe", align: "right", cell: (f) => usd(f.importe) },
  {
    key: "pendiente",
    header: "Pendiente",
    align: "right",
    cell: (f) => <span className="font-semibold text-ink">{usd(f.pendiente)}</span>,
  },
];

/** Una celda de un `dl` de montos (label arriba, valor abajo, alineado a la derecha). */
function DatoMonto({ label, valor, className }: { label: string; valor: number; className?: string }) {
  return (
    <div className="px-3 py-1.5 text-right">
      <dt className="text-[0.7rem] uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className={cn("tabular text-sm", className)}>{usd(valor)}</dd>
    </div>
  );
}

/**
 * Saldo GLOBAL de la cuenta (todos sus movimientos). Es el ancla de conciliación: si es menor que
 * el contado impago, la diferencia se pagó por canje/LSG sin imputarse a las facturas.
 */
function SaldoGlobal({ cuenta }: { cuenta: CuentaContado }) {
  return (
    <dl
      className="flex divide-x divide-line rounded-card border border-line bg-panel"
      title="Saldo global de la cuenta (todos sus movimientos, no solo las facturas de contado)."
    >
      <DatoMonto
        label="Vencido"
        valor={cuenta.saldoVencido}
        className={cuenta.saldoVencido > 0 ? "font-medium text-rojo" : "text-ink"}
      />
      <DatoMonto label="A vencer" valor={cuenta.saldoAVencer} className="text-ink" />
      <DatoMonto
        label="Saldo total"
        valor={cuenta.saldo}
        className={cn("font-semibold", cuenta.saldo <= 0 ? "text-verde" : "text-ink")}
      />
    </dl>
  );
}

function BloqueCuenta({ cuenta }: { cuenta: CuentaContado }) {
  const totalImporte = cuenta.facturas.reduce((s, f) => s + f.importe, 0);
  // El saldo global por debajo del contado es el caso "saldada por canje/LSG": se avisa, no es un error.
  const saldadaPorCanje = cuenta.saldo < cuenta.monto;

  return (
    <article className="rounded-card border border-line bg-panel-soft/40 p-3">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">
            {cuenta.cuenta} — {cuenta.denominacion}
          </p>
          <p className="text-xs text-ink-soft">
            {cuenta.facturas.length} {cuenta.facturas.length === 1 ? "factura" : "facturas"} de contado ·{" "}
            <span className={cuenta.montoVencido > 0 ? "font-semibold text-rojo" : "text-ink-soft"}>
              Vencido {usd(cuenta.montoVencido)}
            </span>{" "}
            · A vencer <span className="font-semibold text-ink">{usd(cuenta.montoAVencer)}</span> · Total{" "}
            <span className="font-semibold text-ink">{usd(cuenta.monto)}</span>
          </p>
          {saldadaPorCanje && (
            <p className="mt-1 text-xs text-ink-soft">
              El saldo global es menor que el monto de contado (canje/LSG): manda el saldo total.
            </p>
          )}
        </div>
        <SaldoGlobal cuenta={cuenta} />
      </header>

      <DataTable
        columns={COLUMNAS_FACTURAS}
        rows={cuenta.facturas}
        getRowKey={(f) => f.comprobante}
        footer={["TOTAL", "", "", "", "", "", usd(totalImporte), usd(cuenta.monto)]}
      />
    </article>
  );
}

/** Montos de contado del vendedor: vencido (rojo) / a vencer / total, para el encabezado colapsable. */
function MontosVendedor({ vendedor }: { vendedor: VendedorContado }) {
  return (
    <span className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 tabular text-sm">
      <span className={vendedor.montoVencido > 0 ? "font-medium text-rojo" : "text-ink-soft"}>
        Venc. {usd(vendedor.montoVencido)}
      </span>
      <span className="text-ink-soft">A venc. {usd(vendedor.montoAVencer)}</span>
      <span className="font-semibold text-ink">{usd(vendedor.monto)}</span>
    </span>
  );
}

function BloqueVendedor({ vendedor }: { vendedor: VendedorContado }) {
  const [abierto, setAbierto] = useState(true); // abierta por defecto

  return (
    <section className="overflow-hidden rounded-card border border-line bg-panel shadow-card">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-panel-soft/60"
      >
        {abierto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span className="font-semibold text-ink">{vendedor.vendedor}</span>
        <span className="text-xs text-ink-soft">
          {vendedor.cuentas} {vendedor.cuentas === 1 ? "cuenta" : "cuentas"} · {vendedor.facturas}{" "}
          {vendedor.facturas === 1 ? "factura" : "facturas"}
        </span>
        <MontosVendedor vendedor={vendedor} />
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-line p-4">
          {vendedor.detalle.map((c) => (
            <BloqueCuenta key={c.cuenta} cuenta={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function ContadoSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-card" />
      ))}
    </div>
  );
}

interface ContadoPanelProps {
  vendNro?: number;
  minUsd?: number;
  /** La solapa está visible: sin esto la query no se dispara. */
  activa: boolean;
}

/** Solapa "Contado": facturas de contado impagas (vencidas y a vencer), vendedor → cuenta → factura. */
export function ContadoPanel({ vendNro, minUsd, activa }: ContadoPanelProps) {
  const consulta = useContado({ vendNro, minUsd }, activa);

  if (consulta.isError) return <ErrorState error={consulta.error} onRetry={() => void consulta.refetch()} />;
  if (consulta.isPending) return <ContadoSkeleton />;

  const datos = consulta.data;
  if (datos.vendedores.length === 0) {
    return <EmptyState mensaje="No hay facturas de contado impagas con esos filtros." />;
  }

  const { totales } = datos;
  const exportar = () => {
    void exportToXlsx(specExport(datos)).catch(() => toast.error("No se pudo generar el Excel."));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-ink-soft">
            Contado impago al {fecha(datos.corte)} · <span className="font-semibold text-ink">{totales.facturas}</span>{" "}
            facturas en <span className="font-semibold text-ink">{totales.cuentas}</span> cuentas de{" "}
            <span className="font-semibold text-ink">{totales.vendedores}</span> vendedores
          </p>
          <p className="text-sm">
            <span className={totales.montoVencido > 0 ? "font-semibold text-rojo" : "text-ink-soft"}>
              Vencido {usd(totales.montoVencido)}
            </span>{" "}
            · A vencer <span className="font-semibold text-ink">{usd(totales.montoAVencer)}</span> · Total{" "}
            <span className="font-semibold text-ink">{usd(totales.monto)}</span>
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="no-print" onClick={exportar}>
          <Download className="size-4" /> Excel
        </Button>
      </div>

      <p className="text-xs text-ink-soft">{AVISO}</p>

      <div className="space-y-3">
        {datos.vendedores.map((v) => (
          <BloqueVendedor key={v.vendNro} vendedor={v} />
        ))}
      </div>
    </div>
  );
}
