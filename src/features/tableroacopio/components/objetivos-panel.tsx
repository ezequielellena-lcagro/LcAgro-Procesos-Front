import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { entero } from "../lib/formato";
import { aTexto, parsearNumero } from "../lib/numero";
import { INDICADORES, type IndicadorClave } from "../lib/semaforo";
import type {
  AcopiadoCereal,
  CampaniaTablero,
  GuardarObjetivosRequest,
  ObjetivosIndicadores,
} from "../types";

const UNIDAD: Record<IndicadorClave, string> = {
  gananciaPosicionPct: "%",
  comisionPct: "%",
  rotacion: "veces",
  tnPreventas: "tn",
  tnAcopiadas: "tn",
  nuevosClientes: "clientes",
};

const aValor = (texto: string) => parsearNumero(texto);

/**
 * Objetivos de la campaña elegida. Cada campaña guarda los suyos: se cargan los de la que viene sin tocar
 * las cerradas. Vacío = sin objetivo. «Restablecer» vuelve a los por defecto.
 */
export function ObjetivosPanel({
  campania,
  acopiadoCereal,
  puedeEditar,
  guardando,
  onGuardar,
  onRestablecer,
}: {
  campania: CampaniaTablero;
  acopiadoCereal: AcopiadoCereal[];
  puedeEditar: boolean;
  guardando: boolean;
  onGuardar: (req: GuardarObjetivosRequest) => void;
  onRestablecer: () => void;
}) {
  const [indicadores, setIndicadores] = useState<Record<IndicadorClave, string>>(
    () =>
      Object.fromEntries(
        INDICADORES.map(({ clave }) => [clave, aTexto(campania.objetivos[clave])]),
      ) as Record<IndicadorClave, string>,
  );
  const cerealesBase = [
    ...new Set([
      ...acopiadoCereal.map((a) => a.cereal),
      ...campania.objetivosCereal.map((o) => o.cereal),
    ]),
  ];
  const [cereales, setCereales] = useState<Record<string, string>>(() =>
    Object.fromEntries(campania.objetivosCereal.map((o) => [o.cereal, aTexto(o.tn)])),
  );

  const valores = Object.fromEntries(
    INDICADORES.map(({ clave }) => [clave, aValor(indicadores[clave])]),
  ) as Record<IndicadorClave, number | null | undefined>;
  const invalidos =
    Object.values(valores).some((v) => v === undefined) ||
    Object.values(cereales).some((t) => aValor(t) === undefined);
  const sumaCereales = Object.values(cereales).reduce((s, t) => s + (aValor(t) ?? 0), 0);
  const objetivoAcopiado = valores.tnAcopiadas ?? null;

  function guardar() {
    onGuardar({
      indicadores: valores as unknown as ObjetivosIndicadores,
      cereales: Object.entries(cereales)
        .map(([cereal, t]) => ({ cereal, tn: aValor(t) ?? 0 }))
        .filter((o) => o.tn > 0),
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-panel p-4 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Objetivos de {campania.campania}
            </h2>
            <p className="text-xs text-ink-soft">
              {campania.objetivosPropios
                ? "La campaña tiene objetivos cargados."
                : "La campaña usa los objetivos por defecto: guardá para fijar los suyos."}{" "}
              Vacío = sin objetivo.
            </p>
          </div>
          {puedeEditar && (
            <div className="flex gap-2">
              {campania.objetivosPropios && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={guardando}
                  onClick={() => {
                    if (window.confirm(`¿Volver ${campania.campania} a los objetivos por defecto?`))
                      onRestablecer();
                  }}
                >
                  Restablecer
                </Button>
              )}
              <Button
                type="button"
                variant="accent"
                size="sm"
                disabled={invalidos || guardando}
                onClick={guardar}
              >
                {guardando ? "Guardando…" : "Guardar objetivos"}
              </Button>
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INDICADORES.map(({ clave, nombre }) => (
            <label key={clave} className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              {nombre}
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Objetivo de ${nombre}`}
                  value={indicadores[clave]}
                  disabled={!puedeEditar}
                  onChange={(e) => setIndicadores({ ...indicadores, [clave]: e.target.value })}
                  className={cn("text-right", valores[clave] === undefined && "border-rojo")}
                  placeholder="sin objetivo"
                />
                <span className="w-14 text-ink-soft">{UNIDAD[clave]}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-line bg-panel shadow-card">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-display text-lg font-semibold text-ink">
            Objetivo de volumen acopiado, por cereal
          </h2>
          <p className="text-xs text-ink-soft">
            Toneladas de 1116 A por cereal en {campania.campania}. Lo habitual es mirar el agregado;
            el reparto es opcional.
            {objetivoAcopiado != null &&
              ` La suma da ${entero(sumaCereales)} tn contra un objetivo de ${entero(objetivoAcopiado)} tn${
                sumaCereales < objetivoAcopiado
                  ? `: faltan repartir ${entero(objetivoAcopiado - sumaCereales)} tn`
                  : ""
              }.`}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs text-ink-soft">
              <th className="px-4 py-2 text-left font-medium">Cereal</th>
              <th className="px-3 py-2 font-medium">Al corte</th>
              <th className="px-3 py-2 font-medium">Año entero</th>
              <th className="px-3 py-2 font-medium">Objetivo (tn)</th>
              <th className="px-3 py-2 font-medium">Avance</th>
            </tr>
          </thead>
          <tbody>
            {cerealesBase.map((cereal) => {
              const real = acopiadoCereal.find((a) => a.cereal === cereal);
              const objetivo = aValor(cereales[cereal] ?? "");
              return (
                <tr
                  key={cereal}
                  className="border-b border-line-soft text-right tabular last:border-0"
                >
                  <td className="px-4 py-1.5 text-left font-medium text-ink">{cereal}</td>
                  <td className="px-3 py-1.5 text-ink">{entero(real?.tnCorte ?? 0)}</td>
                  <td className="px-3 py-1.5 text-ink-soft">{entero(real?.tnCompleta ?? 0)}</td>
                  <td className="px-3 py-1.5">
                    <Input
                      aria-label={`Objetivo de ${cereal}`}
                      value={cereales[cereal] ?? ""}
                      disabled={!puedeEditar}
                      onChange={(e) => setCereales({ ...cereales, [cereal]: e.target.value })}
                      className={cn(
                        "ml-auto h-8 w-28 text-right",
                        objetivo === undefined && "border-rojo",
                      )}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-ink-soft">
                    {objetivo ? `${entero(((real?.tnCorte ?? 0) / objetivo) * 100)} %` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
