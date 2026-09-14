import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { fechaHora, kg, unidades } from "../format";
import {
  MOTIVOS_AJUSTE,
  TIPOS_MOVIMIENTO,
  type DuenioLote,
  type MovimientoDto,
  type MovimientoFiltros,
  type TipoMovimientoSemillero,
} from "../types";

interface Props {
  movimientos: MovimientoDto[] | undefined;
  cargando: boolean;
  filtros: MovimientoFiltros;
  onFiltros: (filtros: MovimientoFiltros) => void;
  onExcel: () => void;
  descargando: boolean;
}

function duenioEtiqueta(m: MovimientoDto): string {
  return m.duenio === "Propio" ? "Propio" : `Cliente · ${m.clienteDenominacion}`;
}

function motivoEtiqueta(m: MovimientoDto): string {
  if (m.motivoAjuste === null) return "—";
  return MOTIVOS_AJUSTE.find((mo) => mo.valor === m.motivoAjuste)?.etiqueta ?? m.motivoAjuste;
}

/** Lotes que efectivamente aparecen en el historial cargado, para no depender de otro fetch (R5.4). */
function opcionesLote(movimientos: MovimientoDto[]): { loteId: number; loteCodigo: string }[] {
  const vistos = new Map<number, string>();
  for (const m of movimientos) if (!vistos.has(m.loteId)) vistos.set(m.loteId, m.loteCodigo);
  return [...vistos.entries()]
    .map(([loteId, loteCodigo]) => ({ loteId, loteCodigo }))
    .sort((a, b) => a.loteCodigo.localeCompare(b.loteCodigo, "es"));
}

/**
 * Pestaña Movimientos (R5.4): historial filtrable por fecha, tipo, dueño y lote, con el motivo del
 * ajuste en su etiqueta legible (no el código del enum) y la observación a la vista, además de a
 * qué orden de carga pertenece el despacho (si corresponde). La semilla de cliente se distingue de
 * la propia igual que en el resto del módulo (ADR-13).
 */
export function MovimientosPanel({ movimientos, cargando, filtros, onFiltros, onExcel, descargando }: Props) {
  const columns: Column<MovimientoDto>[] = [
    { key: "fecha", header: "Fecha", sortBy: (m) => m.fecha, cell: (m) => fechaHora(m.fecha), className: "whitespace-nowrap" },
    { key: "tipo", header: "Tipo", sortBy: (m) => m.tipo, cell: (m) => TIPOS_MOVIMIENTO[m.tipo] },
    { key: "variedad", header: "Variedad", sortBy: (m) => m.variedad, cell: (m) => m.variedad },
    { key: "lote", header: "Lote", sortBy: (m) => m.loteCodigo, cell: (m) => m.loteCodigo, className: "whitespace-nowrap" },
    { key: "ubicacion", header: "Ubicación", sortBy: (m) => m.ubicacion, cell: (m) => m.ubicacion },
    { key: "duenio", header: "Dueño", sortBy: (m) => m.duenio, cell: (m) => duenioEtiqueta(m) },
    {
      key: "cantidad",
      header: "Cantidad",
      align: "right",
      sortBy: (m) => m.cantidad,
      cell: (m) => (
        <span className={cn("font-semibold tabular", m.cantidad < 0 ? "text-rojo" : "text-verde")}>
          {unidades(m.cantidad)}
        </span>
      ),
    },
    { key: "kg", header: "Kg", align: "right", sortBy: (m) => m.kg, cell: (m) => kg(m.kg), className: "whitespace-nowrap" },
    { key: "oc", header: "Orden", cell: (m) => (m.ordenCargaNumero === null ? "—" : `OC ${m.ordenCargaNumero}`) },
    { key: "motivo", header: "Motivo", cell: (m) => motivoEtiqueta(m) },
    { key: "observacion", header: "Observación", cell: (m) => m.observacion ?? "—" },
    { key: "usuario", header: "Usuario", sortBy: (m) => m.usuario, cell: (m) => m.usuario },
  ];

  return (
    <div className="space-y-3">
      <FilterBar className="mb-0">
        <FilterField label="Desde">
          <DateField value={filtros.desde ?? ""} onChange={(v) => onFiltros({ ...filtros, desde: v || undefined })} />
        </FilterField>
        <FilterField label="Hasta">
          <DateField value={filtros.hasta ?? ""} onChange={(v) => onFiltros({ ...filtros, hasta: v || undefined })} />
        </FilterField>
        <FilterField label="Tipo">
          <Select
            aria-label="Tipo"
            value={filtros.tipo ?? ""}
            onChange={(e) =>
              onFiltros({ ...filtros, tipo: (e.target.value || undefined) as TipoMovimientoSemillero | undefined })
            }
          >
            <option value="">Todos</option>
            {(Object.keys(TIPOS_MOVIMIENTO) as TipoMovimientoSemillero[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS_MOVIMIENTO[t]}
              </option>
            ))}
          </Select>
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
        <FilterField label="Lote">
          <Select
            aria-label="Lote"
            value={filtros.loteId ?? ""}
            onChange={(e) => onFiltros({ ...filtros, loteId: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Todos</option>
            {opcionesLote(movimientos ?? []).map((l) => (
              <option key={l.loteId} value={l.loteId}>
                {l.loteCodigo}
              </option>
            ))}
          </Select>
        </FilterField>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={onExcel} disabled={descargando}>
            <Download className="size-4" /> {descargando ? "Generando…" : "Excel"}
          </Button>
        </div>
      </FilterBar>
      {cargando && !movimientos ? (
        <p className="py-8 text-center text-ink-soft">Cargando los movimientos…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={movimientos ?? []}
          getRowKey={(m) => m.id}
          defaultSort={{ key: "fecha", sentido: "desc" }}
          empty="No hay movimientos con esos filtros."
        />
      )}
    </div>
  );
}
