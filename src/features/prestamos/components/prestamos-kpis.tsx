import { KpiCard } from "@/shared/components/kpi-card";
import { importeConMoneda } from "../format";
import type { Moneda, PrestamoListadoDto, VencimientosDto } from "../types";

/** Suma el total de las cuotas que vencen dentro de los próximos `dias` días. */
function venceEn(datos: VencimientosDto, dias: number, hoy: Date): number {
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + dias);
  return datos.items
    .filter((v) => v.estado === "Pendiente")
    .filter((v) => {
      const f = new Date(`${v.fechaVencimiento}T00:00:00`);
      return f <= limite;
    })
    .reduce((s, v) => s + v.total, 0);
}

interface Props {
  moneda: Moneda;
  vencimientos: VencimientosDto;
  operaciones: PrestamoListadoDto[];
}

/**
 * Los cuatro números que Finanzas mira primero. "Vence en 30/90 días" es la pregunta que el Excel
 * sólo podía responder refrescando una tabla dinámica —y que por eso solía estar desactualizada.
 */
export function PrestamosKpis({ moneda, vencimientos, operaciones }: Props) {
  const hoy = new Date();
  const vencidas = vencimientos.items.filter((v) => v.vencida);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      <KpiCard
        label={`Deuda total ${moneda === "USD" ? "U$S" : "$"}`}
        value={importeConMoneda(vencimientos.totalTotal, moneda)}
        hint={`${vencimientos.items.length} vencimientos pendientes`}
      />
      <KpiCard
        label="Vence en 30 días"
        value={importeConMoneda(venceEn(vencimientos, 30, hoy), moneda)}
      />
      <KpiCard
        label="Vence en 90 días"
        value={importeConMoneda(venceEn(vencimientos, 90, hoy), moneda)}
      />
      {vencidas.length > 0 ? (
        <KpiCard
          label="Vencidas impagas"
          tone="rojo"
          value={importeConMoneda(
            vencidas.reduce((s, v) => s + v.total, 0),
            moneda,
          )}
          hint={`${vencidas.length} ${vencidas.length === 1 ? "cuota" : "cuotas"}`}
        />
      ) : (
        <KpiCard
          label="Operaciones vigentes"
          value={operaciones.length}
          hint="sin cuotas vencidas impagas"
          tone="verde"
        />
      )}
    </div>
  );
}
