import { Button } from "@/components/ui/button";
import { fecha, fechaHoraArgentina } from "../format";
import { INCIDENCIA_LABEL, referenciaErp } from "../lib/conciliacion";
import { destinatarioSeguimiento, ESTADO_LABEL } from "../lib/seguimiento";
import type { ConciliacionFila, Pagina } from "../types";
import { TablaLogistica } from "./tabla-logistica";

const ESTADO_CONSULTA = {
  sin_vinculo: "Sin vínculo",
  verificado: "Verificado",
  no_encontrado: "Referencia no encontrada",
  no_disponible: "No verificable: MacroGest no disponible",
};
function documento(fila: ConciliacionFila, tipo: "tieneCartaPorte" | "tieneDescarga") {
  if (fila.erp) return fila.erp[tipo] ? "Presente" : "Pendiente";
  return fila.estadoConsulta === "sin_vinculo"
    ? "Sin vínculo"
    : fila.estadoConsulta === "no_encontrado"
      ? "Referencia no encontrada"
      : "No verificable";
}
export function ConciliacionTabla({
  paginas,
  cargando,
  error,
  reintentar,
  hayMas,
  mas,
  cargandoMas,
  bloqueada,
  onDetalle,
}: {
  paginas: Pagina<ConciliacionFila>[];
  cargando: boolean;
  error: unknown;
  reintentar: () => void;
  hayMas: boolean;
  mas: () => void;
  cargandoMas: boolean;
  bloqueada: boolean;
  onDetalle: (id: string) => void;
}) {
  const filas = paginas.flatMap((p) => p.filas.map((f) => ({ ...f, consultadoAl: p.datosAl })));
  return (
    <>
      <p className="mb-3 text-sm text-ink-soft">
        Revisión de las cargas de este período. Se conservan todas las cargas, incluidas las que no
        presentan diferencias. Cada fila muestra el momento de consulta de su página.
      </p>
      <TablaLogistica
        titulo="Desfasajes de las cargas"
        filas={filas}
        clave={(f) => f.seguimiento.cupoId}
        cargando={cargando}
        error={error}
        reintentar={reintentar}
        hayMas={hayMas}
        mas={mas}
        cargandoMas={cargandoMas}
        vacio="No hay cargas para revisar en estas fechas y filtros."
        columnas={[
          {
            titulo: "Cupo / recepción",
            celda: (f) => (
              <>
                <div>{f.seguimiento.cupo.codigoTerminal || "Código pendiente"}</div>
                <div className="text-xs text-ink-soft">{f.seguimiento.cupo.contratoVenta}</div>
                <div className="text-xs text-ink-soft">
                  {f.seguimiento.referenciaRecepcion} · fila {f.seguimiento.cupo.ordinal}
                </div>
              </>
            ),
          },
          { titulo: "Fecha prevista de carga", celda: (f) => fecha(f.seguimiento.cupo.fechaCarga) },
          { titulo: "Asignación propia", celda: (f) => destinatarioSeguimiento(f.seguimiento) },
          { titulo: "Estado observado", celda: (f) => ESTADO_LABEL[f.seguimiento.estadoObservado] },
          {
            titulo: "Referencia MacroGest",
            celda: (f) =>
              f.seguimiento.vinculoErpVigente
                ? referenciaErp(f.seguimiento.vinculoErpVigente)
                : "Sin vínculo",
          },
          { titulo: "Estado de consulta", celda: (f) => ESTADO_CONSULTA[f.estadoConsulta] },
          {
            titulo: "Incidencias",
            celda: (f) =>
              f.incidencias.length
                ? f.incidencias.map((c) => (
                    <div key={c}>{INCIDENCIA_LABEL[c] ?? "Incidencia sin descripción"}</div>
                  ))
                : "Sin diferencias detectadas",
          },
          { titulo: "Carta de Porte", celda: (f) => documento(f, "tieneCartaPorte") },
          { titulo: "Descarga documentada", celda: (f) => documento(f, "tieneDescarga") },
          { titulo: "Consultado al (Argentina)", celda: (f) => fechaHoraArgentina(f.consultadoAl) },
          {
            titulo: "Acciones",
            celda: (f) => (
              <Button
                size="sm"
                variant="outline"
                disabled={bloqueada}
                onClick={() => onDetalle(f.seguimiento.cupoId)}
              >
                Ver detalle
              </Button>
            ),
          },
        ]}
      />
    </>
  );
}
