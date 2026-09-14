import { Download, Plus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { fechaHora, kg } from "../format";
import {
  ESTADOS_ORDEN,
  type AnularOrdenInput,
  type ClienteCopiaDto,
  type DespacharOrdenInput,
  type EstadoOrdenCarga,
  type OrdenCargaDto,
  type OrdenCargaFiltros,
} from "../types";
import { ClienteSelect } from "./cliente-select";
import { TransicionOrdenDialog, type Transicion } from "./transicion-orden-dialog";

/** Pendiente es lo accionable (ámbar); Despachada quedó cerrada bien (verde); Anulada, mal (rojo). */
const ESTADO_BADGE_CLS: Record<EstadoOrdenCarga, string> = {
  Pendiente: "bg-clementina/15 text-clementina-deep",
  Despachada: "bg-verde-bg text-verde",
  Anulada: "bg-rojo-bg text-rojo",
};

/** ADR-13: nunca se suman los kg del cliente a los propios, ni siquiera acá. */
function kgTexto(o: OrdenCargaDto): string {
  if (o.totalKgCliente === 0) return kg(o.totalKgPropio);
  if (o.totalKgPropio === 0) return kg(o.totalKgCliente);
  return `${kg(o.totalKgPropio)} propios + ${kg(o.totalKgCliente)} del cliente`;
}

interface Props {
  datos: OrdenCargaDto[] | undefined;
  cargando: boolean;
  clientes: ClienteCopiaDto[];
  filtros: OrdenCargaFiltros;
  onFiltros: (filtros: OrdenCargaFiltros) => void;
  onNuevaOrden: () => void;
  onEditarOrden: (orden: OrdenCargaDto) => void;
  onDespachar: (id: number, input: DespacharOrdenInput) => Promise<unknown>;
  onAnular: (id: number, input: AnularOrdenInput) => Promise<unknown>;
  /** Ver `TransicionOrdenDialog`: ante un 409 hay que refrescar el stock aunque la operación falle. */
  onErrorRefrescarStock: () => void;
  onExcel: () => void;
  descargando: boolean;
  /** Abre `OrdenImprimible` (R7.1) con la orden completa; disponible en Pendiente y Despachada. */
  onImprimir: (orden: OrdenCargaDto) => void;
}

/**
 * Pestaña Órdenes de carga (R6.4 despacho, R6.5 anulación, R6.6 numeración siempre visible). A
 * diferencia de `StockPanel` (que delega sus diálogos al padre porque necesitan listas externas de
 * variedades/ubicaciones), acá el diálogo de transición no necesita nada más que la propia orden, así
 * que el panel lo abre y lo cierra por su cuenta.
 */
export function OrdenesPanel({
  datos,
  cargando,
  clientes,
  filtros,
  onFiltros,
  onNuevaOrden,
  onEditarOrden,
  onDespachar,
  onAnular,
  onErrorRefrescarStock,
  onExcel,
  descargando,
  onImprimir,
}: Props) {
  const [transicion, setTransicion] = useState<Transicion | null>(null);
  // Id propio y no colisionable: `OrdenDialog`/`LoteDialog` usan id="clienteNumero" para su propio
  // campo Cliente dentro de un `Modal` (que no es un portal, renderiza en el mismo subárbol del DOM).
  // Como este filtro queda montado debajo de esos diálogos al abrirlos, compartir el id duplicaría
  // el id en el documento (HTML inválido) y desasociaría el <Label htmlFor="clienteNumero"> del
  // diálogo. Mismo patrón que `detalleId` en `motivo-select.tsx`.
  const clienteFiltroId = useId();

  const columns: Column<OrdenCargaDto>[] = [
    { key: "numero", header: "N°", sortBy: (o) => o.numero, cell: (o) => o.numero, className: "whitespace-nowrap" },
    {
      key: "fechaAlta",
      header: "Fecha",
      sortBy: (o) => o.fechaAlta,
      cell: (o) => fechaHora(o.fechaAlta),
      className: "whitespace-nowrap",
    },
    { key: "cliente", header: "Cliente", sortBy: (o) => o.clienteDenominacion, cell: (o) => o.clienteDenominacion },
    { key: "destino", header: "Destino", sortBy: (o) => o.destinoNombre, cell: (o) => o.destinoNombre },
    { key: "pedido", header: "Pedido", cell: (o) => o.numeroPedidoVenta ?? "—", className: "whitespace-nowrap" },
    { key: "remito", header: "Remito", cell: (o) => o.numeroRemito ?? "—", className: "whitespace-nowrap" },
    {
      key: "estado",
      header: "Estado",
      sortBy: (o) => o.estado,
      cell: (o) => (
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", ESTADO_BADGE_CLS[o.estado])}>
          {ESTADOS_ORDEN[o.estado]}
        </span>
      ),
    },
    {
      key: "kg",
      header: "Kg",
      align: "right",
      sortBy: (o) => o.totalKg,
      cell: (o) => kgTexto(o),
      className: "whitespace-nowrap",
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      cell: (o) => (
        <div className="flex justify-end gap-1">
          {/* R7.1: se imprime una Pendiente o una Despachada; una Anulada no tiene sentido imprimirla. */}
          {o.estado !== "Anulada" && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Imprimir orden N° ${o.numero}`}
              onClick={() => onImprimir(o)}
            >
              Imprimir
            </Button>
          )}
          {o.estado === "Pendiente" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Despachar orden N° ${o.numero}`}
                onClick={() => setTransicion({ tipo: "despachar", orden: o })}
              >
                Despachar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Anular orden N° ${o.numero}`}
                onClick={() => setTransicion({ tipo: "anular", orden: o })}
              >
                Anular
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Editar orden N° ${o.numero}`}
                onClick={() => onEditarOrden(o)}
              >
                Editar
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <FilterBar className="mb-0">
        <FilterField label="Estado">
          <Select
            aria-label="Estado"
            value={filtros.estado ?? ""}
            onChange={(e) =>
              onFiltros({ ...filtros, estado: (e.target.value || undefined) as EstadoOrdenCarga | undefined })
            }
          >
            <option value="">Todos</option>
            {(Object.keys(ESTADOS_ORDEN) as EstadoOrdenCarga[]).map((estado) => (
              <option key={estado} value={estado}>
                {ESTADOS_ORDEN[estado]}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Cliente">
          <ClienteSelect
            id={clienteFiltroId}
            clientes={clientes}
            value={filtros.clienteNumero ?? null}
            onChange={(numero) => onFiltros({ ...filtros, clienteNumero: numero ?? undefined })}
          />
        </FilterField>
        <FilterField label="Buscar">
          <Input
            aria-label="Buscar"
            placeholder="N° de orden o cliente"
            value={filtros.texto ?? ""}
            onChange={(e) => onFiltros({ ...filtros, texto: e.target.value || undefined })}
          />
        </FilterField>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onExcel} disabled={descargando}>
            <Download className="size-4" /> {descargando ? "Generando…" : "Excel"}
          </Button>
          <Button variant="accent" size="sm" onClick={onNuevaOrden}>
            <Plus className="size-4" /> Nueva orden
          </Button>
        </div>
      </FilterBar>

      {cargando && !datos ? (
        <p className="py-8 text-center text-ink-soft">Cargando las órdenes…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={datos ?? []}
          getRowKey={(o) => o.id}
          defaultSort={{ key: "numero", sentido: "desc" }}
          empty="Todavía no hay órdenes con esos filtros. Empezá con «Nueva orden»."
        />
      )}

      <TransicionOrdenDialog
        transicion={transicion}
        onDespachar={onDespachar}
        onAnular={onAnular}
        onErrorRefrescarStock={onErrorRefrescarStock}
        onClose={() => setTransicion(null)}
      />
    </div>
  );
}
