import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/shared/components/error-state";
import { fechaHoraArgentina } from "../format";
import { camposHistorial, type CampoHistorial } from "../lib/historial";
import { useHistoria } from "../queries/use-logistica";
import type { Evento } from "../types";

/** Qué pasó, en castellano. Lo que no está acá se muestra con el tipo legible. */
const ACCIONES: Record<string, string> = {
  solicitud_creada: "Pedido de cupo registrado",
  solicitud_cerrada: "Pedido de cupo cerrado",
  respuesta_registrada: "Respuesta de la terminal",
  pedido_creado: "Pedido creado",
  pedido_corregido: "Pedido corregido",
  pedido_eliminado: "Pedido eliminado",
  cupos_otorgados: "Cupos vinculados",
  otorgamiento_creado: "Cupo vinculado al pedido",
  otorgamiento_deshecho: "Cupo desvinculado del pedido",
  carga_guardada: "Datos de la carga guardados",
  ficha_flota_creada: "Ficha creada",
  ficha_flota_editada: "Ficha editada",
  ficha_flota_baja: "Ficha dada de baja",
};

const TITULOS: Record<string, string> = {
  pedidos: "Historial del pedido",
  "solicitudes-terminal": "Historial del pedido de cupo",
  otorgamientos: "Historial del cupo vinculado",
  cargas: "Historial de la carga",
  flota: "Historial de la ficha",
};

/**
 * Identificadores y metadatos que ya están en la cabecera del evento (fecha, autor) o que no le
 * dicen nada a quien opera (revisiones, ids de versión).
 */
const OCULTOS = new Set([
  "Revisión",
  "Revisión de la ficha",
  "ID de versión",
  "Ficha elegida",
  "Versión elegida",
  "Autor del registro",
  "Momento de registro (Argentina)",
]);

function accion(tipo: string) {
  const texto = tipo.replaceAll("_", " ");
  return ACCIONES[tipo] ?? texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * En un alta no hay «antes»: se muestra sólo lo cargado. En un cambio, sólo lo que cambió, como
 * antes → ahora. Antes salían todos los campos con su «Sin dato», y lo importante se perdía.
 */
function CamposEvento({ evento, recurso }: { evento: Evento; recurso: string }) {
  const campos = camposHistorial(evento.datos, recurso).filter(
    (c) => !OCULTOS.has(c.campo) && !(c.campo === "Motivo" && evento.motivo),
  );
  const alta = campos.every((c) => c.anterior === "Sin dato");
  const visibles: CampoHistorial[] = alta
    ? campos.filter((c) => c.nuevo !== "Sin dato")
    : campos.filter((c) => c.anterior !== c.nuevo);
  if (!visibles.length)
    return <p className="mt-2 text-xs text-ink-soft">Sin cambios en los datos.</p>;
  return (
    <dl className="mt-3 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
      {visibles.map((c) => (
        <div key={c.campo} className="contents">
          <dt className="text-ink-soft">{c.campo}</dt>
          <dd className="text-ink">
            {alta ? (
              c.nuevo
            ) : (
              <>
                <span className="text-ink-soft line-through">{c.anterior}</span>
                <span aria-hidden> → </span>
                <span className="sr-only"> pasó a </span>
                <span className="font-medium">{c.nuevo}</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Historial de un registro como línea de tiempo: qué pasó, cuándo, quién y con qué motivo, y
 * debajo los datos de ese paso.
 */
export function HistorialDialog({
  recurso,
  id,
  descripcion,
  onClose,
}: {
  recurso: string;
  id: string;
  /** Qué registro es, en una línea (contrato, cliente, fecha…). */
  descripcion?: string;
  onClose: () => void;
}) {
  const q = useHistoria(recurso, id);
  const eventos = q.data?.pages.flatMap((p) => p.filas) ?? [];
  return (
    <Modal open title={TITULOS[recurso] ?? "Historial"} onClose={onClose} className="max-w-2xl">
      {descripcion && <p className="mb-4 text-sm text-ink-soft">{descripcion}</p>}
      {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {q.isLoading && (
        <p role="status" className="text-sm text-ink-soft">
          Consultando…
        </p>
      )}
      {q.data && !eventos.length && (
        <p className="text-sm text-ink-soft">Todavía no hay movimientos registrados.</p>
      )}
      <ol aria-label="Movimientos" className="relative space-y-3 border-l border-line pl-5">
        {eventos.map((e) => (
          <li key={e.id} className="relative">
            <span
              aria-hidden
              className="absolute top-2 -left-[25px] size-2.5 rounded-full border-2 border-panel bg-primary"
            />
            <article className="rounded-card border border-line bg-panel p-4 shadow-card">
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-medium text-ink">{accion(e.tipo)}</h3>
                <p className="text-xs text-ink-soft">
                  {fechaHoraArgentina(e.registradoAl)} ·{" "}
                  {e.registradoPorNombre ?? `Usuario ${e.registradoPorId}`}
                </p>
              </header>
              {e.motivo && (
                <p className="mt-2 text-sm text-ink">
                  <span className="text-ink-soft">Motivo: </span>
                  {e.motivo}
                </p>
              )}
              <CamposEvento evento={e} recurso={recurso} />
            </article>
          </li>
        ))}
      </ol>
      {q.hasNextPage && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={q.isFetchingNextPage}
            onClick={() => void q.fetchNextPage()}
          >
            {q.isFetchingNextPage ? "Cargando…" : "Ver más movimientos"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
