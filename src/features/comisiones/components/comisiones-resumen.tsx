import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { oDash, pct, usd } from "@/shared/format/format";
import type { ComisionResumenDto, ComisionVendedorResumenDto } from "../types";
import { MesCongeladoBadge } from "./mes-congelado-badge";

/** Panel de resumen por vendedor del período + fila TOTAL GENERAL (molde de CuentasSubtotales). */
export function ComisionesResumen({ resumen }: { resumen: ComisionResumenDto }) {
  const filas = [...resumen.vendedores].sort((a, b) => b.factNeta - a.factNeta);

  const columns: Column<ComisionVendedorResumenDto>[] = [
    {
      key: "vendedor",
      header: "Vendedor",
      cell: (r) => <span className="font-medium text-ink">{r.vendedor}</span>,
    },
    { key: "factNeta", header: "FactNeta", align: "right", cell: (r) => usd(r.factNeta) },
    {
      key: "rentabilidad",
      header: "Rentabilidad",
      align: "right",
      cell: (r) => (
        <span className={cn(r.rentabilidad < 0 && "font-medium text-rojo")}>{usd(r.rentabilidad)}</span>
      ),
    },
    {
      key: "margenBrutoPct",
      header: "Margen %",
      align: "right",
      cell: (r) => (
        <span className={cn(r.margenBrutoPct != null && r.margenBrutoPct < 0 && "font-medium text-rojo")}>
          {oDash(r.margenBrutoPct, pct)}
        </span>
      ),
    },
    {
      key: "comision",
      header: "Comisión",
      align: "right",
      cell: (r) => <span className="font-semibold text-ink">{usd(r.comision)}</span>,
    },
    { key: "cantComprobantes", header: "Comprobantes", align: "right", cell: (r) => r.cantComprobantes },
  ];

  const footer = [
    "TOTAL GENERAL",
    usd(resumen.totalFactNeta),
    usd(resumen.totalRentabilidad),
    oDash(resumen.totalMargenBrutoPct, pct),
    usd(resumen.totalComision),
    resumen.totalComprobantes,
  ];

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Resumen por vendedor</h2>
        {resumen.generado && <MesCongeladoBadge />}
      </div>
      <DataTable
        columns={columns}
        rows={filas}
        getRowKey={(r) => r.vendedorNro}
        footer={footer}
        empty="No hay comisiones para este período."
      />
      {resumen.sinVendedorComprobantes > 0 && (
        <p className="text-xs text-ink-soft">
          Sin vendedor: {usd(resumen.sinVendedorFactNeta)} ({resumen.sinVendedorComprobantes} comp.)
        </p>
      )}
    </section>
  );
}
