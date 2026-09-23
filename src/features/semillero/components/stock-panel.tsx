import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { DataTable, type Column } from "@/shared/components/data-table";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { kg, unidades } from "../format";
import { duenioEtiqueta, envaseEtiqueta, tratamientoEtiqueta } from "../lib/etiquetas-lote";
import {
  type DuenioLote,
  type EspecieDto,
  type EspecieSemillero,
  type StockFilaDto,
  type StockFiltros,
  type StockSemilleroDto,
  type VariedadDto,
} from "../types";
import { EnvaseSelect, TratamientoSelect } from "./filtros-lote";

export type OperacionStock = "ingreso" | "ajuste" | "reubicacion";

interface Props {
  datos: StockSemilleroDto | undefined;
  cargando: boolean;
  variedades: VariedadDto[];
  especies?: EspecieDto[];
  campanias: string[];
  filtros: StockFiltros;
  onFiltros: (filtros: StockFiltros) => void;
  onNuevoLote: () => void;
  onEditarLote: (loteId: number) => void;
  onMovimiento: (operacion: OperacionStock, fila: StockFilaDto) => void;
  /** Arma una orden nueva a partir de la fila, como en SeedStock (R4). */
  onOrden: (fila: StockFilaDto) => void;
  onExcel: () => void;
  descargando: boolean;
}

const oDash = (n: number | null, sufijo = "") => (n === null ? "—" : `${unidades(n)}${sufijo}`);

/** Una orden sólo puede cargar lo que está disponible (R4.1). */
const sePuedeOrdenar = (f: StockFilaDto) => f.disponible > 0;
/** Por qué "Orden" está deshabilitado: sin este texto el botón gris no se explica. */
const motivoSinOrden = (f: StockFilaDto) =>
  sePuedeOrdenar(f) ? undefined : "Sin disponible para cargar en una orden.";

/** ADR-13: la semilla de cliente se distingue visualmente, nunca se confunde con la propia. */
const DUENIO_BADGE_CLS: Record<DuenioLote, string> = {
  Propio: "bg-verde-bg text-verde",
  Cliente: "bg-panel-soft text-ink-soft",
};

