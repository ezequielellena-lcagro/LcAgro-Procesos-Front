import { KpiCard } from "@/shared/components/kpi-card";
import { fecha, usd } from "@/shared/format/format";
import type { TotalesProveedores, TramoDto } from "../types";

/**
 * KPIs sobre TODO el set filtrado (los calcula el backend), no la página: nunca se suman los
 * `items` en el front. El primer tramo es el número que responde la pregunta del proceso:
 * "¿cuánta plata necesito en el mes que viene?"; su etiqueta también sale de `tramos`.
 * "Vencido hoy" se muestra aparte, con su fecha, y se aclara que no suma, para que nadie lo agregue al total.
 */
export function ProveedoresKpis({
  tramos,
  totales,
  hoy,
}: {
  tramos: TramoDto[];
  totales: TotalesProveedores;
  hoy: string;
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
        label="Vencido hoy"
        value={usd(totales.vencidoHoy)}
        tone="rojo"
        hint={`Al ${fecha(hoy)} · memo, no suma`}
      />
    </div>
  );
}
