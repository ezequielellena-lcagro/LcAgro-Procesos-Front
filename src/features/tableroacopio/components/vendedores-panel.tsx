import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { conSigno, entero } from "../lib/formato";
import { aTexto, parsearNumero } from "../lib/numero";
import type { AcopiadoExcluido, CampaniaTablero, VendedorTablero } from "../types";

function anterior(campania: string): string {
  const y = Number(campania.slice(0, 4)) - 1;
  return `${y}-${y + 1}`;
}

/** "15" → 15; "" o basura → null. Un porcentaje puede ser negativo (bajar el objetivo). */
const aNumero = (texto: string): number | null => parsearNumero(texto, { negativos: true }) ?? null;

/**
 * Cómo viene cada vendedor contra la campaña anterior y contra su objetivo. El objetivo es un % sobre
 * el CIERRE COMPLETO de la campaña anterior (doc 14 §2.9): por eso se muestra esa base al lado, y el
 * «mismo corte anterior» queda como referencia de cómo viene.
 */
export function VendedoresPanel({
  campania,
  vendedores,
  excluido,
  corte,
  puedeEditar,
  guardando,
  onGuardar,
}: {
  campania: CampaniaTablero;
  vendedores: VendedorTablero[];
  excluido: AcopiadoExcluido | undefined;
  corte: string;
  puedeEditar: boolean;
  guardando: boolean;
  onGuardar: (cambios: { vendedor: string; porcentaje: number }[]) => void;
}) {
  const prev = anterior(campania.campania);
  const [editados, setEditados] = useState<Record<string, string>>({});

  const pctDe = (v: VendedorTablero): number | null =>
    v.vendedor in editados ? aNumero(editados[v.vendedor]) : v.objetivoPct;
  const objetivoDe = (v: VendedorTablero): number | null => {
    const pct = pctDe(v);
    if (v.vendedor in editados)
      return v.baseObjetivoTn != null && pct != null ? v.baseObjetivoTn * (1 + pct / 100) : null;
    return v.objetivoTn;
  };

  const sumaCorte = vendedores.reduce((s, v) => s + v.tnCorte, 0);
  const sumaAnterior = vendedores.reduce((s, v) => s + (v.tnAnteriorCorte ?? 0), 0);
  const sumaBase = vendedores.reduce((s, v) => s + (v.baseObjetivoTn ?? 0), 0);
  const sumaObjetivo = vendedores.reduce((s, v) => s + (objetivoDe(v) ?? 0), 0);
  const objetivoCampania = campania.objetivos.tnAcopiadas;

  const cambios = Object.entries(editados)
    .map(([vendedor, texto]) => ({ vendedor, porcentaje: aNumero(texto) }))
    .filter((c): c is { vendedor: string; porcentaje: number } => c.porcentaje != null);
  const hayInvalidos = Object.values(editados).some((t) => aNumero(t) == null);

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-panel shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Seguimiento por vendedor
            </h2>
            <p className="text-xs text-ink-soft">
              Volumen acopiado (1116 A) al <b>{corte}</b> de {campania.campania} contra el mismo
              punto de {prev}. El objetivo es un % sobre el <b>cierre completo</b> de {prev}:
              arranca en el % por defecto y se puede cambiar. Sin vinculadas ni canales excluidos.
              Es el mismo objetivo que en Volumen acopiado.
            </p>
          </div>
          {puedeEditar && (
            <div className="no-print flex items-center gap-2">
              {cambios.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditados({})}
                  disabled={guardando}
                >
                  Descartar
                </Button>
              )}
              <Button
                type="button"
                variant="accent"
                size="sm"
                disabled={cambios.length === 0 || hayInvalidos || guardando}
                onClick={() => onGuardar(cambios)}
              >
                {guardando
                  ? "Guardando…"
                  : `Guardar porcentajes${cambios.length ? ` (${cambios.length})` : ""}`}
              </Button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-right text-xs text-ink-soft">
                <th className="px-4 py-2 text-left font-medium">Vendedor</th>
                <th className="px-3 py-2 font-medium">Al {corte}</th>
                <th className="px-3 py-2 font-medium">{prev} mismo corte</th>
                <th className="px-3 py-2 font-medium">Variación</th>
                <th className="px-3 py-2 font-medium">Cierre {prev}</th>
                <th className="px-3 py-2 font-medium">% objetivo</th>
                <th className="px-3 py-2 font-medium">Objetivo campaña</th>
                <th className="px-3 py-2 font-medium">Avance</th>
                <th className="px-3 py-2 font-medium">Clientes</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => {
                const variacion =
                  v.tnAnteriorCorte && v.tnAnteriorCorte > 0
                    ? (v.tnCorte / v.tnAnteriorCorte - 1) * 100
                    : null;
                const objetivo = objetivoDe(v);
                const avance = objetivo && objetivo > 0 ? (v.tnCorte / objetivo) * 100 : null;
                const pctTexto =
                  v.vendedor in editados ? editados[v.vendedor] : aTexto(v.objetivoPct);
                return (
                  <tr
                    key={v.vendedor}
                    className="whitespace-nowrap border-b border-line-soft text-right tabular last:border-0"
                  >
                    <td className="px-4 py-1.5 text-left font-medium text-ink">
                      {v.vendedor}
                      {v.objetivoAcordado && !(v.vendedor in editados) && (
                        <span className="ml-1.5 text-[11px] font-normal text-ink-soft">
                          · cargado
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-ink">{entero(v.tnCorte)}</td>
                    <td className="px-3 py-1.5 text-ink-soft">
                      {v.tnAnteriorCorte == null ? "—" : entero(v.tnAnteriorCorte)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-1.5",
                        variacion == null
                          ? "text-ink-soft"
                          : variacion >= 0
                            ? "text-verde"
                            : "text-rojo",
                      )}
                    >
                      {variacion == null ? "—" : `${conSigno(variacion)} %`}
                    </td>
                    <td className="px-3 py-1.5 text-ink-soft">
                      {v.baseObjetivoTn == null ? "—" : entero(v.baseObjetivoTn)}
                    </td>
                    <td className="px-3 py-1.5">
                      {puedeEditar && v.baseObjetivoTn != null ? (
                        <Input
                          aria-label={`% objetivo de ${v.vendedor}`}
                          className={cn(
                            "no-print ml-auto h-8 w-20 text-right",
                            aNumero(pctTexto) == null && "border-rojo",
                          )}
                          value={pctTexto}
                          onChange={(e) =>
                            setEditados({ ...editados, [v.vendedor]: e.target.value })
                          }
                        />
                      ) : null}
                      <span
                        className={cn(
                          puedeEditar && v.baseObjetivoTn != null && "hidden print:inline",
                        )}
                      >
                        {v.objetivoPct == null
                          ? "—"
                          : `${v.objetivoPct > 0 ? "+" : ""}${aTexto(v.objetivoPct)} %`}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-ink">
                      {objetivo == null ? "—" : entero(objetivo)}
                    </td>
                    <td className="px-3 py-1.5">
                      {avance == null ? (
                        <span className="text-ink-soft">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded bg-panel-soft">
                            <div
                              className={cn(
                                "h-full",
                                avance >= 100
                                  ? "bg-verde"
                                  : avance >= 60
                                    ? "bg-slate-brand/60"
                                    : "bg-clementina",
                              )}
                              style={{ width: `${Math.min(100, avance)}%` }}
                            />
                          </div>
                          <span className="w-12 text-ink">{entero(avance)} %</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-ink-soft">{entero(v.clientes)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line text-right font-semibold tabular text-ink">
                <td className="px-4 py-2 text-left">Total vendedores</td>
                <td className="px-3 py-2">{entero(sumaCorte)}</td>
                <td className="px-3 py-2">{entero(sumaAnterior)}</td>
                <td className="px-3 py-2">
                  {sumaAnterior > 0 ? `${conSigno((sumaCorte / sumaAnterior - 1) * 100)} %` : "—"}
                </td>
                <td className="px-3 py-2">{entero(sumaBase)}</td>
                <td />
                <td className="px-3 py-2">{entero(sumaObjetivo)}</td>
                <td className="px-3 py-2">
                  {sumaObjetivo > 0 ? `${entero((sumaCorte / sumaObjetivo) * 100)} %` : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-card border border-line bg-panel p-4 text-sm shadow-card">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Por qué no cierra contra el total
          </div>
          <p className="mt-1 text-ink">
            Acopiado al {corte}: <b>{entero(campania.tnAcopiadas ?? 0)} tn</b> = vendedores{" "}
            {entero(sumaCorte)} tn + vinculadas y canales excluidos{" "}
            {entero(excluido?.exclCorte ?? 0)} tn.
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            El total incluye a las sociedades vinculadas y a los canales que no son cartera
            comercial de nadie.
          </p>
        </div>
        <div className="rounded-card border border-line bg-panel p-4 text-sm shadow-card">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Objetivo de la campaña
          </div>
          {objetivoCampania == null ? (
            <p className="mt-1 text-ink">
              {campania.campania} no tiene objetivo de volumen acopiado. Se carga en la solapa
              Objetivos.
            </p>
          ) : (
            <p className="mt-1 text-ink">
              Volumen acopiado: <b>{entero(objetivoCampania)} tn</b>. La suma de los vendedores da{" "}
              {entero(sumaObjetivo)} tn más lo de las vinculadas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
