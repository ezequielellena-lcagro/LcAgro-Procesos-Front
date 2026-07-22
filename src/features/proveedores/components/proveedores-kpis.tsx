import { KpiCard } from "@/shared/components/kpi-card";
import { fecha, usd } from "@/shared/format/format";
import type { TotalesProveedores, TramoDto } from "../types";

/**
 * KPIs sobre TODO el set filtrado (los calcula el backend), no la página: nunca se suman los
 * `items` en el front. El primer tramo es el número que responde la pregunta del proceso:
 * "¿cuánta plata necesito en el mes que viene?"; su etiqueta también sale de `tramos`.
 * "Ya vencido" se muestra aparte y se aclara que no suma, para que nadie lo agregue al total.
 */
export function ProveedoresKpis({
  tramos,
  totales,
  fechaBase,
}: {
  tramos: TramoDto[];
  totales: TotalesProveedores;
  fechaBase: string;
}) {
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      <KpiCard label="Proveedores" value={totales.proveedores} />
      <KpiCard
        label="Deuda total"
        value={usd(totales.saldoTotal)}
        tone="verde"
        hint={`Suma de los ${tramos.length} tramos`}
      />
      <KpiCard
        label={tramos[0]?.etiqueta ?? "Primer tramo"}
        value={usd(totales.montos[0] ?? 0)}
        hint="Próximo desembolso"
      />
      <KpiCard
        label="Ya vencido"
        value={usd(totales.yaVencido)}
        tone="rojo"
        hint={`Al ${fecha(fechaBase)} · memo, no suma`}
      />
    </div>
  );
}
