import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha, oDash, pct, usd } from "@/shared/format/format";
import type { ComisionDetalleDto } from "../types";

/**
 * Tinta el contenido de la celda cuando la venta no tiene vendedor asignado, simulando una "fila
 * destacada" sin tener que agregarle soporte de clases por fila al <DataTable> compartido (que solo
 * admite clases fijas por columna). El -mx-3 -my-2 + px-3 py-2 hace que el tinte llene el mismo
 * padding que ya usa <DataTable> en cada <td>.
 */
function celda(row: ComisionDetalleDto, content: ReactNode): ReactNode {
  if (!row.sinVendedor) return content;
  return <span className="-mx-3 -my-2 block bg-clementina/15 px-3 py-2">{content}</span>;
}

export function ComisionesTable({ filas }: { filas: ComisionDetalleDto[] }) {
  const columns: Column<ComisionDetalleDto>[] = [
    {
      key: "fecha",
      header: "Fecha",
      className: "whitespace-nowrap",
      cell: (r) => celda(r, fecha(r.fecha)),
    },
    {
      key: "comprobante",
      header: "Comprobante",
      className: "whitespace-nowrap",
      cell: (r) => celda(r, r.comprobante),
    },
    {
      key: "cliente",
      header: "Cliente",
      className: "max-w-[16rem]",
      cell: (r) =>
        celda(
          r,
          <span className="block truncate font-medium text-ink" title={r.razonSocial ?? undefined}>
            {r.razonSocial ?? "—"}
          </span>,
        ),
    },
    {
      key: "producto",
      header: "Producto",
      className: "max-w-[16rem]",
      cell: (r) =>
        celda(
          r,
          <span className="block truncate" title={r.producto}>
            {r.producto}
          </span>,
        ),
    },
    {
      key: "rubro",
      header: "Rubro",
      align: "right",
      cell: (r) => celda(r, r.rubro),
    },
    {
      key: "vendedor",
      header: "Vendedor",
      className: "whitespace-nowrap",
      cell: (r) =>
        celda(
          r,
          <span className="flex items-center gap-1.5">
            {r.vendedor}
            {r.sinVendedor && (
              <span className="inline-flex rounded-full bg-rojo-bg px-2 py-0.5 text-xs font-medium text-rojo">
                SIN VENDEDOR
              </span>
            )}
          </span>,
        ),
    },
    { key: "cantidad", header: "Cant.", align: "right", cell: (r) => celda(r, r.cantidad) },
    {
      key: "precioUnitario",
      header: "Precio unit.",
      align: "right",
      className: "whitespace-nowrap",
      cell: (r) => celda(r, usd(r.precioUnitario)),
    },
    {
      key: "costoUnitario",
      header: "Costo unit.",
      align: "right",
      className: "whitespace-nowrap",
      cell: (r) =>
        celda(
          r,
          <span className={cn(r.alertaCostoCero && "font-medium text-clementina-deep")}>
            {usd(r.costoUnitario)}
          </span>,
        ),
    },
    {
      key: "factNeta",
      header: "FactNeta",
      align: "right",
      className: "whitespace-nowrap",
      cell: (r) => celda(r, usd(r.factNeta)),
    },
    {
      key: "rentabilidad",
      header: "Rentabilidad",
      align: "right",
      className: "whitespace-nowrap",
      cell: (r) =>
        celda(
          r,
          <span className={cn(r.alertaMargenNegativo && "font-medium text-rojo")}>{usd(r.rentabilidad)}</span>,
        ),
    },
    {
      key: "margenBrutoPct",
      header: "Margen %",
      align: "right",
      cell: (r) =>
        celda(
          r,
          <span className={cn(r.alertaMargenNegativo && "font-medium text-rojo")}>
            {oDash(r.margenBrutoPct, pct)}
          </span>,
        ),
    },
    {
      key: "porcentajeComision",
      header: "% Comisión",
      align: "right",
      cell: (r) =>
        celda(
          r,
          r.alertaComisionCero ? (
            <span className="text-ink-soft">—</span>
          ) : (
            <span className="inline-flex items-center justify-end gap-1">
              {pct(r.porcentajeComision)}
              {r.alertaMontoFijo && (
                <span title="Tiene monto fijo en MacroGest — a revisar">
                  <AlertTriangle className="size-3.5 shrink-0 text-clementina-deep" aria-hidden="true" />
                </span>
              )}
            </span>
          ),
        ),
    },
    {
      key: "comision",
      header: "Comisión",
      align: "right",
      className: "whitespace-nowrap",
      cell: (r) => celda(r, <span className="font-semibold text-ink">{usd(r.comision)}</span>),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={filas}
      getRowKey={(r) => `${r.comprobante}-${r.codigoArticulo}-${r.vendedorNro}`}
      empty="No hay comisiones con esos filtros."
    />
  );
}
