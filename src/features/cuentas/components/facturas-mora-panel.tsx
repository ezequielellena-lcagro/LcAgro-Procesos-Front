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
import { useFacturasEnMora } from "../queries/use-facturas-en-mora";
import type { CuentaMora, FacturaMora, FacturasEnMora, VendedorMora } from "../types";

const AVISO =
  "El pendiente por factura es informativo: canje/LSG bajan el saldo global sin imputarse a la factura, " +
  "así que una factura puede figurar en mora aunque la cuenta ya esté saldada — manda el saldo total.";

/** Fila plana del Excel: una por factura, con su cuenta y vendedor repetidos. */
interface FilaExportMora {
  vendedor: string;
  cuenta: number;
  denominacion: string;
  saldoCuenta: number;
  factura: FacturaMora;
}

function filasPlanas(datos: FacturasEnMora): FilaExportMora[] {
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

const COLUMNAS_EXPORT: ExportColumn<FilaExportMora>[] = [
  { header: "Vendedor", get: (r) => r.vendedor },
  { header: "Cuenta", get: (r) => r.cuenta },
  { header: "Cliente", get: (r) => r.denominacion },
  { header: "Comprobante", get: (r) => r.factura.comprobante },
  { header: "Emisión", get: (r) => fecha(r.factura.emision) },
  { header: "Vencimiento", get: (r) => fecha(r.factura.vencimiento) },
  { header: "Plazo (días)", get: (r) => r.factura.plazoDias, format: "number" },
  { header: "Días atraso", get: (r) => r.factura.diasAtraso, format: "number" },
  { header: "Importe (USD)", get: (r) => r.factura.importe, format: "usd", total: true },
  { header: "Pendiente (USD)", get: (r) => r.factura.pendiente, format: "usd", total: true },
  { header: "Saldo total cuenta (USD)", get: (r) => r.saldoCuenta, format: "usd" },
];

function specExport(datos: FacturasEnMora): ExportSpec<FilaExportMora> {
  return {
    filename: `Facturas_En_Mora_${datos.corte.replace(/-/g, "")}`,
    title: "Facturas en mora",
    subtitle: `Corte ${fecha(datos.corte)}`,
    columns: COLUMNAS_EXPORT,
    rows: filasPlanas(datos),
  };
}

const COLUMNAS_FACTURAS: Column<FacturaMora>[] = [
  {
    key: "comprobante",
    header: "Comprobante",
    cell: (f) => <span className="font-medium text-ink">{f.comprobante}</span>,
  },
  { key: "emision", header: "Emisión", cell: (f) => fecha(f.emision) },
  { key: "vencimiento", header: "Vencimiento", cell: (f) => fecha(f.vencimiento) },
  { key: "plazo", header: "Plazo", align: "right", cell: (f) => `${f.plazoDias} d` },
  {
    key: "atraso",
    header: "Días de atraso",
    align: "right",
    cell: (f) => <span className="font-medium text-rojo">{f.diasAtraso}</span>,
  },
  { key: "importe", header: "Importe", align: "right", cell: (f) => usd(f.importe) },
  {
    key: "pendiente",
    header: "Pendiente",
    align: "right",
    cell: (f) => <span className="font-semibold text-ink">{usd(f.pendiente)}</span>,
  },
];

/** Un dato del saldo global de la cuenta. */
function DatoSaldo({ label, valor, className }: { label: string; valor: number; className?: string }) {
  return (
    <div className="px-3 py-1.5 text-right">
      <dt className="text-[0.7rem] uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className={cn("tabular text-sm", className)}>{usd(valor)}</dd>
    </div>
  );
}

/**
 * Saldo GLOBAL de la cuenta (todos sus movimientos). Es el ancla de conciliación: si es menor que
 * la mora, la diferencia se pagó por canje/LSG sin imputarse a las facturas.
 */
function SaldoGlobal({ cuenta }: { cuenta: CuentaMora }) {
  return (
    <dl
      className="flex divide-x divide-line rounded-card border border-line bg-panel"
      title="Saldo global de la cuenta (todos sus movimientos, no solo las facturas de contado)."
    >
      <DatoSaldo
        label="Vencido"
        valor={cuenta.saldoVencido}
        className={cuenta.saldoVencido > 0 ? "font-medium text-rojo" : "text-ink"}
      />
      <DatoSaldo label="A vencer" valor={cuenta.saldoAVencer} className="text-ink" />
      <DatoSaldo
        label="Saldo total"
        valor={cuenta.saldo}
        className={cn("font-semibold", cuenta.saldo <= 0 ? "text-verde" : "text-ink")}
      />
    </dl>
  );
}

function BloqueCuenta({ cuenta }: { cuenta: CuentaMora }) {
  const totalImporte = cuenta.facturas.reduce((s, f) => s + f.importe, 0);
  // El saldo global por debajo de la mora es el caso "saldada por canje/LSG": se avisa, no es un error.
  const saldadaPorCanje = cuenta.saldo < cuenta.monto;

  return (
    <article className="rounded-card border border-line bg-panel-soft/40 p-3">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">
            {cuenta.cuenta} — {cuenta.denominacion}
          </p>
          <p className="text-xs text-ink-soft">
            {cuenta.facturas.length} {cuenta.facturas.length === 1 ? "factura" : "facturas"} en mora ·{" "}
            <span className="font-semibold text-rojo">{usd(cuenta.monto)}</span>
          </p>
          {saldadaPorCanje && (
            <p className="mt-1 text-xs text-ink-soft">
              El saldo global es menor que la mora (canje/LSG): manda el saldo total.
            </p>
          )}
        </div>
        <SaldoGlobal cuenta={cuenta} />
      </header>

      <DataTable
        columns={COLUMNAS_FACTURAS}
        rows={cuenta.facturas}
        getRowKey={(f) => f.comprobante}
        footer={["TOTAL", "", "", "", "", usd(totalImporte), usd(cuenta.monto)]}
      />
    </article>
  );
}

function BloqueVendedor({ vendedor }: { vendedor: VendedorMora }) {
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
        <span className="ml-auto tabular font-semibold text-rojo">{usd(vendedor.monto)}</span>
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

function MoraSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-card" />
      ))}
    </div>
  );
}

interface FacturasMoraPanelProps {
  vendNro?: number;
  minUsd?: number;
  /** La solapa está visible: sin esto la query no se dispara. */
  activa: boolean;
}

/** Solapa "Facturas en mora": facturas de contado vencidas, agrupadas vendedor → cuenta → factura. */
export function FacturasMoraPanel({ vendNro, minUsd, activa }: FacturasMoraPanelProps) {
  const consulta = useFacturasEnMora({ vendNro, minUsd }, activa);

  if (consulta.isError) return <ErrorState error={consulta.error} onRetry={() => void consulta.refetch()} />;
  if (consulta.isPending) return <MoraSkeleton />;

  const datos = consulta.data;
  if (datos.vendedores.length === 0) {
    return <EmptyState mensaje="No hay facturas de contado en mora con esos filtros." />;
  }

  const exportar = () => {
    void exportToXlsx(specExport(datos)).catch(() => toast.error("No se pudo generar el Excel."));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Corte {fecha(datos.corte)} · <span className="font-semibold text-ink">{datos.totales.facturas}</span> facturas
          en <span className="font-semibold text-ink">{datos.totales.cuentas}</span> cuentas de{" "}
          <span className="font-semibold text-ink">{datos.totales.vendedores}</span> vendedores ·{" "}
          <span className="font-semibold text-rojo">{usd(datos.totales.monto)}</span>
        </p>
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
