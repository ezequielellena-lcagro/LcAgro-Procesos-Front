import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { usd } from "@/shared/format/format";
import type { CuentaDto } from "../types";

export function CuentasTable({
  filas,
  puedeEditar,
  onEditar,
}: {
  filas: CuentaDto[];
  puedeEditar: boolean;
  onEditar: (c: CuentaDto) => void;
}) {
  const columns: Column<CuentaDto>[] = [
    {
      key: "vendedor",
      header: "Vendedor",
      className: "whitespace-nowrap",
      cell: (r) => <span className="text-ink-soft">{r.vendedor}</span>,
    },
    { key: "cuenta", header: "Cuenta", align: "right", cell: (r) => r.cuenta },
    {
      key: "denominacion",
      header: "Cliente",
      className: "max-w-[16rem]",
      cell: (r) => (
        <span className="block truncate font-medium text-ink" title={r.denominacion}>
          {r.denominacion}
        </span>
      ),
    },
    {
      key: "saldoVencido",
      header: "Vencido",
      align: "right",
      className: "whitespace-nowrap",
      cell: (r) => <span className={cn(r.saldoVencido > 0 && "font-medium text-rojo")}>{usd(r.saldoVencido)}</span>,
    },
    { key: "saldoAVencer", header: "A vencer", align: "right", className: "whitespace-nowrap", cell: (r) => usd(r.saldoAVencer) },
    {
      key: "saldo",
      header: "Saldo",
      align: "right",
      className: "whitespace-nowrap",
      cell: (r) => <span className="font-semibold text-ink">{usd(r.saldo)}</span>,
    },
    {
      key: "devolucion",
      header: "Devolución",
      className: "max-w-[14rem]",
      cell: (r) =>
        r.devolucion ? (
          <span className="block truncate" title={r.devolucion}>
            {r.devolucion}
          </span>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
    {
      key: "observaciones",
      header: "Observaciones",
      className: "max-w-[12rem]",
      cell: (r) =>
        r.observaciones ? (
          <span className="block truncate" title={r.observaciones}>
            {r.observaciones}
          </span>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
  ];

  if (puedeEditar) {
    columns.push({
      key: "acciones",
      header: "",
      align: "right",
      cell: (r) => (
        <Button type="button" variant="ghost" size="icon" aria-label="Editar observación" onClick={() => onEditar(r)}>
          <Pencil className="size-4" />
        </Button>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={filas}
      getRowKey={(r) => r.cuenta}
      empty="No hay cuentas con esos filtros."
    />
  );
}
