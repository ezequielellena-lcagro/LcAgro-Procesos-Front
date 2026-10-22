import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { campania as formatoCampania, fecha, kg } from "../format";
import type { Pagina, Preventa } from "../types";
import { TablaLogistica } from "./tabla-logistica";

/** Días entre hoy y una fecha ISO: positivo = ya pasó, negativo = falta. */
function dias(desde: string | null): number | null {
  if (!desde) return null;
  const d = new Date(`${desde.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const hoy = new Date();
  return Math.round((Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12) - d.getTime()) / 86400000);
}

/**
 * Semáforo de la cola, con los cortes del mockup del área usuaria: rojo arriba de 180 días vencido,
 * naranja entre 90 y 180. Debajo de 90 no se pinta: casi todo el período de entrega es normal.
 */
function Vencimiento({ desde }: { desde: string | null }) {
  const d = dias(desde);
  if (d === null) return <span className="text-ink-soft">Sin período</span>;
  const tono = d > 180 ? "text-rojo" : d >= 90 ? "text-clementina-deep" : "text-ink-soft";
  return (
    <span className={`whitespace-nowrap font-medium ${tono}`}>
      {d > 180 ? "● " : d >= 90 ? "● " : ""}
      {d} {d === 1 ? "día" : "días"}
    </span>
  );
}

function Proximidad({ desde }: { desde: string | null }) {
  const d = dias(desde);
  if (d === null) return <span className="text-ink-soft">Sin período</span>;
  const faltan = -d;
  return (
    <span className={`whitespace-nowrap ${faltan <= 15 ? "font-medium text-ink" : "text-ink-soft"}`}>
      {faltan <= 0 ? "Empieza hoy" : `En ${faltan} ${faltan === 1 ? "día" : "días"}`}
    </span>
  );
}

function useCola(campania: number | null, producto: number | undefined, vencidas: boolean, activo: boolean) {
  return useQuery({
    queryKey: ["logistica", "preventas/cola", { campania, producto, vencidas }],
    enabled: activo && campania !== null,
    retry: false,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Pagina<Preventa>>("/logistica/preventas/cola", {
          params: { campania, producto, vencidas, tamano: 50 },
          signal,
        })
      ).data,
  });
}

const columnas = (conPrioridad: boolean) => [
  ...(conPrioridad
    ? [
        {
          titulo: "Prioridad",
          numero: true,
          celda: (_f: Preventa, i: number) => String(i + 1),
        },
      ]
    : []),
  { titulo: "N° negocio", celda: (f: Preventa) => f.numero },
  {
    titulo: "Productor",
    celda: (f: Preventa) => (
      <span>
        {f.clienteNombre ?? "Nombre no disponible"}
        <span className="block text-xs text-ink-soft">Cliente {f.clienteNumero ?? "sin dato"}</span>
      </span>
    ),
  },
  {
    titulo: "Cereal / campaña",
    celda: (f: Preventa) =>
      `${f.productoNombre ?? f.producto ?? "Sin cereal"} / ${formatoCampania(f.campania)}`,
  },
  {
    titulo: "Período de entrega",
    celda: (f: Preventa) => `${fecha(f.fechaEntregaInicio)} — ${fecha(f.fechaEntregaFin)}`,
  },
  { titulo: "Contratado", numero: true, celda: (f: Preventa) => kg(f.kgContratados) },
];

/**
 * Cola de prioridad de entrega, con el criterio que el área usuaria ya venía usando en su planilla:
 * preventas **fijadas** con entrega **pendiente**, ordenadas por el inicio del período de entrega —
 * lo más viejo sin entregar, primero.
 *
 * <p>Son dos listados porque es la misma consulta partida por hoy: lo que ya tendría que haberse
 * entregado (la cola, con semáforo de vencimiento) y lo que todavía no vence (para planificar).
 * Sale de MacroGest, así que aparece aunque nadie haya registrado un pedido en la app.</p>
 *
 * <p>La campaña es obligatoria: sin ella la cola arrastra negocios de 2014 a 2019 con más de 3.000
 * días de vencimiento.</p>
 */
export function ColaPrioridad({
  campania,
  producto,
  activo,
}: {
  /** Campaña en formato ERP (20252026); `null` = todavía no se eligió ninguna. */
  campania: number | null;
  producto?: number;
  activo: boolean;
}) {
  const vencidas = useCola(campania, producto, true, activo);
  const proximas = useCola(campania, producto, false, activo);

  if (campania === null)
    return (
      <p className="rounded-card border border-line bg-panel p-4 text-sm text-ink-soft shadow-card">
        Elegí una campaña en los filtros para ver la cola de prioridad de entrega. Sin campaña la
        cola arrastra negocios viejos que ya nadie va a entregar.
      </p>
    );

  return (
    <div className="min-w-0 space-y-5">
      <div className="min-w-0 space-y-2">
        <h2 className="font-display text-xl text-ink">Cola de prioridad de entrega</h2>
        <p className="text-xs text-ink-soft">
          Preventas fijadas con entrega pendiente cuyo período ya empezó, de la más vieja a la más
          nueva. MacroGest · solo lectura.
        </p>
        <TablaLogistica
          titulo="Cola de prioridad de entrega"
          filas={vencidas.data?.filas ?? []}
          clave={(f) => `${f.operacion}/${f.numero}`}
          cargando={vencidas.isLoading}
          error={vencidas.error}
          reintentar={() => void vencidas.refetch()}
          vacio="No hay preventas vencidas sin entregar para esta campaña."
          columnas={[
            ...columnas(true),
            { titulo: "Vencido hace", celda: (f) => <Vencimiento desde={f.fechaEntregaInicio} /> },
          ]}
        />
      </div>

      <div className="min-w-0 space-y-2">
        <h2 className="font-display text-xl text-ink">Vigentes y próximos</h2>
        <p className="text-xs text-ink-soft">
          Mismo criterio, con el período de entrega todavía por empezar. Sirve para ir reservando
          cupo con anticipación.
        </p>
        <TablaLogistica
          titulo="Preventas vigentes y próximas"
          filas={proximas.data?.filas ?? []}
          clave={(f) => `${f.operacion}/${f.numero}`}
          cargando={proximas.isLoading}
          error={proximas.error}
          reintentar={() => void proximas.refetch()}
          vacio="No hay preventas con entrega futura para esta campaña."
          columnas={[
            ...columnas(false),
            { titulo: "Cuándo", celda: (f) => <Proximidad desde={f.fechaEntregaInicio} /> },
          ]}
        />
      </div>

      <p className="text-xs text-ink-soft">
        Falta la columna <strong>Pendiente por otorgar</strong>: los cupos ya otorgados no salen por
        negocio en MacroGest —a un mismo productor se le otorgan contra distintos contratos—, así que
        hay que cruzarlos por productor + cereal + campaña. Queda para la pantalla de disponibles.
      </p>
    </div>
  );
}
