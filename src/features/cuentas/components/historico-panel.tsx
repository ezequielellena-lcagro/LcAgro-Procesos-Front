import { useState } from "react";
import { AlertTriangle, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { fecha, mesAnio, usd } from "@/shared/format/format";
import {
  useCerrarMes,
  useCierreEstado,
  useCierrePeriodo,
  useCierrePeriodos,
  useExportarCierre,
} from "../queries/use-cierre";
import type { CierreCuenta, CierreDetalle } from "../types";

/** Mes elegido en el selector (clave del período cerrado a mostrar). */
interface Seleccion {
  anio: number;
  mes: number;
}

/** Guioncito para las notas vacías (la foto es solo lectura). */
const Nota = ({ texto }: { texto: string | null }) =>
  texto ? <span className="text-ink">{texto}</span> : <span className="text-ink-soft">—</span>;

const COLUMNAS: Column<CierreCuenta>[] = [
  { key: "vendedor", header: "Vendedor", cell: (c) => c.vendedor },
  { key: "cuenta", header: "Cuenta", align: "right", cell: (c) => c.cuenta },
  { key: "cliente", header: "Cliente", cell: (c) => <span className="text-ink">{c.denominacion}</span> },
  {
    key: "vencido",
    header: "Vencido",
    align: "right",
    cell: (c) => (
      <span className={c.saldoVencido > 0 ? "font-medium text-rojo" : "text-ink"}>{usd(c.saldoVencido)}</span>
    ),
  },
  { key: "avencer", header: "A vencer", align: "right", cell: (c) => usd(c.saldoAVencer) },
  {
    key: "saldo",
    header: "Saldo",
    align: "right",
    cell: (c) => <span className="font-semibold text-ink">{usd(c.saldo)}</span>,
  },
  { key: "devolucion", header: "Devolución", cell: (c) => <Nota texto={c.devolucion} /> },
  { key: "observaciones", header: "Observaciones", cell: (c) => <Nota texto={c.observaciones} /> },
];

/** Fila de totales del footer (una celda por columna de COLUMNAS). */
function filaTotales(detalle: CierreDetalle) {
  const { totales } = detalle;
  return [
    "TOTAL",
    "",
    `${totales.cuentas} ${totales.cuentas === 1 ? "cuenta" : "cuentas"}`,
    usd(totales.vencido),
    usd(totales.aVencer),
    usd(totales.saldo),
    "",
    "",
  ];
}

/** Tabla solo lectura de la foto de un mes. Query propia (loading/error acá para no tapar el selector). */
function FotoDelMes({ anio, mes }: Seleccion) {
  const detalle = useCierrePeriodo(anio, mes, true);

  if (detalle.isError) return <ErrorState error={detalle.error} onRetry={() => void detalle.refetch()} />;
  if (detalle.isPending) return <Skeleton className="h-64 rounded-card" />;

  const datos = detalle.data;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        Foto al <span className="font-semibold text-ink">{fecha(datos.corte)}</span> ·{" "}
        <span className="font-semibold text-ink">{datos.totales.cuentas}</span> cuentas · saldo{" "}
        <span className="font-semibold text-ink">{usd(datos.totales.saldo)}</span>
      </p>
      <DataTable
        columns={COLUMNAS}
        rows={datos.items}
        getRowKey={(c) => c.cuenta}
        footer={filaTotales(datos)}
        empty="La foto de este mes no tiene cuentas."
      />
    </div>
  );
}

/** Barra de gestión del cierre (solo con permiso): aviso si falta cerrar + botón "Cerrar mes". */
function CierreControls() {
  const estado = useCierreEstado();
  const cerrar = useCerrarMes();
  const [confirmar, setConfirmar] = useState(false);

  const faltaCerrar = estado.data?.faltaCerrar ?? false;
  const mesEnCurso = estado.data ? mesAnio(estado.data.anio, estado.data.mes) : "en curso";

  const onCerrar = () => {
    setConfirmar(false);
    cerrar.mutate();
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {faltaCerrar && (
        <div className="flex items-center gap-2 rounded-card border border-clementina/40 bg-clementina/10 px-3 py-2 text-sm text-clementina-deep">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>
            El mes <span className="font-semibold">{mesEnCurso}</span> está sin cerrar
          </span>
        </div>
      )}
      <Button type="button" variant="accent" size="sm" disabled={cerrar.isPending} onClick={() => setConfirmar(true)}>
        <Lock className="size-4" /> {cerrar.isPending ? "Cerrando…" : "Cerrar mes"}
      </Button>

      <Modal open={confirmar} onClose={() => setConfirmar(false)} title="Cerrar mes" className="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Se guarda la foto del mes <span className="font-semibold">{mesEnCurso}</span> (saldos + Devolución +
            Observaciones) y el mes nuevo arranca en blanco. Es idempotente: si ya se cerró, se actualiza la foto.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmar(false)} disabled={cerrar.isPending}>
              Cancelar
            </Button>
            <Button type="button" variant="accent" onClick={onCerrar} disabled={cerrar.isPending}>
              {cerrar.isPending ? "Cerrando…" : "Cerrar mes"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Solapa "Histórico": foto mensual congelada de las cuentas (solo lectura). Selector de mes cerrado,
 * tabla con totales y export a Excel. Con permiso de gestión, además, el botón para cerrar el mes.
 */
export function HistoricoPanel({ puedeGestionar }: { puedeGestionar: boolean }) {
  const periodos = useCierrePeriodos();
  const exportar = useExportarCierre();
  const [sel, setSel] = useState<Seleccion | null>(null);

  const lista = periodos.data ?? [];
  // Selección efectiva: la elegida o, por defecto, el período más reciente (la API los da así ordenados).
  const seleccion: Seleccion | null = sel ?? (lista[0] ? { anio: lista[0].anio, mes: lista[0].mes } : null);

  const cuerpo = () => {
    if (periodos.isError) return <ErrorState error={periodos.error} onRetry={() => void periodos.refetch()} />;
    if (periodos.isPending) return <Skeleton className="h-64 rounded-card" />;
    if (!seleccion) return <EmptyState mensaje="Todavía no hay meses cerrados." />;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select
            aria-label="Mes cerrado"
            className="min-w-48"
            value={`${seleccion.anio}-${seleccion.mes}`}
            onChange={(e) => {
              const [anio, mes] = e.target.value.split("-").map(Number);
              setSel({ anio, mes });
            }}
          >
            {lista.map((p) => (
              <option key={`${p.anio}-${p.mes}`} value={`${p.anio}-${p.mes}`}>
                {mesAnio(p.anio, p.mes)}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="no-print"
            disabled={exportar.isPending}
            onClick={() => exportar.mutate(seleccion)}
          >
            <Download className="size-4" /> {exportar.isPending ? "Generando…" : "Excel"}
          </Button>
        </div>

        <FotoDelMes anio={seleccion.anio} mes={seleccion.mes} />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {puedeGestionar && <CierreControls />}
      {cuerpo()}
    </div>
  );
}
