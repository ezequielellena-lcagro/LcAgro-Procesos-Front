import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha, oDash, pct } from "@/shared/format/format";
import { importe } from "../format";
import type { ConciliacionMacroGest, FilaConciliacion, FilaPropuesta } from "../types";

interface Props {
  datos: ConciliacionMacroGest | undefined;
  cargando: boolean;
  error: unknown;
  onReintentar: () => void;
}

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
export function ConciliacionPanel({ datos, cargando, error, onReintentar }: Props) {
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
          columns={COLUMNAS_BANCO}
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
