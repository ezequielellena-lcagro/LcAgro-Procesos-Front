import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha, oDash, pct } from "@/shared/format/format";
import { importe } from "../format";
import type { PrestamoListadoDto } from "../types";

interface Props {
  filas: PrestamoListadoDto[];
  onEditar: (id: number) => void;
  onVer: (id: number) => void;
  puedeGestionar: boolean;
}

/**
 * Una fila por OPERACIÓN. Es la vista que el Excel perdió cuando dejó de mantenerse la hoja
 * "dEUDA BANCARIA" (2016): responde "cuánto me queda de este préstamo" y "por qué cuota voy",
 * que con vencimientos sueltos había que sacar a mano.
 */
export function OperacionesTable({ filas, onEditar, onVer, puedeGestionar }: Props) {
  const columns: Column<PrestamoListadoDto>[] = [
    { key: "banco", header: "Banco", cell: (p) => p.banco, sortBy: (p) => p.banco },
    { key: "sucursal", header: "Sucursal", cell: (p) => p.sucursal ?? "—", sortBy: (p) => p.sucursal },
    { key: "linea", header: "Línea", cell: (p) => p.linea, sortBy: (p) => p.linea },
    {
      key: "operacion",
      header: "N° operación",
      cell: (p) => p.nroOperacion ?? "—",
      className: "whitespace-nowrap",
      sortBy: (p) => p.nroOperacion,
    },
    {
      key: "otorgamiento",
      header: "Otorgado",
      cell: (p) => oDash(p.fechaOtorgamiento, fecha),
      className: "whitespace-nowrap",
      sortBy: (p) => p.fechaOtorgamiento,
    },
    {
      key: "capitalOriginal",
      header: "Capital original",
      align: "right",
      cell: (p) => oDash(p.capitalOriginal, importe),
      sortBy: (p) => p.capitalOriginal,
    },
    {
      key: "cuotas",
      header: "Cuotas",
      align: "center",
      // Formato "03/08", igual que el informe viejo de deuda bancaria.
      cell: (p) =>
        `${String(p.cuotasPagadas).padStart(2, "0")}/${String(p.cantidadCuotas).padStart(2, "0")}`,
      // Por lo que falta pagar, que es la lectura útil: "quién está más cerca de terminar".
      sortBy: (p) => p.cantidadCuotas - p.cuotasPagadas,
    },
    { key: "tna", header: "TNA", align: "right", cell: (p) => oDash(p.tasaNominalAnual, pct), sortBy: (p) => p.tasaNominalAnual },
    {
      key: "saldo",
      header: "Saldo",
      align: "right",
      cell: (p) => <span className="font-semibold">{importe(p.saldoTotal)}</span>,
      sortBy: (p) => p.saldoTotal,
    },
    {
      key: "proximo",
      header: "Próximo vto.",
      cell: (p) => oDash(p.proximoVencimiento, fecha),
      className: "whitespace-nowrap",
      sortBy: (p) => p.proximoVencimiento,
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onVer(p.id)}>
            Ver
          </Button>
          {puedeGestionar && (
            <Button variant="outline" size="sm" onClick={() => onEditar(p.id)}>
              Editar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={filas}
      getRowKey={(p) => p.id}
      empty="No hay operaciones con esos filtros."
    />
  );
}
