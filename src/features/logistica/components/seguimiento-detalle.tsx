import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { fecha, fechaHoraArgentina } from "../format";
import { textoPresente } from "../lib/conciliacion";
import {
  datoVigente,
  destinatarioSeguimiento,
  DATO_LABEL,
  ESTADO_LABEL,
  FUENTE_LABEL,
  identificacionSeguimiento,
  diferenciaPeso,
  kgErp,
  kgOperativos,
} from "../lib/seguimiento";
import { useDetalleConOrigen, useSeguimientoDetalle } from "../queries/use-logistica";
import type { CupoErp, DatoOperativo, Seguimiento, TipoDatoOperativo } from "../types";
import { TablaLogistica } from "./tabla-logistica";
import { columnasCamion } from "../lib/flota-seguimiento";
import type { EdicionSeguimiento } from "./seguimiento-dialog";

export function SeguimientoDetalle({
  cupoId,
  gestionar,
  gestionarVinculos = false,
  onVincular,
  onReemplazar,
  onRetirar,
  onClose,
  onEditar,
  onHistoria,
  onElegirCamion,
  onRetirarCamion,
}: {
  cupoId: string;
  gestionar: boolean;
  gestionarVinculos?: boolean;
  onVincular?: (snapshot: Seguimiento) => void;
  onReemplazar?: (snapshot: Seguimiento) => void;
  onRetirar?: (snapshot: Seguimiento) => void;
  onClose: () => void;
  onEditar: (snapshot: Seguimiento, modo: EdicionSeguimiento) => void;
  onHistoria: () => void;
  onElegirCamion?: (snapshot: Seguimiento) => void;
  onRetirarCamion?: (snapshot: Seguimiento) => void;
}) {
  const q = useSeguimientoDetalle<Seguimiento>(`seguimientos/${cupoId}`);
  const s = q.data?.dato;
  const lecturaActual = q.isFetchedAfterMount && !q.isFetching && q.error == null;
  const editar = (modo: EdicionSeguimiento) => {
    if (lecturaActual && s && gestionar && !s.anuladoAl) onEditar(structuredClone(s), modo);
  };
  const link = s?.vinculoErpVigente;
  const erp = useDetalleConOrigen<CupoErp>(
    "cupos/macrogest/detalle",
    link ? { contrato: link.contrato, grupo: link.grupo, cupo: link.cupo } : {},
    !!link && lecturaActual,
  );
  // Datos cacheados anteriores no representan una lectura ERP fallida actual.
  const oficial = lecturaActual && erp.error == null ? erp.data?.dato : undefined;
  const tipos: TipoDatoOperativo[] = ["patente", "kg_carga", "kg_descarga"];
  const filas: { tipo: TipoDatoOperativo; dato?: DatoOperativo; erp: string | number | null }[] =
    tipos.map((tipo) => ({
      tipo,
      dato: s ? datoVigente(s, tipo) : undefined,
      erp:
        tipo === "patente"
          ? (oficial?.patenteChasis ?? null)
          : tipo === "kg_carga"
            ? (oficial?.kgCargaErp ?? null)
            : (oficial?.kgDescargaErp ?? null),
    }));
  return (
    <Modal open title="Detalle de seguimiento" onClose={onClose} className="max-w-7xl">
      {q.error != null && (
        <p role="alert" className="mb-3 text-rojo">
          {toAppError(q.error).message}
          <Button variant="outline" onClick={() => void q.refetch()}>
            Reintentar detalle
          </Button>
        </p>
      )}
      {q.isFetching && <p role="status">Consultando seguimiento actualizado…</p>}
      {s && !lecturaActual && (
        <p className="mb-3 text-sm text-ink-soft">
          Datos de una consulta anterior. La edición requiere una lectura actual exitosa.
        </p>
      )}
      {s && (
        <>
          <p className="mb-4 text-sm text-ink-soft">{identificacionSeguimiento(s)}</p>
          <TablaLogistica
            titulo="Asignación y estado del seguimiento"
            filas={[s]}
            clave={(f) => f.cupoId}
            columnas={[
              { titulo: "Fecha prevista de carga", celda: (f) => fecha(f.cupo.fechaCarga) },
              { titulo: "Destinatario", celda: destinatarioSeguimiento },
              {
                titulo: "Pedido",
                celda: (f) =>
                  f.cupo.otorgamientoVigente?.pedidoId ? "Asignado a pedido" : "Sin pedido",
              },
              { titulo: "Estado observado", celda: (f) => ESTADO_LABEL[f.estadoObservado] },
              {
                titulo: "Fuente",
                celda: (f) => (f.estadoFuente ? FUENTE_LABEL[f.estadoFuente] : "Pendiente"),
              },
              {
                titulo: "Momento observado (Argentina)",
                celda: (f) => fechaHoraArgentina(f.estadoObservadoAl),
              },
              { titulo: "Referencia", celda: (f) => f.estadoReferencia ?? "Pendiente" },
            ]}
          />
          {s.anuladoAl && (
            <p className="my-3 text-sm text-rojo">
              Anulado el {fechaHoraArgentina(s.anuladoAl)} por Usuario {s.anuladoPorId}.{" "}
              {s.motivoAnulacion}
            </p>
          )}
          <h3 className="mb-3 mt-5 font-display text-lg">Camión elegido</h3>
          <TablaLogistica
            titulo="Camión elegido"
            filas={s.flotaVigente ? [s.flotaVigente] : []}
            clave={(f) => f.versionId}
            columnas={columnasCamion()}
            vacio="Sin camión elegido"
          />
          {s.flotaVigente && (
            <p className="mt-3 text-sm text-ink-soft">
              Ficha propia elegida para este viaje. Se conserva la versión histórica y su importe de
              referencia manual.
            </p>
          )}
          <h3 className="mb-3 mt-5 font-display text-lg">Observaciones operativas y MacroGest</h3>
          {!link && (
            <p className="mb-3 text-sm text-ink-soft">
              Vínculo con MacroGest pendiente. Los datos operativos se conservan.
            </p>
          )}
          {link && (
            <p className="mb-3 text-sm text-ink-soft">
              Vínculo vigente: {link.contrato} / grupo {link.grupo} / cupo {link.cupo}. Evidencia:{" "}
              {link.evidencia}.
            </p>
          )}
          {erp.isLoading && link && (
            <p role="status" className="mb-3 text-sm">
              Consultando MacroGest…
            </p>
          )}
          {erp.error != null && (
            <p role="alert" className="mb-3 text-sm text-rojo">
              {toAppError(erp.error).status === 404
                ? "El vínculo exacto no se encontró en MacroGest."
                : "MacroGest no está disponible."}{" "}
              Los datos operativos y el vínculo se conservan.
              <Button variant="outline" size="sm" onClick={() => void erp.refetch()}>
                Reintentar MacroGest
              </Button>
            </p>
          )}
          {oficial && (
            <p className="mb-3 text-xs text-ink-soft">
              MacroGest · sólo lectura · consultado al {fechaHoraArgentina(erp.data!.datosAl)}{" "}
              (Argentina).
            </p>
          )}
          <TablaLogistica
            titulo="Comparación por fuente"
            filas={filas}
            clave={(f) => f.tipo}
            columnas={[
              { titulo: "Dato", celda: (f) => DATO_LABEL[f.tipo] },
              {
                titulo: "Operativo",
                numero: true,
                celda: (f) =>
                  !f.dato
                    ? "Pendiente"
                    : f.tipo === "patente"
                      ? f.dato.texto
                      : kgOperativos(f.dato.kilogramos),
              },
              {
                titulo: "Fuente operativa",
                celda: (f) => (f.dato ? FUENTE_LABEL[f.dato.fuente] : "Pendiente"),
              },
              {
                titulo: "Momento observado (Argentina)",
                celda: (f) => fechaHoraArgentina(f.dato?.observadoAl ?? null),
              },
              { titulo: "Referencia", celda: (f) => f.dato?.referencia ?? "Pendiente" },
              {
                titulo: "Registrado (Argentina)",
                celda: (f) => fechaHoraArgentina(f.dato?.registradoAl ?? null),
              },
              {
                titulo: "Autor",
                celda: (f) => (f.dato ? `Usuario ${f.dato.registradoPorId}` : "Pendiente"),
              },
              {
                titulo: "MacroGest",
                numero: true,
                celda: (f) =>
                  f.erp === null || (f.tipo === "patente" && !textoPresente(String(f.erp)))
                    ? "Sin dato"
                    : f.tipo === "patente"
                      ? f.erp
                      : kgErp(f.erp),
              },
              {
                titulo: "Diferencia operativo − MacroGest",
                numero: true,
                celda: (f) =>
                  !f.dato ||
                  f.erp === null ||
                  (f.tipo === "patente" && (!f.dato.texto?.trim() || !String(f.erp).trim()))
                    ? "Sin comparación"
                    : f.tipo === "patente"
                      ? f.dato.texto === f.erp
                        ? "Coincide"
                        : "Diferencia entre fuentes"
                      : diferenciaPeso(f.dato.kilogramos, f.erp),
              },
            ]}
          />
          {oficial && (
            <div className="mt-4">
              <TablaLogistica
                titulo="Documentación MacroGest"
                filas={[oficial]}
                clave={(f) => `${f.contrato}/${f.grupo}/${f.cupo}`}
                columnas={[
                  {
                    titulo: "Carta de Porte",
                    celda: (f) => (f.tieneCartaPorte ? "Presente" : "Pendiente"),
                  },
                  { titulo: "CTG", celda: (f) => f.ctg ?? "Sin dato" },
                  {
                    titulo: "Descarga documentada",
                    celda: (f) => (f.tieneDescarga ? "Presente" : "Pendiente"),
                  },
                ]}
              />
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {gestionar && lecturaActual && !s.anuladoAl && (
              <>
                {onElegirCamion && (
                  <Button variant="outline" onClick={() => onElegirCamion(structuredClone(s))}>
                    {s.flotaVigente ? "Reemplazar camión" : "Elegir camión"}
                  </Button>
                )}
                {s.flotaVigente && onRetirarCamion && (
                  <Button variant="outline" onClick={() => onRetirarCamion(structuredClone(s))}>
                    Retirar camión
                  </Button>
                )}
              </>
            )}
            {gestionarVinculos &&
              onVincular &&
              lecturaActual &&
              !s.anuladoAl &&
              s.cupo.otorgamientoVigente &&
              !s.vinculoErpVigente &&
              !s.cupo.tieneVinculoErpVigente && (
                <Button onClick={() => onVincular(structuredClone(s))}>
                  Vincular con MacroGest
                </Button>
              )}
            {gestionarVinculos &&
              lecturaActual &&
              !s.anuladoAl &&
              s.cupo.otorgamientoVigente &&
              s.vinculoErpVigente && (
                <>
                  {onReemplazar && (
                    <Button variant="outline" onClick={() => onReemplazar(structuredClone(s))}>
                      Reemplazar referencia
                    </Button>
                  )}
                  {onRetirar && (
                    <Button variant="outline" onClick={() => onRetirar(structuredClone(s))}>
                      Retirar referencia
                    </Button>
                  )}
                </>
              )}
            {gestionar && !s.anuladoAl && (
              <>
                <Button
                  variant="outline"
                  disabled={!lecturaActual}
                  onClick={() => editar("estado")}
                >
                  {s.estadoObservadoAl ? "Corregir estado" : "Registrar estado"}
                </Button>
                {tipos.map((tipo) => (
                  <Button
                    key={tipo}
                    variant="outline"
                    disabled={!lecturaActual}
                    onClick={() => editar(tipo)}
                  >
                    {datoVigente(s, tipo) ? "Corregir" : "Registrar"}{" "}
                    {DATO_LABEL[tipo].toLowerCase()}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  disabled={!lecturaActual}
                  onClick={() => editar("anular")}
                >
                  Anular seguimiento
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={onHistoria}>
              Historial
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
