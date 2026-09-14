import { Printer, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fecha, oDash } from "@/shared/format/format";
import { kg, unidades } from "../format";
import type { DuenioLote, OrdenCargaDto, OrdenCargaItemDto } from "../types";

interface Props {
  orden: OrdenCargaDto | null;
  onClose: () => void;
}

const DUENIO_ETIQUETA: Record<DuenioLote, string> = { Propio: "Propio", Cliente: "Cliente" };

/**
 * Vista imprimible de una orden de carga (R7.1). Sin PDF en el backend, front-only, mismo patrón
 * que Préstamos (`imprimir.ts`).
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
  // los dos dueños; cuando TODOS son del cliente, la leyenda lo deja explícito aunque la carga salga
  // físicamente de la planta de La Clementina (no es stock vendible propio).
  const mixta = orden.totalKgPropio > 0 && orden.totalKgCliente > 0;
  const todosDelCliente = orden.items.length > 0 && orden.items.every((it) => it.duenio === "Cliente");

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-8 text-ink print:static print:p-0">
      <div className="no-print mb-4 flex justify-end gap-2">
        <Button type="button" variant="accent" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" /> Cerrar
        </Button>
      </div>

      <header className="mb-6 flex items-start justify-between border-b border-line pb-4">
        <div>
          <h1 className="font-display text-xl font-semibold">La Clementina S.A.</h1>
          <p className="text-sm text-ink-soft">Orden de carga — Semillero</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">N° {orden.numero}</p>
          <p className="text-xs text-ink-soft">Alta: {fecha(orden.fechaAlta)}</p>
          <p className="text-xs text-ink-soft">Despacho: {oDash(orden.fechaDespacho, fecha)}</p>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Dato label="Cliente" valor={`${orden.clienteNumero} · ${orden.clienteDenominacion}`} />
        <Dato label="Destino" valor={orden.destinoNombre} />
        <Dato label="Pedido de venta" valor={orden.numeroPedidoVenta ?? "—"} />
        <Dato label="Remito" valor={orden.numeroRemito ?? "—"} />
      </section>

      {todosDelCliente && (
        <p className="mb-3 inline-block rounded-md border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-ink-soft">
          Semilla del cliente
        </p>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="py-1.5 pr-2">Variedad</th>
            <th className="py-1.5 pr-2">Lote</th>
            <th className="py-1.5 pr-2">Ubicación</th>
            <th className="py-1.5 pr-2">Envase</th>
            <th className="py-1.5 pr-2">Tratamiento</th>
            <th className="py-1.5 pr-2 text-right">PG</th>
            <th className="py-1.5 pr-2 text-right">PMIL</th>
            <th className="py-1.5 pr-2">Dueño</th>
            <th className="py-1.5 pr-2 text-right">Cantidad</th>
            <th className="py-1.5 text-right">Kg</th>
          </tr>
        </thead>
        <tbody>
          {orden.items.map((it) => (
            <Renglon key={it.id} item={it} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line font-semibold">
            <td colSpan={8} className="py-1.5 pr-2">
              Total
            </td>
            <td className="py-1.5 pr-2 text-right tabular">{unidades(orden.totalUnidades)}</td>
            <td className="py-1.5 text-right tabular">{kg(orden.totalKg)}</td>
          </tr>
        </tfoot>
      </table>

      {mixta && (
        <p className="mt-2 text-xs text-ink-soft">
          {kg(orden.totalKgPropio)} propios + {kg(orden.totalKgCliente)} del cliente
        </p>
      )}

      {orden.observaciones && (
        <div className="mt-4">
          <p className="text-xs uppercase text-ink-soft">Observaciones</p>
          <p className="text-sm">{orden.observaciones}</p>
        </div>
      )}

      <div className="mt-16 grid grid-cols-2 gap-8 text-center text-xs">
        <div className="border-t border-ink pt-1">Firma entrega</div>
        <div className="border-t border-ink pt-1">Firma recibe</div>
      </div>
    </div>,
    document.body,
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-ink-soft">{label}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}

function Renglon({ item }: { item: OrdenCargaItemDto }) {
  return (
    <tr className={cn("border-b border-line-soft", item.duenio === "Cliente" && "bg-panel-soft/60")}>
      <td className="py-1 pr-2">{item.variedad}</td>
      <td className="py-1 pr-2">{item.loteCodigo}</td>
      <td className="py-1 pr-2">{item.ubicacion}</td>
      <td className="py-1 pr-2">{item.envase === "BigBag" ? "BigBag" : "Bolsa"}</td>
      <td className="py-1 pr-2">{item.tratada ? "Tratada" : "Sin tratar"}</td>
      <td className="py-1 pr-2 text-right">{item.pg ?? "—"}</td>
      <td className="py-1 pr-2 text-right">{item.pmil ?? "—"}</td>
      <td className="py-1 pr-2">{DUENIO_ETIQUETA[item.duenio]}</td>
      <td className="py-1 pr-2 text-right tabular">{unidades(item.cantidad)}</td>
      <td className="py-1 text-right tabular">{kg(item.kg)}</td>
    </tr>
  );
}
