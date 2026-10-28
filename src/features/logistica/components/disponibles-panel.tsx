import { fecha, hoy } from "../format";
import { useListado } from "../queries/use-logistica";
import type { CupoPlanta0 } from "../types";
import { TablaLogistica } from "./tabla-logistica";

/**
 * Los cupos de planta 0 de MacroGest, uno por uno y de todas las fechas, del más nuevo al más viejo.
 * Antes eran tarjetas por cereal y sólo de hoy en adelante; se pidió el listado completo
 * (2026-10-28): lo que esté en planta 0 en MacroGest se ve, aunque la fecha ya haya pasado.
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
  const campaniaErp = /^\d{4}-\d{4}$/.test(campania ?? "")
    ? Number(campania!.replace("-", ""))
    : undefined;
  const lista = useListado<CupoPlanta0>(
    "cupos/planta-0",
    { todasLasFechas: true, producto, campania: campaniaErp },
    (f) => ({
      despuesFecha: f.fechaCarga,
      despuesContrato: f.contrato,
      despuesPlan: f.plan,
      despuesCupo: f.cupo,
    }),
    activo,
  );
  const dia = hoy();
  return (
    <section aria-label="Cupos disponibles" className="min-w-0 space-y-3">
      <h2 className="font-display text-xl text-ink">Cupos disponibles</h2>
      <TablaLogistica
        titulo="Cupos disponibles en planta 0"
        filas={lista.data?.pages.flatMap((p) => p.filas) ?? []}
        clave={(f) => `${f.contrato}/${f.plan}/${f.cupo}`}
        cargando={lista.isLoading}
        error={lista.error}
        reintentar={() => void lista.refetch()}
        hayMas={lista.hasNextPage}
        mas={() => void lista.fetchNextPage()}
        cargandoMas={lista.isFetchingNextPage}
        vacio="No hay cupos en planta 0 para estos filtros."
        columnas={[
          {
            titulo: "Cereal / campaña",
            celda: (f) =>
              `${f.productoNombre ?? f.producto ?? "Sin cereal"} / ${f.campania ?? "—"}`,
          },
          { titulo: "Contrato", celda: (f) => f.contrato },
          { titulo: "Plan / cupo", celda: (f) => `${f.plan} / ${f.cupo}` },
          { titulo: "Código otorgado", celda: (f) => f.codigoTerminal || "Sin código" },
          {
            titulo: "Fecha de carga",
            celda: (f) =>
              f.fechaCarga && f.fechaCarga.slice(0, 10) < dia ? (
                <span className="whitespace-nowrap text-rojo">{fecha(f.fechaCarga)} · vencido</span>
              ) : (
                fecha(f.fechaCarga)
              ),
          },
          { titulo: "Destino", celda: (f) => f.destinoNombre ?? f.destinoCodigo ?? "—" },
          {
            titulo: "En la app",
            celda: (f) =>
              f.otorgamientoVigente
                ? `Otorgado a ${f.otorgamientoVigente.clienteNombre ?? `cliente ${f.otorgamientoVigente.clienteNumero}`}; falta pasarlo en MacroGest`
                : "Libre",
          },
        ]}
      />
    </section>
  );
}
