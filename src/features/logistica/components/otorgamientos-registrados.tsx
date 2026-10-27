import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { diaArgentina, fecha, fechaInstanteArgentina, hoy, sumarDias } from "../format";
import { useListado, useOperacion } from "../queries/use-logistica";
import type { DeshacerResultado, EstadoOtorgamiento, OtorgamientoConEstado } from "../types";
import { Campo, FormOperacionFooter } from "./form-operacion";
import { HistorialDialog } from "./historial-dialog";
import { PeriodoFiltro } from "./periodo-filtro";
import { PlanCargaBoton } from "./plan-carga-boton";
import { TablaLogistica } from "./tabla-logistica";

/** Cómo se lee cada estado: sale de MacroGest en cada consulta, no se guarda. */
const ESTADO: Record<EstadoOtorgamiento, string> = {
  pendiente: "Falta pasarlo en MacroGest",
  confirmado: "Confirmado en MacroGest",
  otro_productor: "Otro productor en MacroGest",
  otra_planta: "Otra planta en MacroGest",
  no_esta: "Ya no está en MacroGest",
  deshecho: "Deshecho",
  sin_verificar: "Sin verificar",
};
const AVISO: EstadoOtorgamiento[] = ["otro_productor", "otra_planta", "no_esta", "sin_verificar"];

/**
 * Otorgamientos registrados en la app con su estado leído de MacroGest. El operador pasa el plan a
 * planta 10 (o 15 si es propio) a mano; acá se ve cuándo quedó confirmado o si MacroGest muestra
 * otra cosa. Deshacer cierra el otorgamiento y libera el cupo; el cambio en MacroGest sigue siendo
 * a mano.
 */
