import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/shared/components/data-table";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { importe, monedaLabel } from "../format";
import type { Agrupacion, FilaResumen, ResumenPrestamos } from "../types";

interface Props {
  datos: ResumenPrestamos | undefined;
  agrupacion: Agrupacion;
  onAgrupacionChange: (a: Agrupacion) => void;
  cargando: boolean;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Rótulo de la columna. La clave del backend es ordenable (`yyyy-MM` / `yyyy-MM-dd`); acá se pasa
 * a algo legible sin construir un `Date`, que en una clave sin hora se interpreta como UTC y
 * puede correr el mes un día.
 */
function etiqueta(periodo: string): string {
  const [anio, mes, dia] = periodo.split("-");
  if (dia === undefined) return `${MESES[Number(mes) - 1]} ${anio}`;
  return `${dia}/${mes}/${anio.slice(2)}`;
}

/**
 * La matriz banco × período: cuánto hay que pagarle a cada banco y cuándo.
 *
 * Es el reemplazo de la tabla dinámica del Excel, con la diferencia que motivó todo el módulo:
 * la calcula el backend sobre el mismo calendario que alimenta la grilla, así que no puede quedar
 * desactualizada respecto de la planilla — que es lo que le pasaba al Excel.
 */
export function ResumenMatriz({ datos, agrupacion, onAgrupacionChange, cargando }: Props) {
  const filtro = (
    <FilterBar>
      <FilterField label="Agrupar por">
        <Select
          value={agrupacion}
          onChange={(e) => onAgrupacionChange(e.target.value as Agrupacion)}
        >
          <option value="mes">Mes</option>
          <option value="fecha">Fecha exacta</option>
        </Select>
      </FilterField>
    </FilterBar>
  );

  if (cargando || !datos) {
    return (
      <div className="space-y-3">
        {filtro}
        <div className="rounded-card border border-line bg-panel p-8 text-center text-ink-soft">
          Calculando el resumen…
        </div>
      </div>
    );
  }

  if (datos.filas.length === 0) {
    return (
      <div className="space-y-3">
        {filtro}
        <div className="rounded-card border border-line bg-panel p-8 text-center text-ink-soft">
          No hay vencimientos para mostrar con estos filtros.
        </div>
      </div>
    );
  }

  const simbolo = monedaLabel(datos.moneda);

  const columns: Column<FilaResumen>[] = [
    { key: "banco", header: "Banco", cell: (f) => f.banco, className: "font-medium" },
    ...datos.periodos.map((p, i) => ({
      key: p,
      header: etiqueta(p),
      align: "right" as const,
      className: "whitespace-nowrap",
      // El cero se deja en blanco: una grilla de ceros esconde dónde está la plata.
      cell: (f: FilaResumen) => (f.montos[i] === 0 ? "" : importe(f.montos[i])),
    })),
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "font-semibold",
      cell: (f) => importe(f.total),
    },
  ];

  return (
    <div className="space-y-3">
      {filtro}

      <p className="text-xs text-ink-soft">
        Importes en <strong>{simbolo}</strong>. Sale del mismo calendario que la pestaña
        Vencimientos: los totales no pueden diferir.
      </p>

      <DataTable
        columns={columns}
        rows={datos.filas}
        getRowKey={(f) => f.banco}
        footer={[
          "Total general",
          ...datos.totalesPorPeriodo.map((t) => importe(t)),
          importe(datos.totalGeneral),
        ]}
      />
    </div>
  );
}
