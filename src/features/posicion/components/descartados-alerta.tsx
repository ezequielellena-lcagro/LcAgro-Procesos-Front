import { AlertTriangle } from "lucide-react";
import { numero } from "@/shared/format/format";
import type { DescartadoDto } from "../types";

/**
 * Alerta (no bloqueante): contratos que la posición no cuenta porque su precio USD cae fuera del rango
 * 50–700 (típico: negocio en pesos sin cotización cargada). El contrato existe y debería contar → el
 * cliente lo corrige en MacroGest. Pedido textual: "querés verlo igual como alerta".
 */
export function DescartadosAlerta({ descartados }: { descartados: DescartadoDto[] }) {
  if (descartados.length === 0) return null;

  const totalContratos = descartados.reduce((s, d) => s + d.contratos, 0);
  const totalTn = descartados.reduce((s, d) => s + d.tn, 0);

  return (
    <div className="rounded-card border border-clementina/40 bg-clementina/10 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 flex-none text-clementina-deep" />
        <div className="space-y-1">
          <p className="font-medium text-ink">
            {totalContratos} {totalContratos === 1 ? "contrato quedó" : "contratos quedaron"} fuera de la posición por
            precio anómalo ({numero(totalTn)} tn).
          </p>
          <p className="text-ink-soft">
            Suele ser un negocio en pesos sin cotización cargada. El contrato existe y debería contar: revisalo en
            MacroGest para que entre.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-0.5 pt-0.5 text-xs text-ink-soft">
            {descartados.map((d) => (
              <li key={`${d.campania}-${d.cereal}-${d.lado}`}>
                <span className="text-ink">{d.campania}</span> · {d.cereal} · {d.lado}: {d.contratos} ·{" "}
                {numero(d.tn)} tn
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
