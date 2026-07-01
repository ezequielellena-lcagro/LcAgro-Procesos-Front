import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { usd } from "@/shared/format/format";
import type { SubtotalVendedor, TotalesCuentas } from "../types";

/** Tabla de totales por vendedor + total general (sobre todo el set filtrado). */
export function CuentasSubtotales({
  subtotales,
  totales,
}: {
  subtotales: SubtotalVendedor[];
  totales: TotalesCuentas;
}) {
  const columns: Column<SubtotalVendedor>[] = [
    { key: "vendedor", header: "Vendedor", cell: (r) => <span className="font-medium text-ink">{r.vendedor}</span> },
    { key: "cuentas", header: "Cuentas", align: "right", cell: (r) => r.cuentas },
    {
      key: "vencido",
      header: "Vencido",
      align: "right",
      cell: (r) => <span className={cn(r.vencido > 0 && "font-medium text-rojo")}>{usd(r.vencido)}</span>,
    },
    { key: "aVencer", header: "A vencer", align: "right", cell: (r) => usd(r.aVencer) },
    {
      key: "saldo",
      header: "Saldo",
      align: "right",
      cell: (r) => <span className="font-semibold text-ink">{usd(r.saldo)}</span>,
    },
  ];

  const footer = [
    "TOTAL GENERAL",
    totales.cuentas,
    usd(totales.vencido),
    usd(totales.aVencer),
    usd(totales.saldo),
  ];

  return (
    <DataTable columns={columns} rows={subtotales} getRowKey={(r) => r.vendNro} footer={footer} />
  );
}
