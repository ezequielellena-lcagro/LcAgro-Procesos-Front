import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { numero, oDash, pct, usd } from "@/shared/format/format";
import type { PosicionDto } from "../types";

const columns: Column<PosicionDto>[] = [
  { key: "cereal", header: "Cereal", cell: (r) => <span className="font-medium text-ink">{r.cereal}</span> },
  { key: "tnCompra", header: "Compra tn", align: "right", cell: (r) => numero(r.tnCompra) },
  { key: "precioCompra", header: "P. compra", align: "right", cell: (r) => oDash(r.precioCompra, usd) },
  { key: "tnVenta", header: "Venta tn", align: "right", cell: (r) => numero(r.tnVenta) },
  { key: "precioVenta", header: "P. venta", align: "right", cell: (r) => oDash(r.precioVenta, usd) },
  { key: "tnCalzadas", header: "Calzadas", align: "right", cell: (r) => numero(r.tnCalzadas) },
  { key: "margenUsdTn", header: "Margen US$/tn", align: "right", cell: (r) => oDash(r.margenUsdTn, usd) },
  { key: "margenPct", header: "Margen %", align: "right", cell: (r) => oDash(r.margenPct, pct) },
  { key: "resultadoUsd", header: "Resultado US$", align: "right", cell: (r) => usd(r.resultadoUsd) },
  {
    key: "posicionFinal",
    header: "Posición tn",
    align: "right",
    cell: (r) => (
      <span className={cn("font-semibold", r.posicionFinal >= 0 ? "text-verde" : "text-rojo")}>
        {numero(r.posicionFinal)}
      </span>
    ),
  },
];

export function PosicionTable({ filas }: { filas: PosicionDto[] }) {
  return (
    <DataTable
      columns={columns}
      rows={filas}
      getRowKey={(r) => `${r.campania}-${r.cereal}`}
      empty="No hay posición para estos filtros."
    />
  );
}
