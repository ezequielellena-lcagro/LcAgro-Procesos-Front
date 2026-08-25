import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { pct } from "@/shared/format/format";
import { TONO_SEGMENTO, calcular } from "../lib/segmentacion";
import type { CostoCultivo, CriterioMatriz, Cultivo, Productor, Segmento } from "../types";

interface Props {
  criterios: CriterioMatriz[];
  productores: Productor[];
  costos: Record<Cultivo, CostoCultivo>;
  onGuardar: (criterios: CriterioMatriz[]) => void;
  onClose: () => void;
}

/**
 * Configuración de la matriz de segmentación.
 *
 * Va en un modal y no en una pantalla porque es **configuración, no operación**: se toca una
 * vez por campaña y reclasifica la cartera entera. El cliente pidió justo eso: que solo una o
 * dos personas puedan tocarlo y que quede rastro.
 *
 * Los cambios no se aplican hasta Guardar, y antes se muestra a cuántos productores mueve.
 */
export function SegmentacionModal({ criterios, productores, costos, onGuardar, onClose }: Props) {
  const [borrador, setBorrador] = useState(criterios);

  const pesoActivo = borrador.filter((c) => c.peso > 0).reduce((t, c) => t + c.peso, 0);
  const sinPeso = pesoActivo === 0;
  const hayCambios = JSON.stringify(borrador) !== JSON.stringify(criterios);

  /** Cuántos productores cambian de segmento con la configuración propuesta. */
  const impacto = useMemo(() => {
    if (sinPeso) return null;
    const antes = productores.map((p) => calcular(p, costos, criterios).segmentoCalculado);
    const despues = productores.map((p) => calcular(p, costos, borrador).segmentoCalculado);
    const orden: Segmento[] = ["D", "C", "B", "A"];
    let suben = 0;
    let bajan = 0;
    antes.forEach((a, i) => {
      const d = orden.indexOf(despues[i]) - orden.indexOf(a);
      if (d > 0) suben++;
      else if (d < 0) bajan++;
    });
    return { suben, bajan, total: suben + bajan };
  }, [borrador, criterios, productores, costos, sinPeso]);

  const setPeso = (id: CriterioMatriz["id"], peso: number) =>
    setBorrador(borrador.map((c) => (c.id === id ? { ...c, peso } : c)));

  const guardar = () => {
    onGuardar(borrador);
    toast.success(
      impacto?.total
        ? `Matriz actualizada: ${impacto.total} productores cambian de segmento. En la app real queda registrado quién lo cambió y cuándo.`
        : "Matriz actualizada. Ningún productor cambió de segmento.",
    );
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Configurar segmentación" className="w-full max-w-2xl">
      <div className="max-h-[80vh] overflow-y-auto p-5">
        <header className="mb-4">
          <h2 className="font-display text-xl font-semibold text-ink">Matriz de segmentación</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Cuántos puntos aporta cada criterio al score. El score define el segmento:
            A ≥ 75, B ≥ 50, C ≥ 20, D el resto. <b>Peso 0 = el criterio no cuenta.</b>
          </p>
        </header>

        <div className="space-y-2">
          {borrador.map((c) => {
            const efectivo = pesoActivo > 0 ? (c.peso / pesoActivo) * 100 : 0;
            const apagado = c.peso === 0;
            return (
              <div
                key={c.id}
                className={cn(
                  "grid grid-cols-[11rem_1fr_7.5rem] items-center gap-3 rounded-md border p-2.5 transition",
                  apagado ? "border-dashed border-line bg-panel opacity-55" : "border-line bg-panel-soft",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{c.nombre}</div>
                  <div className="truncate text-[10px] text-ink-soft">{c.bandas.join(" · ")}</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={5}
                  value={c.peso}
                  onChange={(e) => setPeso(c.id, Number(e.target.value))}
                  aria-label={`Peso de ${c.nombre}`}
                  className="h-1 accent-clementina-deep"
                />
                <div className="text-right">
                  <span className="font-display text-lg font-semibold tabular text-ink">{c.peso}</span>
                  <span className="ml-1.5 text-[11px] tabular text-ink-soft">
                    {apagado ? "apagado" : `${pct(efectivo)} ef.`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* El peso nominal no es el peso real cuando la suma no da 100. Se dice, no se alerta:
            normalizar sobre el peso activo da exactamente lo mismo que repartir a mano. */}
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">
          Suman <b>{pesoActivo}</b> puntos. No hace falta que den 100: el score se normaliza sobre
          el peso activo, que da el mismo resultado que repartir los puntos sobrantes a mano. La
          columna <b>ef.</b> es lo que pesa cada criterio de verdad.
        </p>

        <div className="mt-3 rounded-md border border-clementina-deep/40 bg-clementina/10 p-3 text-xs leading-relaxed text-ink">
          <b>"Rentabilidad LC" viene en 0.</b> El Excel del cliente lo define con 20 puntos y nunca
          lo calcula, así que hoy el score se arma sobre 80. La app sí puede calcularlo: la
          rentabilidad por línea ya sale del módulo de Comisiones. Subilo y mirá el impacto abajo.
        </div>

        {/* La decisión no es "cuánto suma" sino "a cuántos mueve". */}
        <div
          className={cn(
            "mt-4 rounded-card border p-3",
            sinPeso
              ? "border-rojo bg-rojo/10"
              : impacto?.total
                ? "border-clementina-deep bg-clementina/10"
                : "border-line bg-panel-soft",
          )}
        >
          {sinPeso ? (
            <p className="text-xs font-medium text-rojo">
              Todos los criterios en 0: sin peso no hay score posible. Subí al menos uno.
            </p>
          ) : (
            <>
              <div className="mb-2 text-xs font-medium text-ink">
                {impacto?.total
                  ? `Este cambio reclasifica a ${impacto.total} de ${productores.length} productores (${impacto.suben} suben, ${impacto.bajan} bajan).`
                  : "Ningún productor cambia de segmento con esta configuración."}
              </div>
              <Distribucion productores={productores} costos={costos} criterios={borrador} />
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!hayCambios || sinPeso} onClick={guardar}>
            Guardar matriz
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Cómo queda repartida la cartera con la matriz propuesta. */
function Distribucion({
  productores,
  costos,
  criterios,
}: {
  productores: Productor[];
  costos: Record<Cultivo, CostoCultivo>;
  criterios: CriterioMatriz[];
}) {
  const conteo = useMemo(() => {
    const base: Record<Segmento, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const p of productores) base[calcular(p, costos, criterios).segmentoCalculado]++;
    return base;
  }, [productores, costos, criterios]);

  const total = productores.length || 1;

  return (
    <div className="flex gap-2">
      {(["A", "B", "C", "D"] as Segmento[]).map((s) => (
        <div key={s} className="flex-1 rounded border border-line bg-panel p-2 text-center">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", TONO_SEGMENTO[s])}>{s}</span>
          <div className="mt-1 font-display text-base font-semibold tabular text-ink">{conteo[s]}</div>
          <div className="text-[10px] text-ink-soft">{pct((conteo[s] / total) * 100)}</div>
        </div>
      ))}
    </div>
  );
}