export function StockPanel({
  datos,
  cargando,
  variedades,
  especies = [],
  campanias,
  filtros,
  onFiltros,
  onNuevoLote,
  onEditarLote,
  onMovimiento,
  onOrden,
  onExcel,
  descargando,
}: Props) {
  const variedadesDeEspecie = variedades.filter((v) => !filtros.especie || v.especie === filtros.especie);

  const columns: Column<StockFilaDto>[] = [
    {
      key: "variedad",
      header: "Variedad",
      sortBy: (f) => f.variedad,
      cell: (f) => (
        <div>
          <div className="font-semibold text-ink">{f.variedad}</div>
          <div className="text-xs text-ink-soft">
            {f.especie} · {f.campania}
          </div>
        </div>
      ),
    },
    { key: "lote", header: "Lote", sortBy: (f) => f.loteCodigo, cell: (f) => f.loteCodigo, className: "whitespace-nowrap" },
    {
      key: "duenio",
      header: "Dueño",
      sortBy: (f) => f.duenio,
      cell: (f) => (
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", DUENIO_BADGE_CLS[f.duenio])}>
          {duenioEtiqueta(f)}
        </span>
      ),
    },
    { key: "ubicacion", header: "Ubicación", sortBy: (f) => f.ubicacion, cell: (f) => f.ubicacion },
    { key: "envase", header: "Envase", cell: (f) => envaseEtiqueta(f.envase) },
    { key: "tratada", header: "Tratamiento", cell: (f) => tratamientoEtiqueta(f.tratada) },
    { key: "pg", header: "PG", align: "right", cell: (f) => oDash(f.pg, " %") },
    { key: "pmil", header: "PMIL", align: "right", cell: (f) => oDash(f.pmil, " g") },
    // En la campaña de trigo ahí se anotaban la línea comercial y el curado, que distinguen lotes
    // por lo demás iguales: se ve en una línea y el texto completo queda en el title.
    {
      key: "observaciones",
      header: "Obs.",
      cell: (f) =>
        f.observaciones ? (
          <span className="block max-w-48 truncate" title={f.observaciones}>
            {f.observaciones}
          </span>
        ) : (
          "—"
        ),
    },
    { key: "fisico", header: "Físico", align: "right", sortBy: (f) => f.fisico, cell: (f) => unidades(f.fisico) },
    { key: "comprometido", header: "Reservado", align: "right", sortBy: (f) => f.comprometido, cell: (f) => unidades(f.comprometido) },
    {
      key: "disponible",
      header: "Disponible",
      align: "right",
      sortBy: (f) => f.disponible,
      cell: (f) => (
        <span className={cn("font-semibold", f.disponible < 0 ? "text-rojo" : "text-ink")}>{unidades(f.disponible)}</span>
      ),
    },
    { key: "kg", header: "Kg disp.", align: "right", sortBy: (f) => f.kgDisponibles, cell: (f) => kg(f.kgDisponibles), className: "whitespace-nowrap" },
    {
      key: "acciones",
      header: "",
      align: "right",
      cell: (f) => (
        <div className="flex justify-end gap-1">
          {/* Deshabilitado, el botón no recibe el mouse (`pointer-events-none`): el motivo va
              también en el contenedor para que se vea el tooltip; en el botón queda como
              descripción accesible. */}
          <span className="inline-flex" title={motivoSinOrden(f)}>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Orden con ${f.loteCodigo} en ${f.ubicacion}`}
              disabled={!sePuedeOrdenar(f)}
              title={motivoSinOrden(f)}
              onClick={() => onOrden(f)}
            >
              Orden
            </Button>
          </span>
          <Button variant="ghost" size="sm" aria-label={`Ingreso ${f.loteCodigo} en ${f.ubicacion}`} onClick={() => onMovimiento("ingreso", f)}>
            Ingreso
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Ajuste ${f.loteCodigo} en ${f.ubicacion}`} onClick={() => onMovimiento("ajuste", f)}>
            Ajuste
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Reubicar ${f.loteCodigo} en ${f.ubicacion}`} onClick={() => onMovimiento("reubicacion", f)}>
            Reubicar
          </Button>
          <Button variant="outline" size="sm" aria-label={`Editar lote ${f.loteCodigo}`} onClick={() => onEditarLote(f.loteId)}>
            Editar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterField label="Especie">
          <Select
            aria-label="Especie"
            value={filtros.especie ?? ""}
            onChange={(e) =>
              onFiltros({ ...filtros, especie: (e.target.value || undefined) as EspecieSemillero | undefined, variedadId: undefined })
            }
          >
            <option value="">Todas</option>
            {especies.map((e) => (
              <option key={e.codigoRubro} value={e.nombre}>
                {e.nombre}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Variedad">
          <Select
            aria-label="Variedad"
            value={filtros.variedadId ?? ""}
            onChange={(e) => onFiltros({ ...filtros, variedadId: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Todas</option>
            {variedadesDeEspecie.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Envase">
          <EnvaseSelect
            aria-label="Envase"
            value={filtros.envase}
            onChange={(envase) => onFiltros({ ...filtros, envase })}
          />
        </FilterField>
        <FilterField label="Tratamiento">
          <TratamientoSelect
            aria-label="Tratamiento"
            value={filtros.tratada}
            onChange={(tratada) => onFiltros({ ...filtros, tratada })}
          />
        </FilterField>
        <FilterField label="Campaña">
          <CampaniaSelect
            value={filtros.campania}
            campanias={campanias}
            onChange={(campania) => onFiltros({ ...filtros, campania: campania || undefined })}
            todasLabel="Todas"
          />
        </FilterField>
        <FilterField label="Dueño" title="La semilla de un cliente no es stock vendible propio (ADR-13).">
          <Select
            aria-label="Dueño"
            value={filtros.duenio ?? ""}
            onChange={(e) => onFiltros({ ...filtros, duenio: (e.target.value || undefined) as DuenioLote | undefined })}
          >
            <option value="">Todos</option>
            <option value="Propio">Propio</option>
            <option value="Cliente">Clientes</option>
          </Select>
        </FilterField>
        <label className="flex items-center gap-2 pb-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-clementina-deep"
            checked={filtros.soloConStock === false}
            onChange={(e) => onFiltros({ ...filtros, soloConStock: e.target.checked ? false : undefined })}
          />
          Mostrar agotados
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onExcel} disabled={descargando}>
            <Download className="size-4" /> {descargando ? "Generando…" : "Excel"}
          </Button>
          <Button variant="accent" size="sm" onClick={onNuevoLote}>
            <Plus className="size-4" /> Nuevo lote
          </Button>
        </div>
      </FilterBar>

      {cargando && !datos ? (
        <p className="py-8 text-center text-ink-soft">Cargando el stock…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={datos?.filas ?? []}
          getRowKey={(f) => `${f.loteId}-${f.ubicacionId}`}
          empty="Todavía no hay stock con esos filtros. Empezá con «Nuevo lote»."
        />
      )}
    </div>
  );
}
