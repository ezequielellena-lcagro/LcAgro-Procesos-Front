import { DataTable, type Column } from "@/shared/components/data-table";
import { numero, oDash, tn, usd } from "@/shared/format/format";
import {
  CULTIVOS,
  type Cultivo,
  type HectareasPlan,
  type MarketShareGrilla,
  type PlanSiembraFila,
} from "../types";
import {
  cambiosDelPlan,
  planBase,
  textoHectareas,
  valorHectareas,
  type BorradorPlan,
} from "../lib/borrador-plan";
import { mercadoUsd, potencialTn, totalHectareas } from "../lib/calculos";
import { CeldaHectareas } from "./celda-hectareas";

function planCalculable(fila: PlanSiembraFila, borrador: BorradorPlan): HectareasPlan | null {
  const plan = valorHectareas(fila, borrador);
  if (CULTIVOS.every((cultivo) => plan[cultivo] === null)) return null;
  if (CULTIVOS.some((cultivo) => plan[cultivo] !== null && !Number.isFinite(plan[cultivo])))
    return null;
  return plan;
}

export function PlanSiembraGrilla({
  filas,
  marketShare,
  campania,
  editable,
  borrador,
  errores,
  conflictos,
  onEditar,
  onFinalizarEdicion,
  onCancelarCelda,
  onCopiarAnterior,
}: {
  filas: PlanSiembraFila[];
  marketShare: MarketShareGrilla | null;
  campania: string;
  editable: boolean;
  borrador: BorradorPlan;
  errores: Record<string, Partial<Record<Cultivo, string>>>;
  conflictos: Set<string>;
  onEditar: (fila: PlanSiembraFila, cultivo: Cultivo, texto: string) => void;
  onFinalizarEdicion: (fila: PlanSiembraFila) => void;
  onCancelarCelda: (fila: PlanSiembraFila, cultivo: Cultivo) => void;
  onCopiarAnterior: (fila: PlanSiembraFila) => void;
  onRecargarConflictos: () => void;
}) {
  const mensajeMarketShare =
    "Falta cargar Market Share de " + campania.slice(0, 4) + "/" + campania.slice(7);
  const columnas: Column<PlanSiembraFila>[] = [
    {
      key: "productor",
      header: "Productor",
      className: "sticky left-0 z-10 min-w-64 bg-panel shadow-[2px_0_4px_-3px_#2b4150]",
      headerClassName: "sticky left-0 z-30 min-w-64 bg-panel-soft shadow-[2px_0_4px_-3px_#2b4150]",
      cell: (fila) => (
        <div>
          <div className="font-semibold text-ink">{fila.razonSocial}</div>
          <div className="text-xs text-ink-soft">
            {fila.cuit} · {fila.cuentas.length} {fila.cuentas.length === 1 ? "cuenta" : "cuentas"} (
            {fila.cuentas.join(", ")})
          </div>
          {editable && fila.anterior && (
            <button
              type="button"
              onClick={() => onCopiarAnterior(fila)}
              className="mt-1 text-xs font-semibold text-ink underline decoration-primary underline-offset-2 hover:text-primary"
            >
              Usar campaña anterior
            </button>
          )}
        </div>
      ),
    },
    ...CULTIVOS.map(
      (cultivo): Column<PlanSiembraFila> => ({
        key: cultivo,
        header: cultivo === "maiz" ? "Maíz" : cultivo[0].toUpperCase() + cultivo.slice(1),
        align: "right",
        className: "min-w-28",
        cell: (fila) => (
          <CeldaHectareas
            productor={fila.razonSocial}
            cuit={fila.cuit}
            cultivo={cultivo}
            valor={planBase(fila, borrador)?.[cultivo] ?? null}
            texto={
              borrador[fila.cuit]?.textos[cultivo] ??
              textoHectareas(planBase(fila, borrador)?.[cultivo] ?? null)
            }
            anterior={fila.anterior?.[cultivo] ?? null}
            editable={editable}
            error={errores[fila.cuit]?.[cultivo]}
            onChange={(texto) => onEditar(fila, cultivo, texto)}
            onBlur={() => onFinalizarEdicion(fila)}
            onEscape={() => onCancelarCelda(fila, cultivo)}
          />
        ),
      }),
    ),
    {
      key: "total",
      header: "Total ha",
      align: "right",
      cell: (fila) => oDash(planCalculable(fila, borrador), (plan) => numero(totalHectareas(plan))),
    },
    {
      key: "mercado",
      header: "Mercado USD",
      align: "right",
      cell: (fila) => (
        <span title={marketShare ? undefined : mensajeMarketShare}>
          {oDash(mercadoUsd(planCalculable(fila, borrador), marketShare), usd)}
        </span>
      ),
    },
    {
      key: "potencial",
      header: "Potencial tn",
      align: "right",
      cell: (fila) => (
        <span title={marketShare ? undefined : mensajeMarketShare}>
          {oDash(potencialTn(planCalculable(fila, borrador), marketShare), tn)}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (fila) => {
        const estado = conflictos.has(fila.cuit)
          ? "Conflicto"
          : Object.keys(errores[fila.cuit] ?? {}).length > 0
            ? "Error"
            : cambiosDelPlan([fila], borrador).length > 0
              ? "Modificado"
              : "—";
        const titulo =
          fila.modificadoEl && fila.modificadoPor
            ? "Modificado por " +
              fila.modificadoPor +
              " el " +
              new Date(fila.modificadoEl).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined;
        return (
          <span
            title={titulo}
            className={
              estado === "Conflicto" || estado === "Error"
                ? "font-semibold text-rojo"
                : "text-ink-soft"
            }
          >
            {estado}
          </span>
        );
      },
    },
  ];
  return (
    <DataTable
      columns={columnas}
      rows={filas}
      getRowKey={(fila) => fila.cuit}
      empty="No hay productores para estos filtros."
      stickyHeader
      scrollClassName="max-h-[65vh] overflow-auto"
      rowClassName={(fila) =>
        conflictos.has(fila.cuit)
          ? "bg-red-50"
          : cambiosDelPlan([fila], borrador).length > 0
            ? "bg-amber-50"
            : ""
      }
    />
  );
}
