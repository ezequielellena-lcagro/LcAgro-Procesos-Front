import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha, numero } from "@/shared/format/format";
import { useMapeoInline } from "./use-mapeo-inline";
import { CATEGORIAS, type ArticuloMapeoDto, type CategoriaValue, type CultivoSemilla, type VentaSemillaDto } from "../types";

function SinMapear() {
  return (
    <span className="inline-flex items-center rounded-full bg-clementina/20 px-2 py-0.5 text-xs font-medium text-clementina-deep">
      Sin mapear
    </span>
  );
}

function Sugerido({ texto }: { texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-medium text-clementina-deep">{texto}</span>
      <span className="inline-flex items-center rounded-full bg-clementina/20 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-clementina-deep">
        sugerido
      </span>
    </span>
  );
}

interface Props {
  filas: VentaSemillaDto[];
  cultivo: CultivoSemilla;
  /** Si el usuario puede curar el mapeo (permiso de gestión). */
  puedeEditar: boolean;
  /** Sugerencia del matcher por código de artículo (para pre-llenar el editor y mostrar el valor sugerido). */
  sugerencias: Map<number, ArticuloMapeoDto>;
  /** Cantidad de renglones del período por artículo (para avisar el alcance del guardado). */
  conteoArticulo: Map<number, number>;
}

/**
 * Grilla de ventas del mes en formato Sembra. La Variedad/Categoría se pueden curar INLINE: el mapeo
 * es por artículo, así que guardar en una fila actualiza todas las ventas de ese artículo del período.
 */
export function SemillaTable({ filas, cultivo, puedeEditar, sugerencias, conteoArticulo }: Props) {
  const m = useMapeoInline(cultivo);

  const columns: Column<VentaSemillaDto>[] = [
    { key: "campania", header: "Campaña Agrícola", align: "right", cell: (r) => r.campanaAgricola },
    { key: "fecha", header: "Fecha Comprobante", cell: (r) => fecha(r.fechaComprobante) },
    { key: "tipo", header: "Tipo de Comprobante", cell: (r) => r.tipoComprobante },
    { key: "numero", header: "N° Comprobante", align: "right", cell: (r) => r.numeroComprobante },
    { key: "linea", header: "Línea del Comprobante", align: "right", cell: (r) => r.lineaComprobante },
    {
      key: "cuit",
      header: "CUIT Destinatario",
      className: "whitespace-nowrap",
      cell: (r) => <span className="tabular text-ink-soft">{r.cuitDestinatario || "—"}</span>,
    },
    {
      key: "cliente",
      header: "Razón Social Destinatario",
      className: "max-w-[15rem]",
      cell: (r) => (
        <span className="block truncate font-medium text-ink" title={r.razonSocialDestinatario || ""}>
          {r.razonSocialDestinatario || "—"}
        </span>
      ),
    },
    {
      key: "articulo",
      header: "Artículo (MacroGest)",
      className: "max-w-[15rem]",
      cell: (r) => (
        <span className="block truncate text-ink-soft" title={r.nombreArticuloMacroGest}>
          {r.nombreArticuloMacroGest}
        </span>
      ),
    },
    {
      key: "variedad",
      header: "Variedad",
      className: "min-w-[13rem]",
      cell: (r) => {
        if (m.editando(r)) {
          return (
            <div className="space-y-1">
              <Combobox
                value={m.variedad}
                onChange={m.setVariedad}
                options={m.variedades.data ?? []}
                disabled={m.variedades.isPending || m.guardando}
                placeholder="Buscar variedad…"
              />
              {m.error && <p className="text-xs text-rojo">{m.error}</p>}
            </div>
          );
        }
        if (!r.requiereMapeo) return <span className="font-medium text-ink">{r.variedad}</span>;
        const sug = sugerencias.get(r.codigoArticulo);
        return sug?.cultivarInase ? <Sugerido texto={sug.cultivarInase} /> : <SinMapear />;
      },
    },
    {
      key: "categoria",
      header: "Categoría",
      className: "min-w-[11rem]",
      cell: (r) => {
        if (m.editando(r)) {
          return (
            <Select
              value={m.categoria}
              onChange={(e) => m.setCategoria(e.target.value as CategoriaValue)}
              disabled={m.guardando}
            >
              <option value="">Elegí…</option>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          );
        }
        if (!r.requiereMapeo) return r.categoria;
        const sug = sugerencias.get(r.codigoArticulo);
        return sug?.categoria ? (
          <span className="text-clementina-deep">{sug.categoria}</span>
        ) : (
          <span className="text-ink-soft">—</span>
        );
      },
    },
    {
      key: "kilos",
      header: "Kilos Totales",
      align: "right",
      className: "whitespace-nowrap",
      cell: (r) => <span className="font-semibold text-ink">{numero(r.kilosTotales)}</span>,
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      className: "whitespace-nowrap no-print",
      cell: (r) => {
        if (!puedeEditar) return null;
        if (m.editando(r)) {
          const n = conteoArticulo.get(r.codigoArticulo) ?? 1;
          return (
            <div className="flex items-center justify-end gap-1">
              {n > 1 && (
                <span className="mr-1 text-xs text-ink-soft" title="El mapeo se guarda por artículo, no por renglón">
                  afecta {n} renglones
                </span>
              )}
              <Button type="button" variant="accent" size="sm" onClick={() => void m.guardarFila(r)} disabled={m.guardando}>
                <Check className="size-4" /> {m.guardando ? "Guardando…" : "Guardar"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={m.cancelar} disabled={m.guardando} aria-label="Cancelar">
                <X className="size-4" />
              </Button>
            </div>
          );
        }
        return (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => m.empezar(r, sugerencias.get(r.codigoArticulo))}
            disabled={m.activo}
          >
            <Pencil className="size-4" /> {r.requiereMapeo ? "Mapear" : "Editar"}
          </Button>
        );
      },
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
