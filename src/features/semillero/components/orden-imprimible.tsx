import { Printer, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import logoFull from "@/assets/brand/logo-full.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fecha, oDash } from "@/shared/format/format";
import { fechaHora, kg, unidades } from "../format";
import type { DuenioLote, OrdenCargaDto, OrdenCargaItemDto } from "../types";

interface Props {
  orden: OrdenCargaDto | null;
  onClose: () => void;
}

/** "Proceso" es como el cliente llama al dueño del lote (pedido 2026-09-27); los valores no cambian. */
const PROCESO_ETIQUETA: Record<DuenioLote, string> = { Propio: "Propio", Cliente: "Cliente" };

/**
 * Renglones de la orden agrupados por producto (especie + variedad + campaña + tratamiento + envase +
 * PG/PMIL), en el orden en que aparecen. El formato con el que venía trabajando el semillero era UNA
 * orden por producto, con sus datos en un cuadro arriba y el detalle de lotes abajo; como acá una
 * orden puede llevar más de un producto, se repite ese bloque por cada uno.
 */
interface GrupoProducto {
  clave: string;
  muestra: OrdenCargaItemDto;
  items: OrdenCargaItemDto[];
  cantidad: number;
  kg: number;
}

function agruparPorProducto(items: OrdenCargaItemDto[]): GrupoProducto[] {
  const grupos = new Map<string, GrupoProducto>();
  for (const it of items) {
    const clave = [
      it.especie,
      it.variedad,
      it.campania,
      it.tratada,
      it.envase,
      it.pg,
      it.pmil,
    ].join("|");
    const grupo = grupos.get(clave) ?? { clave, muestra: it, items: [], cantidad: 0, kg: 0 };
    grupo.items.push(it);
    grupo.cantidad += it.cantidad;
    grupo.kg += it.kg;
    grupos.set(clave, grupo);
  }
  return [...grupos.values()];
}

/**
 * Vista imprimible de una orden de carga (R7.1). Sin PDF en el backend, front-only, mismo patrón
 * que Préstamos (`imprimir.ts`).
 *
 * <p>Formato (pedido del cliente, 2026-09-27): parecido al comprobante con el que venían trabajando
 * —logo, cuadro de datos del producto, "Detalle de lotes", "Información" y tres firmas— y con letra
 * grande, porque lo leen los chicos de la carga en el galpón. La tipografía de impresión se fija en
 * `src/index.css` (`.orden-imprimible`).</p>
 *
 * <p>A diferencia del Reporte de Préstamos —una pestaña fija que ya vive adentro del layout, así que
 * alcanza con `.no-print` en el resto del chrome—, acá se elige e imprime UNA orden puntual desde la
 * tabla de Órdenes, que sigue montada detrás. Por eso hace falta un portal directo a `document.body`
 * con su propia hoja `@media print` que oculta el resto de la app (`#root`) mientras está montada:
 * si no, la tabla de fondo también saldría impresa.</p>
 */
export function OrdenImprimible({ orden, onClose }: Props) {
  useEffect(() => {
    if (!orden) return;
    const hoja = document.createElement("style");
    hoja.textContent = "@media print { #root { display: none !important; } }";
    document.head.appendChild(hoja);
    return () => hoja.remove();
  }, [orden]);

  if (!orden) return null;

  // ADR-13: los kg del cliente nunca se suman a los propios. "Mixta" es una orden con renglones de
  // los dos procesos; cuando TODOS son del cliente, la leyenda lo deja explícito aunque la carga salga
  // físicamente de la planta de La Clementina (no es stock vendible propio).
  const mixta = orden.totalKgPropio > 0 && orden.totalKgCliente > 0;
  const todosDelCliente =
    orden.items.length > 0 && orden.items.every((it) => it.duenio === "Cliente");
  const grupos = agruparPorProducto(orden.items);

  return createPortal(
    <div className="orden-imprimible fixed inset-0 z-50 overflow-y-auto bg-white p-8 text-base text-ink print:static print:p-0">
      <div className="no-print mb-4 flex justify-end gap-2">
        <Button type="button" variant="accent" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" /> Cerrar
        </Button>
      </div>

      <div className="mx-auto max-w-[190mm]">
        <header className="mb-5 flex items-start justify-between gap-6">
          <img src={logoFull} alt="La Clementina" className="h-14 w-auto flex-none" />
          <div className="text-right">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
              Orden de carga
            </h1>
            <p className="text-2xl font-bold">N° {orden.numero}</p>
            <p className="text-sm text-ink-soft">Emitida: {fechaHora(orden.fechaAlta)}</p>
          </div>
        </header>

        <Cuadro>
          <Fila>
            <Celda
              label="Cliente"
              valor={`${orden.clienteNumero} · ${orden.clienteDenominacion}`}
              ancho
            />
          </Fila>
          <Fila>
            <Celda label="Destino / Campo" valor={orden.destinoNombre} destacado />
            <Celda label="Pedido" valor={orden.numeroPedidoVenta ?? "—"} />
          </Fila>
          <Fila ultima>
            <Celda label="Remito" valor={orden.numeroRemito ?? "—"} />
            <Celda label="Despacho" valor={oDash(orden.fechaDespacho, fecha)} />
          </Fila>
        </Cuadro>

        {todosDelCliente && (
          <p className="mt-3 inline-block rounded-md border-2 border-ink px-3 py-1 text-sm font-bold uppercase">
            Semilla del cliente
          </p>
        )}

        {grupos.map((grupo, i) => (
          <Producto
            key={grupo.clave}
            grupo={grupo}
            subtotal={grupos.length > 1}
            total={i === grupos.length - 1 ? orden : null}
          />
        ))}

        {mixta && (
          <p className="mt-2 text-sm font-medium">
            {kg(orden.totalKgPropio)} propios + {kg(orden.totalKgCliente)} del cliente
          </p>
        )}

        <div className="mt-5">
          <Titulo>Información</Titulo>
          <Cuadro>
            <Fila ultima>
              <Celda label="Observaciones" valor={orden.observaciones ?? "—"} ancho alto />
            </Fila>
          </Cuadro>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 text-center text-sm">
          <div className="border-t-2 border-ink pt-1">Responsable despacho</div>
          <div className="border-t-2 border-ink pt-1">Transportista / Receptor</div>
          <div className="border-t-2 border-ink pt-1">Fecha y hora de despacho</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Un producto de la orden: cuadro con sus datos (como el comprobante anterior) y abajo el detalle de
 * lotes × ubicación. El último bloque lleva además el total general de la orden, así la tabla de
 * renglones sigue siendo una sola por producto.
 */
function Producto({
  grupo,
  subtotal,
  total,
}: {
  grupo: GrupoProducto;
  subtotal: boolean;
  total: OrdenCargaDto | null;
}) {
  const m = grupo.muestra;
  const envase = m.envase === "BigBag" ? "BigBag" : "Bolsa";
  return (
    <section className="mt-5 break-inside-avoid">
      <Cuadro>
        <Fila>
          <Celda label="Especie" valor={m.especie} />
          <Celda label="Variedad" valor={m.variedad} destacado />
        </Fila>
        <Fila>
          <Celda label="Campaña" valor={m.campania} />
          <Celda label="Tratamiento" valor={m.tratada ? "Tratada" : "Sin tratar"} destacado />
        </Fila>
        <Fila>
          <Celda label="Tipo envase" valor={envase} />
          <Celda
            label="Total cantidad"
            valor={`${unidades(grupo.cantidad)} ${m.envase === "BigBag" ? "BB" : "bolsas"} · ${kg(grupo.kg)}`}
            destacado
          />
        </Fila>
        <Fila ultima>
          <Celda label="PG (%)" valor={m.pg === null ? "—" : unidades(m.pg)} />
          <Celda label="PMIL (g)" valor={m.pmil === null ? "—" : unidades(m.pmil)} />
        </Fila>
      </Cuadro>

      <Titulo>Detalle de lotes</Titulo>
      {/* Contenedor con scroll horizontal en pantalla (viewports angostos no cortan la columna Kg);
          en @media print (src/index.css) `.overflow-x-auto` vuelve a `overflow: visible`. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border-2 border-ink">
          <thead>
            <tr className="bg-panel-soft text-left text-xs font-bold uppercase tracking-wide">
              <th className="border border-ink px-2 py-1.5">Lote</th>
              <th className="border border-ink px-2 py-1.5">Ubicación</th>
              <th className="border border-ink px-2 py-1.5">Proceso</th>
              <th className="border border-ink px-2 py-1.5 text-right">Cantidad</th>
              <th className="border border-ink px-2 py-1.5 text-right">Kg totales</th>
            </tr>
          </thead>
          <tbody>
            {grupo.items.map((it) => (
              <Renglon key={it.id} item={it} />
            ))}
          </tbody>
          <tfoot>
            {subtotal && (
              <tr className="font-semibold">
                <td colSpan={3} className="border border-ink px-2 py-1.5">
                  Subtotal
                </td>
                <td className="border border-ink px-2 py-1.5 text-right tabular">
                  {unidades(grupo.cantidad)}
                </td>
                <td className="border border-ink px-2 py-1.5 text-right tabular">{kg(grupo.kg)}</td>
              </tr>
            )}
            {total && (
              <tr className="bg-panel-soft text-lg font-bold">
                <td colSpan={3} className="border border-ink px-2 py-2">
                  Total
                </td>
                <td className="border border-ink px-2 py-2 text-right tabular">
                  {unidades(total.totalUnidades)}
                </td>
                <td className="border border-ink px-2 py-2 text-right tabular">
                  {kg(total.totalKg)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function Renglon({ item }: { item: OrdenCargaItemDto }) {
  return (
    <tr className={cn("text-lg", item.duenio === "Cliente" && "bg-panel-soft/60")}>
      <td className="border border-ink px-2 py-1.5 font-semibold">{item.loteCodigo}</td>
      <td className="border border-ink px-2 py-1.5 font-semibold">{item.ubicacion}</td>
      <td className="border border-ink px-2 py-1.5">{PROCESO_ETIQUETA[item.duenio]}</td>
      <td className="border border-ink px-2 py-1.5 text-right font-semibold tabular">
        {unidades(item.cantidad)}
      </td>
      <td className="border border-ink px-2 py-1.5 text-right tabular">{kg(item.kg)}</td>
    </tr>
  );
}

function Titulo({ children }: { children: string }) {
  return (
    <p className="mt-4 mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{children}</p>
  );
}

/** Cuadro con borde grueso, al estilo del comprobante anterior: filas de dos celdas (rótulo + valor). */
function Cuadro({ children }: { children: ReactNode }) {
  return <div className="border-2 border-ink">{children}</div>;
}

function Fila({ children, ultima = false }: { children: ReactNode; ultima?: boolean }) {
  return <div className={cn("grid grid-cols-2", !ultima && "border-b border-ink")}>{children}</div>;
}

function Celda({
  label,
  valor,
  ancho = false,
  alto = false,
  destacado = false,
}: {
  label: string;
  valor: string;
  /** Ocupa las dos columnas de la fila. */
  ancho?: boolean;
  /** Deja lugar para escribir a mano (observaciones). */
  alto?: boolean;
  /** Lo que los chicos de la carga tienen que ver primero. */
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex",
        ancho ? "col-span-2" : "border-r border-ink last:border-r-0",
        alto && "min-h-16",
      )}
    >
      <p className="w-36 flex-none border-r border-ink bg-panel-soft px-2 py-1.5 text-xs font-bold uppercase tracking-wide">
        {label}
      </p>
      <p className={cn("px-2 py-1.5", destacado ? "text-lg font-bold" : "font-medium")}>{valor}</p>
    </div>
  );
}