export function OtorgamientosRegistrados({
  gestionar,
  bloqueado,
}: {
  gestionar: boolean;
  bloqueado: boolean;
}) {
  const [periodo, setPeriodo] = useState(() => ({
    desde: sumarDias(hoy(), -30),
    hastaExclusivo: sumarDias(hoy(), 1),
  }));
  const [deshechos, setDeshechos] = useState(false);
  const [deshacer, setDeshacer] = useState<OtorgamientoConEstado | null>(null);
  const [historia, setHistoria] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const lista = useListado<OtorgamientoConEstado>(
    "otorgamientos",
    { ...periodo, deshechos },
    (f) => ({
      despuesDia: diaArgentina(f.otorgamiento.vigenteDesde),
      despuesId: f.otorgamiento.id,
    }),
  );
  const filas = lista.data?.pages.flatMap((p) => p.filas) ?? [];
  return (
    <section
      aria-label="Otorgamientos registrados"
      className="min-w-0 space-y-3 border-t border-line pt-4"
    >
      <div>
        <h2 className="font-display text-xl text-ink">Otorgamientos registrados</h2>
        <p className="text-xs text-ink-soft">
          Lo otorgado en la app y lo que dice hoy MacroGest de cada cupo. Se confirma solo cuando el
          plan pasa a planta 10 con el mismo productor (o a planta 15 si es propio).
        </p>
      </div>
      <PeriodoFiltro
        value={periodo}
        etiqueta="Fecha de otorgamiento"
        onChange={setPeriodo}
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={deshechos}
            onChange={(e) => setDeshechos(e.target.checked)}
          />
          Ver deshechos
        </label>
      </PeriodoFiltro>
      {avisos.length > 0 && (
        <ul role="status" className="list-disc pl-5 text-sm text-ink-soft">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <TablaLogistica
        titulo="Otorgamientos registrados en la app"
        filas={filas}
        clave={(f) => f.otorgamiento.id}
        cargando={lista.isLoading}
        error={lista.error}
        reintentar={() => void lista.refetch()}
        hayMas={lista.hasNextPage}
        mas={() => void lista.fetchNextPage()}
        cargandoMas={lista.isFetchingNextPage}
        vacio={
          deshechos
            ? "No hay otorgamientos deshechos en estas fechas."
            : "No hay otorgamientos vigentes en estas fechas."
        }
        columnas={[
          { titulo: "Otorgado", celda: (f) => fechaInstanteArgentina(f.otorgamiento.vigenteDesde) },
          { titulo: "Contrato", celda: (f) => f.otorgamiento.contrato },
          {
            titulo: "Plan / cupo",
            celda: (f) => `${f.otorgamiento.plan} / ${f.otorgamiento.cupo}`,
          },
          { titulo: "Código otorgado", celda: (f) => f.erp?.codigoTerminal || "—" },
          {
            titulo: "Fecha de carga",
            celda: (f) => (f.erp?.fechaCarga ? fecha(f.erp.fechaCarga) : "—"),
          },
          {
            titulo: "Destinatario",
            celda: (f) =>
              f.otorgamiento.destinatarioTipo === "propio"
                ? "Propio"
                : (f.otorgamiento.clienteNombre ?? `Cliente ${f.otorgamiento.clienteNumero}`),
          },
          {
            titulo: "MacroGest",
            celda: (f) => (
              <span>
                <span className={AVISO.includes(f.estado) ? "font-medium text-rojo" : undefined}>
                  {ESTADO[f.estado]}
                </span>
                <span className="block text-xs text-ink-soft">
                  {f.detalle}
                  {f.estado === "otro_productor" && f.productorPlanNombre
                    ? ` (${f.productorPlanNombre})`
                    : ""}
                </span>
              </span>
            ),
          },
          {
            titulo: "Acciones",
            celda: (f) => (
              <div className="flex flex-wrap gap-1">
                {gestionar && !f.otorgamiento.vigenteHasta && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bloqueado}
                    onClick={() => setDeshacer(f)}
                  >
                    Deshacer
                  </Button>
                )}
                {!f.otorgamiento.vigenteHasta && (
                  <PlanCargaBoton otorgamientoId={f.otorgamiento.id} variant="ghost" />
                )}
                <Button size="sm" variant="ghost" onClick={() => setHistoria(f.otorgamiento.id)}>
                  Historial
                </Button>
              </div>
            ),
          },
        ]}
      />
      {deshacer && (
        <DeshacerDialog
          fila={deshacer}
          onClose={() => setDeshacer(null)}
          onSuccess={(r) => {
            setDeshacer(null);
            setAvisos(r.advertencias);
          }}
        />
      )}
      {historia && (
        <HistorialDialog recurso="otorgamientos" id={historia} onClose={() => setHistoria(null)} />
      )}
    </section>
  );
}

function DeshacerDialog({
  fila,
  onClose,
  onSuccess,
}: {
  fila: OtorgamientoConEstado;
  onClose: () => void;
  onSuccess: (r: DeshacerResultado) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [invalido, setInvalido] = useState(false);
  const mutation = useOperacion<DeshacerResultado>(
    `otorgamientos/${fila.otorgamiento.id}/deshacer`,
  );
  const o = fila.otorgamiento;
  return (
    <Modal open title="Deshacer otorgamiento" onClose={() => !mutation.isPending && onClose()}>
      <p className="mb-3 text-sm text-ink-soft">
        Contrato {o.contrato}, plan {o.plan}, cupo {o.cupo}. El cupo vuelve a quedar libre en la app
        y, si era de un pedido, el pedido recupera ese pendiente.
        {fila.estado !== "pendiente" &&
          " En MacroGest ya no está en planta 0: después de deshacer, volvé el plan a planta 0 a mano."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!motivo.trim()) {
            setInvalido(true);
            return;
          }
          try {
            onSuccess(await mutation.mutateAsync({ revision: o.revision, motivo: motivo.trim() }));
          } catch {
            // El pie muestra el error del servidor.
          }
        }}
      >
        <Campo titulo="Motivo">
          <Textarea
            maxLength={500}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setInvalido(false);
            }}
          />
        </Campo>
        <FormOperacionFooter
          error={mutation.error}
          invalid={invalido}
          pending={mutation.isPending}
          onClose={onClose}
          texto="Deshacer otorgamiento"
        />
      </form>
    </Modal>
  );
}
