import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha, oDash, pct } from "@/shared/format/format";
import { importe, monedaLabel } from "../format";
import type { VencimientoDto, VencimientosDto } from "../types";

interface Props {
  datos: VencimientosDto;
  onPagar: (cuotaId: number) => void;
  puedeGestionar: boolean;
}

/**
 * El calendario de vencimientos: una fila por cuota. Es el reemplazo directo de la hoja
 * "LA CLEMENTINA" del Excel, con dos diferencias que importan:
 * - los totales del pie los calcula el backend sobre TODO lo filtrado (en el Excel la hoja maestra
 *   y las dinámicas daban números distintos porque se cargaban por separado);
 * - la cuota pagada no desaparece: queda con su fecha.
 */
export function VencimientosTable({ datos, onPagar, puedeGestionar }: Props) {
  const columns: Column<VencimientoDto>[] = [
    {
      key: "fecha",
      header: "Vencimiento",
      cell: (v) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {v.vencida && (
            <AlertTriangle
              className="size-3.5 shrink-0 text-rojo"
              aria-hidden="true"
              // El title va acá (y no en la fila) para que el lector de pantalla lo asocie al ícono.
            />
          )}
          {v.vencida && <span className="sr-only" title="Vencida e impaga" />}
          <span className={v.vencida ? "font-semibold text-rojo" : undefined}>
            {fecha(v.fechaVencimiento)}
          </span>
        </span>
      ),
    },
    { key: "banco", header: "Banco", cell: (v) => v.banco },
    { key: "sucursal", header: "Sucursal", cell: (v) => v.sucursal ?? "—" },
    { key: "linea", header: "Línea", cell: (v) => v.linea },
    {
      key: "operacion",
      header: "N° operación",
      cell: (v) => v.nroOperacion ?? "—",
      className: "whitespace-nowrap",
    },
    {
      key: "cuota",
      header: "Cuota",
      align: "center",
      // "1/10" es el dato que el Excel no podía dar: ahí cada vencimiento era una fila suelta.
      cell: (v) => `${v.nroCuota}/${v.cantidadCuotas}`,
    },
    { key: "capital", header: "Capital", align: "right", cell: (v) => importe(v.capital) },
    { key: "interes", header: "Interés", align: "right", cell: (v) => importe(v.interes) },
    { key: "iva", header: "IVA", align: "right", cell: (v) => importe(v.iva) },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (v) => <span className="font-semibold">{importe(v.total)}</span>,
    },
    {
      key: "tna",
      header: "TNA",
      align: "right",
      cell: (v) => oDash(v.tasaNominalAnual, pct),
    },
    {
      key: "estado",
      header: "",
      align: "right",
      cell: (v) =>
        v.estado === "Pagada" ? (
          <span className="text-xs font-medium text-verde">Pagada</span>
        ) : puedeGestionar ? (
          <Button variant="outline" size="sm" onClick={() => onPagar(v.cuotaId)}>
            Pagar
          </Button>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={datos.items}
      getRowKey={(v) => v.cuotaId}
      empty="No hay vencimientos con esos filtros."
      footer={[
        <span key="t" className="font-semibold">
          TOTAL {monedaLabel(datos.moneda)}
        </span>,
        "",
        "",
        "",
        "",
        "",
        <span key="c" className="font-semibold">
          {importe(datos.totalCapital)}
        </span>,
        <span key="i" className="font-semibold">
          {importe(datos.totalInteres)}
        </span>,
        <span key="v" className="font-semibold">
          {importe(datos.totalIva)}
        </span>,
        <span key="tt" className="font-semibold">
          {importe(datos.totalTotal)}
        </span>,
        "",
        "",
      ]}
    />
  );
}
