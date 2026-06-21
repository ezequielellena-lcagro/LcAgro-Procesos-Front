import { KpiCard } from "@/shared/components/kpi-card";
import { usd } from "@/shared/format/format";
import type { CuentaDto } from "../types";

// KPIs sobre las filas de la página actual (etiquetados "pág."). El agregado global exacto requiere
// un endpoint de totales en el backend (mejora futura), no la suma de una sola página.
export function CuentasKpis({ items, total }: { items: CuentaDto[]; total: number }) {
  const vencido = items.reduce((s, c) => s + c.saldoVencido, 0);
  const aVencer = items.reduce((s, c) => s + c.saldoAVencer, 0);
  const cartera = items.reduce((s, c) => s + c.saldo, 0);

  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      <KpiCard label="Cuentas" value={total} />
      <KpiCard label="Saldo vencido (pág.)" value={usd(vencido)} tone="rojo" />
      <KpiCard label="A vencer (pág.)" value={usd(aVencer)} />
      <KpiCard label="Cartera (pág.)" value={usd(cartera)} tone="verde" />
    </div>
  );
}
