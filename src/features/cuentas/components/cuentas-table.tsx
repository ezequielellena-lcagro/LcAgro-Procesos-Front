import { ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { usd } from "@/shared/format/format";
import type { CuentaDto } from "../types";
import { EstadoContadoSemaforo } from "./estado-contado-badge";

export function CuentasTable({
  filas,
  puedeEditar,
  onEditar,
  onVerFacturas,
}: {
  filas: CuentaDto[];
  puedeEditar: boolean;
  onEditar: (c: CuentaDto) => void;
  onVerFacturas: (c: CuentaDto) => void;
}) {
  const contadoColumn: Column<CuentaDto> = {
    key: "contado",
    header: "Contado",
    align: "center",
    cell: (r) => (
      <button
        type="button"
        onClick={() => onVerFacturas(r)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-ink-soft hover:bg-panel-soft hover:text-ink"
        aria-label={`Ver facturas de contado de la cuenta ${r.cuenta}`}
        title="Ver facturas de contado"
      >
        <EstadoContadoSemaforo estado={r.estadoContado} />
        <ChevronRight className="size-3.5" />
      </button>
    ),
  };

  const base: Column<CuentaDto>[] = [
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

  // "Contado" va siempre al final (última columna de datos, antes del botón de editar).
  const columns: Column<CuentaDto>[] = [...base, contadoColumn];

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
