import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { FilterField } from "@/shared/components/filter-bar";
import { confirmacionPendiente } from "../lib/comandos";
import { useListado, useOperacion } from "../queries/use-logistica";
import type { CargaLogistica, CargaPropia, FichaFlotaDto } from "../types";
import { Elegir } from "./elegir";
import { Campo, FormOperacionFooter } from "./form-operacion";
import { TablaLogistica } from "./tabla-logistica";

/**
 * Lo propio de una carga: el camión del padrón de Flete y una observación. Patente, kilos y carta
 * de porte no se cargan acá: salen de MacroGest.
 */
export function CargaDialog({ carga, onClose }: { carga: CargaLogistica; onClose: () => void }) {
  const o = carga.otorgamiento.otorgamiento;
  const actual = carga.propio?.camion ?? null;
  const [elegido, setElegido] = useState<{ fichaId: string; versionId: string } | null>(
    actual ? { fichaId: actual.fichaId, versionId: actual.versionId } : null,
  );
  const [observacion, setObservacion] = useState(carga.propio?.observacion ?? "");
  const [buscar, setBuscar] = useState("");
  const camiones = useListado<FichaFlotaDto>(
    "cargas/camiones",
    { buscar: buscar.trim().length >= 2 ? buscar.trim() : undefined },
    (f) => ({ despuesId: f.id }),
  );
  const mutation = useOperacion<CargaPropia>(`cargas/${o.id}`, "put");
  const bloqueado = mutation.isPending || confirmacionPendiente(mutation.error);
  const cerrar = () => {
    if (!bloqueado) onClose();
  };
  return (
    <Modal open title="Camión y observación" onClose={cerrar} className="max-w-4xl">
      <p className="mb-4 text-sm text-ink-soft">
        Contrato {o.contrato}, plan {o.plan}, cupo {o.cupo}
        {carga.otorgamiento.erp?.codigoTerminal
          ? ` · ${carga.otorgamiento.erp.codigoTerminal}`
          : ""}
        . Carta de porte, patente y kilos se leen de MacroGest.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await mutation.mutateAsync({
              revision: carga.propio?.revision ?? null,
              fichaId: elegido?.fichaId ?? null,
              versionId: elegido?.versionId ?? null,
              observacion: observacion.trim() || null,
            });
            onClose();
          } catch {
            /* El pie muestra el error, con la misma clave para reintentar. */
          }
        }}
      >
        <fieldset disabled={bloqueado} className="space-y-4">
          {actual && (
            <p className="text-sm">
              Camión elegido: <strong>{actual.patenteChasis}</strong>
              {actual.conductor ? ` · ${actual.conductor}` : ""}
            </p>
          )}
          <FilterField label="Buscar camión">
            <Input
              className="max-w-sm"
              placeholder="Patente, conductor o transportista"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </FilterField>
          <TablaLogistica
            titulo="Camiones del padrón de Flete"
            filas={camiones.data?.pages.flatMap((p) => p.filas) ?? []}
            clave={(f) => f.id}
            elegida={(f) => elegido?.fichaId === f.id}
            cargando={camiones.isLoading}
            error={camiones.error}
            reintentar={() => void camiones.refetch()}
            hayMas={camiones.hasNextPage}
            mas={() => void camiones.fetchNextPage()}
            cargandoMas={camiones.isFetchingNextPage}
            vacio="No hay camiones activos en el padrón de Flete para esta búsqueda."
            columnas={[
              {
                titulo: "Elegir",
                celda: (f) => (
                  <Elegir
                    tipo="radio"
                    name="camion-carga"
                    etiqueta={`Elegir camión ${f.ficha.patenteChasis}`}
                    checked={elegido?.fichaId === f.id}
                    motivo={null}
                    // Un radio no se destilda solo: el segundo clic suelta el camión.
                    onClick={() => {
                      if (elegido?.fichaId === f.id) setElegido(null);
                    }}
                    onChange={() =>
                      // Si es el mismo camión ya guardado, se conserva su versión.
                      setElegido({
                        fichaId: f.id,
                        versionId: actual?.fichaId === f.id ? actual.versionId : f.versionId,
                      })
                    }
                  />
                ),
              },
              { titulo: "Patente", celda: (f) => f.ficha.patenteChasis },
              { titulo: "Acoplado", celda: (f) => f.ficha.patenteAcoplado ?? "—" },
              { titulo: "Conductor", celda: (f) => f.ficha.conductor ?? "—" },
              { titulo: "Transportista", celda: (f) => f.ficha.transportista ?? "—" },
            ]}
          />
          <Campo titulo="Observación (opcional)">
            <Textarea
              maxLength={500}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </Campo>
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          pending={mutation.isPending}
          onClose={cerrar}
          texto="Guardar carga"
        />
      </form>
    </Modal>
  );
}
