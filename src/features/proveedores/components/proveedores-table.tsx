import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { usd } from "@/shared/format/format";
import type { ProveedorDto, TotalesProveedores, TramoDto } from "../types";

/** Se repite en encabezado y celdas para que nadie sume el memo con los tramos. */
const MEMO_HINT = "Memo informativo: ya está contenido en el primer tramo, no suma al saldo total.";

/**
 * Calendario de pagos por proveedor. Los encabezados de los tramos son DINÁMICOS: salen de
 * `tramos` (que el backend recalcula con el mes base), nunca de constantes del front; así al mes
 * siguiente las columnas corren solas y el día que el backend agregue un horizonte la tabla lo
 * muestra sin tocar UI. `montos[i]` es posicional y va con `tramos[i]`: se itera SIEMPRE por
 * `tramos` y se indexa `montos`, nunca al revés.
 * Las ventanas son mutuamente excluyentes y suman el saldo total; "ya vencido" es un memo
 * informativo contenido en el primer tramo, por eso va separado, en gris y fuera de la suma.
 */
export function ProveedoresTable({
  filas,
  tramos,
  totales,
}: {
  filas: ProveedorDto[];
  tramos: TramoDto[];
  totales: TotalesProveedores;
}) {
  const columnasTramos: Column<ProveedorDto>[] = tramos.map((t, i) => ({
    key: `tramo-${i}`,
    header: t.etiqueta,
    align: "right",
    className: "whitespace-nowrap",
    cell: (r) => usd(r.montos[i] ?? 0),
  }));

  const columns: Column<ProveedorDto>[] = [
    { key: "numero", header: "N°", align: "right", cell: (r) => r.numero },
    {
      key: "denominacion",
      header: "Proveedor",
      className: "max-w-[18rem]",
      cell: (r) => (
        <span className="block truncate font-medium text-ink" title={r.denominacion}>
          {r.denominacion}
        </span>
      ),
    },
    ...columnasTramos,
    {
      key: "saldoTotal",
      header: "Saldo total",
      align: "right",
      className: "whitespace-nowrap",
      cell: (r) => <span className="font-semibold text-ink">{usd(r.saldoTotal)}</span>,
    },
    {
      key: "yaVencido",
      // Fuera de la suma: borde y fondo propios lo separan visualmente de las ventanas.
      header: <span title={MEMO_HINT}>Ya vencido</span>,
      align: "right",
      className: "whitespace-nowrap border-l border-line bg-panel-soft/50 italic",
      cell: (r) => (
        <span
          className={cn("text-ink-soft", r.yaVencido > 0 && "font-medium text-rojo")}
          title={MEMO_HINT}
        >
          {usd(r.yaVencido)}
        </span>
      ),
    },
  ];

  // Posicional: una celda por columna, en el mismo orden (DataTable las pega por índice).
  const footer = [
    "",
    `TOTAL (${totales.proveedores} ${totales.proveedores === 1 ? "proveedor" : "proveedores"})`,
    ...tramos.map((_, i) => usd(totales.montos[i] ?? 0)),
    usd(totales.saldoTotal),
    usd(totales.yaVencido),
  ];

  return (
    <DataTable
      columns={columns}
      rows={filas}
      getRowKey={(r) => r.numero}
      empty="No hay proveedores con esos filtros."
      footer={footer}
    />
  );
}
