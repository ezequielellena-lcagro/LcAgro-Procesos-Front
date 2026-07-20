import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { numero } from "@/shared/format/format";
import type { DescartadoDto } from "../types";

/**
 * Alerta (no bloqueante): contratos cuyo precio USD queda fuera del rango plausible y por eso NO entran
 * al promedio ponderado. Sus toneladas SÍ cuentan en la posición. Suele ser un negocio en pesos que
 * ni tiene `valor_dolar` ni cotización del día para convertirlo → hay que corregirlo en MacroGest.
 *
 * Se muestra COLAPSADA (una línea) porque el detalle crudo ocupaba media pantalla. El desglose se abre
 * a pedido, agrupado por campaña. Pedido textual: "querés verlo igual como alerta".
 */
export function DescartadosAlerta({ descartados }: { descartados: DescartadoDto[] }) {
  const [abierto, setAbierto] = useState(false);

  const { totalContratos, totalTn, porCampania } = useMemo(() => {
    const grupos = new Map<string, DescartadoDto[]>();
    for (const d of descartados) {
      const arr = grupos.get(d.campania) ?? [];
      arr.push(d);
      grupos.set(d.campania, arr);
    }
    return {
      totalContratos: descartados.reduce((s, d) => s + d.contratos, 0),
      totalTn: descartados.reduce((s, d) => s + d.tn, 0),
      // Campaña más nueva primero (es la que le importa al usuario).
      porCampania: [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    };
  }, [descartados]);

  if (descartados.length === 0) return null;

  return (
    <div className="rounded-card border border-clementina/40 bg-clementina/10 text-sm">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <AlertTriangle className="size-4 flex-none text-clementina-deep" />
        <span className="text-ink">
          <b className="font-medium">
            {totalContratos} {totalContratos === 1 ? "contrato" : "contratos"} con el precio mal cargado
          </b>{" "}
          <span className="text-ink-soft">
            ({numero(totalTn)} tn). Sus toneladas cuentan; el precio no entra al promedio.
          </span>
        </span>
        <span className="ml-auto flex flex-none items-center gap-1 text-xs text-ink-soft">
          {abierto ? "Ocultar" : "Ver detalle"}
          {abierto ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>
      </button>

      {abierto && (
        <div className="space-y-2 border-t border-clementina/30 px-3 pb-3 pt-2">
          <p className="text-xs text-ink-soft">
            Suele ser un negocio pactado en pesos sin cotización para convertirlo. Corregilo en MacroGest (cargá el
            dólar del contrato) y el precio entra solo.
          </p>
          {porCampania.map(([campania, filas]) => (
            <div key={campania} className="text-xs">
              <p className="font-medium text-ink">{campania}</p>
              <ul className="mt-0.5 space-y-0.5 pl-3">
                {filas.map((d) => (
                  <li key={`${d.cereal}-${d.lado}`} className="flex gap-2 text-ink-soft">
                    <span className="min-w-16 text-ink">{d.cereal}</span>
                    <span className="min-w-14">{d.lado}</span>
                    <span className="tabular">
                      {d.contratos} {d.contratos === 1 ? "contrato" : "contratos"} · {numero(d.tn)} tn
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
