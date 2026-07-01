import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { numero, oDash, usd } from "@/shared/format/format";
import type { PosicionDto } from "../types";

// Vista simple, centrada en toneladas y posición neta (sin calzadas/margen, a pedido del negocio).
const columns: Column<PosicionDto>[] = [
  { key: "cereal", header: "Cereal", className: "whitespace-nowrap", cell: (r) => <span className="font-medium text-ink">{r.cereal}</span> },
  { key: "tnCompra", header: "Compra tn", align: "right", className: "whitespace-nowrap", cell: (r) => numero(r.tnCompra) },
  { key: "precioCompra", header: "P. compra", align: "right", className: "whitespace-nowrap", cell: (r) => oDash(r.precioCompra, usd) },
  { key: "tnVenta", header: "Venta tn", align: "right", className: "whitespace-nowrap", cell: (r) => numero(r.tnVenta) },
  { key: "precioVenta", header: "P. venta", align: "right", className: "whitespace-nowrap", cell: (r) => oDash(r.precioVenta, usd) },
  {
    key: "posicionFinal",
    header: "Posición tn",
    align: "right",
    className: "whitespace-nowrap",
    cell: (r) => (
      <span className={cn("font-semibold", r.posicionFinal >= 0 ? "text-verde" : "text-rojo")}>
        {numero(r.posicionFinal)}
      </span>
    ),
  },
];

export function PosicionTable({ filas }: { filas: PosicionDto[] }) {
  const suma = (get: (r: PosicionDto) => number) => filas.reduce((s, r) => s + get(r), 0);
  const totalPosicion = suma((r) => r.posicionFinal);

  // Fila de totales (una celda por columna; en precios no tiene sentido sumar → vacío).
  const footer = [
    "TOTAL",
    numero(suma((r) => r.tnCompra)),
    "",
    numero(suma((r) => r.tnVenta)),
    "",
    <span className={cn(totalPosicion >= 0 ? "text-verde" : "text-rojo")}>{numero(totalPosicion)}</span>,
  ];

  return (
    <DataTable
      columns={columns}
      rows={filas}
      getRowKey={(r) => `${r.campania}-${r.cereal}`}
      empty="No hay posición para estos filtros."
      footer={footer}
    />
  );
}
