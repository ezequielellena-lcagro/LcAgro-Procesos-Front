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
    { key: "vendedor", header: "Vendedor", cell: (r) => <span className="text-ink-soft">{r.vendedor}</span> },
    { key: "cuenta", header: "Cuenta", align: "right", cell: (r) => r.cuenta },
    { key: "denominacion", header: "Cliente", cell: (r) => <span className="font-medium text-ink">{r.denominacion}</span> },
    {
      key: "saldoVencido",
      header: "Vencido",
      align: "right",
      cell: (r) => <span className={cn(r.saldoVencido > 0 && "font-medium text-rojo")}>{usd(r.saldoVencido)}</span>,
    },
    { key: "saldoAVencer", header: "A vencer", align: "right", cell: (r) => usd(r.saldoAVencer) },
    { key: "saldo", header: "Saldo", align: "right", cell: (r) => <span className="font-semibold text-ink">{usd(r.saldo)}</span> },
    { key: "devolucion", header: "Devolución", cell: (r) => r.devolucion ?? <span className="text-ink-soft">—</span> },
    { key: "observaciones", header: "Observaciones", cell: (r) => r.observaciones ?? <span className="text-ink-soft">—</span> },
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
