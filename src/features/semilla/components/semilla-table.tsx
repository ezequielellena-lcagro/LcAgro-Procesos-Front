import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha, numero } from "@/shared/format/format";
import type { VentaSemillaDto } from "../types";

function SinMapear() {
  return (
    <span className="inline-flex items-center rounded-full bg-clementina/20 px-2 py-0.5 text-xs font-medium text-clementina-deep">
      Sin mapear
    </span>
  );
}

/** Grilla de ventas del mes en formato Sembra. Las filas sin mapeo marcan su variedad en ámbar. */
export function SemillaTable({ filas }: { filas: VentaSemillaDto[] }) {
  const columns: Column<VentaSemillaDto>[] = [
    { key: "fecha", header: "Fecha", cell: (r) => fecha(r.fechaComprobante) },
    { key: "tipo", header: "Tipo", cell: (r) => r.tipoComprobante },
    { key: "numero", header: "N°", align: "right", cell: (r) => r.numeroComprobante },
    { key: "linea", header: "Línea", align: "right", cell: (r) => r.lineaComprobante },
    {
      key: "cliente",
      header: "Destinatario",
      cell: (r) => <span className="font-medium text-ink">{r.razonSocialDestinatario || "—"}</span>,
    },
    {
      key: "cuit",
      header: "CUIT",
      cell: (r) => <span className="tabular text-ink-soft">{r.cuitDestinatario || "—"}</span>,
    },
    {
      key: "articulo",
      header: "Artículo (MacroGest)",
      cell: (r) => <span className="text-ink-soft">{r.nombreArticuloMacroGest}</span>,
    },
    {
      key: "variedad",
      header: "Variedad",
      cell: (r) => (r.requiereMapeo ? <SinMapear /> : <span className="font-medium text-ink">{r.variedad}</span>),
    },
    {
      key: "categoria",
      header: "Categoría",
      cell: (r) => (r.requiereMapeo ? <span className="text-ink-soft">—</span> : r.categoria),
    },
    {
      key: "kilos",
      header: "Kilos",
      align: "right",
      cell: (r) => <span className="font-semibold text-ink">{numero(r.kilosTotales)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={filas}
      getRowKey={(r, i) => `${r.tipoComprobante}-${r.numeroComprobante}-${r.lineaComprobante}-${i}`}
      empty="No hay ventas de semilla para este mes y cultivo."
    />
  );
}
