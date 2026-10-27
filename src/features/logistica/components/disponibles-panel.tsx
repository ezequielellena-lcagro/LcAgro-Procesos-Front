import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { ErrorState } from "@/shared/components/error-state";
import { KpiCard } from "@/shared/components/kpi-card";
import { campania as formatoCampania, fecha, kg } from "../format";
import { useListado } from "../queries/use-logistica";
import type { CupoPlanta0 } from "../types";
import { TablaLogistica } from "./tabla-logistica";

interface PorCereal {
  producto: number | null;
  productoNombre: string | null;
  campania: number | null;
  cupos: number;
}
interface PorPlanta {
  planta: number | null;
  cupos: number;
  conCartaPorte: number;
}
interface Disponibles {
  porCereal: PorCereal[];
  porPlanta: PorPlanta[];
  vencidosSinUsar: number;
  desde: string;
  kgPorCupo: number;
  datosAl: string;
}

/**
 * Qué significa cada planta, según el modelo que el área usuaria dejó escrito en su propio mockup:
 * «Disponible = el cupo está en Planta 0, sin asignar. Otorgado = el cupo pasó a Planta 10 /
 * Directa. Planta 15 es carga propia y no forma parte del otorgamiento a cliente.»
 */
const PLANTAS: Record<number, string> = {
  0: "Disponibles · sin asignar",
  10: "Otorgados · Directa",
  15: "Carga propia",
  20: "Semillero",
};

const cantidad = (n: number) => new Intl.NumberFormat("es-AR").format(n);

/**
 * Cuántos cupos hay, por cereal. Es lo primero que el área usuaria pidió ver al entrar a Cupos, tres
 * veces en la misma reunión: «que tome lo que era planta 0 y ponga el total: tanto de maíz, tanto de
 * soja, tanto de trigo».
 *
 * <p>Disponible = planta 0 con fecha de carga de hoy en adelante (decisión del 2026-10-27). Los de
 * fecha pasada que nunca cargaron se cuentan aparte para que los den de baja en MacroGest.</p>
 */
export function DisponiblesPanel({
  producto,
  campania,
  activo,
}: {
  producto?: number;
  /** Campaña en formato de pantalla (`2025-2026`); vacío = todas. */
  campania?: string;
  activo: boolean;
}) {
  const [verVencidos, setVerVencidos] = useState(false);
  const campaniaErp = /^\d{4}-\d{4}$/.test(campania ?? "")
    ? Number(campania!.replace("-", ""))
    : undefined;
  const q = useQuery({
    queryKey: ["logistica", "cupos/disponibles", { producto, campaniaErp }],
    enabled: activo,
    retry: false,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Disponibles>("/logistica/cupos/disponibles", {
          params: { producto, campania: campaniaErp },
          signal,
        })
      ).data,
  });
  const vencidos = useListado<CupoPlanta0>(
    "cupos/planta-0",
    { vencidos: true, producto, campania: campaniaErp },
    (f) => ({
      despuesFecha: f.fechaCarga,
      despuesContrato: f.contrato,
      despuesPlan: f.plan,
      despuesCupo: f.cupo,
    }),
    activo && verVencidos,
  );

  const porCereal = q.data?.porCereal ?? [];
  const totalDisponibles = porCereal.reduce((a, c) => a + c.cupos, 0);
  const porPlanta = q.data?.porPlanta ?? [];

  return (
    <section aria-label="Cupos disponibles" className="min-w-0 space-y-3">
      <div>
        <h2 className="font-display text-xl text-ink">Cupos disponibles</h2>
        <p className="text-xs text-ink-soft">
          Cupos en planta 0 con fecha de carga de hoy
          {q.data ? ` (${fecha(q.data.desde)})` : ""} en adelante, por cereal. MacroGest · solo
          lectura.
        </p>
      </div>

      {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}

      {q.isLoading && (
        <p role="status" className="text-sm text-ink-soft">
          Consultando…
        </p>
      )}

      {q.data &&
        (porCereal.length === 0 ? (
          <p className="rounded-card border border-line bg-panel p-4 text-sm text-ink-soft shadow-card">
            No hay cupos disponibles en planta 0 de hoy en adelante. Los que ya se otorgaron están
            en planta 10.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard
              label="Total disponibles"
              value={cantidad(totalDisponibles)}
              hint={`${kg(totalDisponibles * q.data.kgPorCupo)} estimados`}
              tone={totalDisponibles > 0 ? "verde" : "default"}
            />
            {porCereal.map((c) => (
              <KpiCard
                key={`${c.producto ?? "sin"}/${c.campania ?? "sin"}`}
                label={c.productoNombre ?? "Sin cereal en MacroGest"}
                value={cantidad(c.cupos)}
                hint={`${formatoCampania(c.campania)} · ${kg(c.cupos * q.data!.kgPorCupo)} estimados`}
              />
            ))}
          </div>
        ))}

      {q.data && q.data.vencidosSinUsar > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-panel p-3 text-sm"
        >
          <span>
            <strong>{cantidad(q.data.vencidosSinUsar)} vencidos sin usar</strong>: cupos de planta 0
            con fecha de carga pasada y sin carta de porte. Hay que darlos de baja en MacroGest.
          </span>
          <Button size="sm" variant="outline" onClick={() => setVerVencidos((v) => !v)}>
            {verVencidos ? "Ocultar vencidos" : "Ver vencidos"}
          </Button>
        </div>
      )}
      {verVencidos && (
        <TablaLogistica
          titulo="Cupos vencidos sin usar"
          filas={vencidos.data?.pages.flatMap((p) => p.filas) ?? []}
          clave={(f) => `${f.contrato}/${f.plan}/${f.cupo}`}
          cargando={vencidos.isLoading}
          error={vencidos.error}
          reintentar={() => void vencidos.refetch()}
          hayMas={vencidos.hasNextPage}
          mas={() => void vencidos.fetchNextPage()}
          cargandoMas={vencidos.isFetchingNextPage}
          vacio="No hay cupos vencidos sin usar."
          columnas={[
            { titulo: "Contrato", celda: (f) => f.contrato },
            { titulo: "Plan / cupo", celda: (f) => `${f.plan} / ${f.cupo}` },
            { titulo: "Código otorgado", celda: (f) => f.codigoTerminal || "Sin código" },
            { titulo: "Fecha de carga", celda: (f) => fecha(f.fechaCarga) },
            { titulo: "Destino", celda: (f) => f.destinoNombre ?? f.destinoCodigo ?? "—" },
            {
              titulo: "Cereal / campaña",
              celda: (f) => `${f.productoNombre ?? f.producto ?? "—"} / ${f.campania ?? "—"}`,
            },
          ]}
        />
      )}

      {/* El estado del cupo ES la planta, así que este desglose dice en qué estado está cada uno. */}
      {porPlanta.length > 0 && (
        <p className="text-xs text-ink-soft">
          De hoy en adelante:{" "}
          {porPlanta
            .filter((p) => p.planta !== null)
            .map(
              (p) => `Planta ${p.planta} (${PLANTAS[p.planta!] ?? "otra"}): ${cantidad(p.cupos)}`,
            )
            .join(" · ")}
          .
        </p>
      )}

      <p className="text-xs text-ink-soft">
        La estimación usa {kg(q.data?.kgPorCupo ?? 30000)} por cupo; no es peso real. Un cupo sin
        contrato en MacroGest aparece como «Sin cereal» en vez de ocultarse.
      </p>
    </section>
  );
}
