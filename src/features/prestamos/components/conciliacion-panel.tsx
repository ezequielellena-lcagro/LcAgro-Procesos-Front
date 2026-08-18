import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, EyeOff, HelpCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha, oDash, pct } from "@/shared/format/format";
import { importe } from "../format";
import type {
  ConciliacionMacroGest,
  DescartarInput,
  Descarte,
  FilaConciliacion,
  FilaPropuesta,
} from "../types";

interface Props {
  datos: ConciliacionMacroGest | undefined;
  cargando: boolean;
  error: unknown;
  onReintentar: () => void;
  onDescartar: (input: DescartarInput) => void;
  onQuitarDescarte: (id: number) => void;
  puedeGestionar: boolean;
}

/**
 * Pide el motivo antes de sacar un movimiento del cruce. Es obligatorio a propósito: dentro de un
 * año la pregunta no va a ser qué está oculto, sino por qué se ocultó.
 */
function DescartarDialog({
  nroOperacion,
  onClose,
  onConfirmar,
}: {
  nroOperacion: string | null;
  onClose: () => void;
  onConfirmar: (input: DescartarInput) => void;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <Modal
      open={nroOperacion !== null}
      onClose={onClose}
      title={`Descartar la operación ${nroOperacion ?? ""}`}
      className="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          El movimiento deja de aparecer en el cruce. No se borra nada del banco ni del sistema, y
          se puede deshacer cuando quieras.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="motivo-descarte">Motivo</Label>
          <Textarea
            id="motivo-descarte"
            rows={3}
            value={motivo}
            placeholder="Ej.: cancelado en abril de 2025, el alta no declara el importe en dólares."
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={motivo.trim().length === 0}
            onClick={() => {
              onConfirmar({ nroOperacion: nroOperacion ?? "", motivo: motivo.trim() });
              onClose();
            }}
          >
            Descartar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const COLUMNAS_DESCARTADOS: Column<Descarte>[] = [
  { key: "op", header: "N° operación", cell: (d) => d.nroOperacion, sortBy: (d) => d.nroOperacion },
  { key: "motivo", header: "Motivo", cell: (d) => d.motivo },
  { key: "quien", header: "Lo descartó", cell: (d) => d.usuario || "—" },
  {
    key: "cuando",
    header: "Cuándo",
    cell: (d) => fecha(d.fecha),
    className: "whitespace-nowrap",
    sortBy: (d) => d.fecha,
  },
];

/** Sección con título, contador y su tabla. Fuera del componente: no se redefine en cada render. */
function Seccion({
  titulo,
  ayuda,
  tono,
  cantidad,
  children,
}: {
  titulo: string;
  ayuda: string;
  tono: "rojo" | "amarillo";
  cantidad: number;
  children: ReactNode;
}) {
  if (cantidad === 0) return null;

  return (
    <section aria-label={titulo} className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={tono === "rojo" ? "size-4 text-rojo" : "size-4 text-clementina-deep"}
        />
        <h3 className="font-display text-lg font-semibold text-ink">
          {titulo} ({cantidad})
        </h3>
      </div>
      <p className="text-xs text-ink-soft">{ayuda}</p>
      {children}
    </section>
  );
}

const COLUMNAS_SISTEMA: Column<FilaConciliacion>[] = [
  { key: "op", header: "N° operación", cell: (f) => f.nroOperacion ?? "—" },
  { key: "banco", header: "Banco", cell: (f) => f.banco },
  { key: "linea", header: "Línea", cell: (f) => f.linea },
  { key: "capital", header: "Capital", align: "right", cell: (f) => importe(f.capital) },
];

const COLUMNAS_BANCO: Column<FilaPropuesta>[] = [
  { key: "op", header: "N° operación", cell: (f) => f.nroOperacion },
  {
    key: "fecha",
    header: "Acreditado",
    cell: (f) => fecha(f.fecha),
    className: "whitespace-nowrap",
  },
  { key: "banco", header: "Banco", cell: (f) => f.banco },
  {
    key: "capital",
    header: "Capital U$S",
    align: "right",
    cell: (f) => oDash(f.capitalUsd, importe),
  },
  { key: "tna", header: "TNA", align: "right", cell: (f) => oDash(f.tasaNominalAnual, pct) },
  { key: "concepto", header: "Concepto en MacroGest", cell: (f) => f.concepto },
];

/**
 * El cruce contra MacroGest: qué está cargado sin respaldo bancario y qué registró el banco que
 * nadie cargó. Es el control que el Excel nunca tuvo — en su primera corrida encontró préstamos
 * de los dos lados.
 *
 * Las conciliadas sólo se cuentan: son la mayoría y no requieren acción. Lo que ocupa la pantalla
 * es lo que hay que resolver.
 */
export function ConciliacionPanel({
  datos,
  cargando,
  error,
  onReintentar,
  onDescartar,
  onQuitarDescarte,
  puedeGestionar,
}: Props) {
  const [descartando, setDescartando] = useState<string | null>(null);

  if (error) {
    return (
      <div className="rounded-card border border-rojo/30 bg-rojo-bg p-6 text-center">
        <p className="font-medium text-rojo">No se pudo consultar MacroGest.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Suele ser la VPN. El cruce no se puede hacer sin la base del cliente — y mostrar las
          listas vacías se leería como &quot;todo en orden&quot;.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onReintentar}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (cargando || !datos) {
    return (
      <div className="rounded-card border border-line bg-panel p-8 text-center text-ink-soft">
        Consultando MacroGest…
        <p className="mt-1 text-xs">
          La consulta va por VPN contra la base del cliente y puede tardar.
        </p>
      </div>
    );
  }

  const diferencias =
    datos.sinRespaldoBancario.length + datos.sinCargar.length + datos.sinNumeroDeOperacion.length;

  // La acción va al final de la fila, y sólo si la persona puede gestionar.
  const columnasBanco: Column<FilaPropuesta>[] = puedeGestionar
    ? [
        ...COLUMNAS_BANCO,
        {
          key: "descartar",
          header: "",
          align: "right",
          cell: (f) => (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDescartando(f.nroOperacion)}
              title="Sacarlo del cruce dejando registrado por qué"
            >
              <EyeOff className="size-3.5" /> No corresponde
            </Button>
          ),
        },
      ]
    : COLUMNAS_BANCO;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-panel-soft p-3">
        {datos.hayDiferencias ? (
          <p className="flex items-center gap-2 font-medium text-rojo">
            <AlertTriangle className="size-4" />
            {diferencias} diferencias entre el sistema y MacroGest
          </p>
        ) : (
          <p className="flex items-center gap-2 font-medium text-verde">
            <CheckCircle2 className="size-4" />
            Sin diferencias: todo lo cargado tiene respaldo bancario
          </p>
        )}
        <p className="text-xs text-ink-soft">
          {datos.conciliadas.length} conciliadas · movimientos desde {fecha(datos.desde)}
        </p>
      </div>

      <Seccion
        titulo="Sin respaldo bancario"
        ayuda="Están cargadas en el sistema pero el banco no registró el desembolso. Puede ser rezago de carga en MacroGest, una renovación sin movimiento nuevo, o un error."
        tono="rojo"
        cantidad={datos.sinRespaldoBancario.length}
      >
        <DataTable
          columns={COLUMNAS_SISTEMA}
          rows={datos.sinRespaldoBancario}
          getRowKey={(f) => f.prestamoId}
        />
      </Seccion>

      <Seccion
        titulo="Sin cargar"
        ayuda="El banco los registró y el sistema no los tiene. Los datos salen del texto que Administración escribió en MacroGest, así que hay que revisarlos antes de darlos por buenos."
        tono="rojo"
        cantidad={datos.sinCargar.length}
      >
        <DataTable
          columns={columnasBanco}
          rows={datos.sinCargar}
          getRowKey={(f) => f.nroOperacion}
        />
      </Seccion>

      <Seccion
        titulo="Sin N° de operación"
        ayuda="No es un faltante: es que les falta el dato con el que se atarían al banco. Completándolo entran al cruce."
        tono="amarillo"
        cantidad={datos.sinNumeroDeOperacion.length}
      >
        <DataTable
          columns={COLUMNAS_SISTEMA}
          rows={datos.sinNumeroDeOperacion}
          getRowKey={(f) => f.prestamoId}
        />
      </Seccion>

      {datos.descartados.length > 0 ? (
        <section aria-label="Descartados" className="space-y-2">
          <h3 className="font-display text-lg font-semibold text-ink">
            Descartados ({datos.descartados.length})
          </h3>
          <p className="text-xs text-ink-soft">
            Movimientos que alguien ya revisó y sacó del cruce. No cuentan como diferencia.
          </p>
          <DataTable
            columns={
              puedeGestionar
                ? [
                    ...COLUMNAS_DESCARTADOS,
                    {
                      key: "deshacer",
                      header: "",
                      align: "right" as const,
                      cell: (d: Descarte) => (
                        <Button variant="ghost" size="sm" onClick={() => onQuitarDescarte(d.id)}>
                          <Undo2 className="size-3.5" /> Deshacer
                        </Button>
                      ),
                    },
                  ]
                : COLUMNAS_DESCARTADOS
            }
            rows={datos.descartados}
            getRowKey={(d) => d.id}
          />
        </section>
      ) : null}

      <DescartarDialog
        nroOperacion={descartando}
        onClose={() => setDescartando(null)}
        onConfirmar={onDescartar}
      />

      <p className="flex items-start gap-1.5 text-xs text-ink-soft">
        <HelpCircle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Una misma operación puede aparecer en dos listas si el sistema y el banco le pusieron
          números distintos. El cruce no lo puede saber: lo muestra en vez de adivinar.
        </span>
      </p>
    </div>
  );
}
