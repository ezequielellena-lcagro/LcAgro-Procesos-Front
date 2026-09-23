import { useEffect, useState } from "react";
import { AlertTriangle, Check, Download, Lock, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { fecha, hoyIso, mesAnio, usd } from "@/shared/format/format";
import {
  useCerrarMes,
  useCierreDiff,
  useCierreEstado,
  useCierrePeriodo,
  useCierrePeriodos,
  useCierreRevisiones,
  useExportarCierre,
  useRecerrarPeriodo,
} from "../queries/use-cierre";
import type { CierreCuenta, CierreDetalle, CierreDiffCuenta, TipoCambioCierre } from "../types";

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
function FotoDelMes({ anio, mes, revision }: Seleccion & { revision?: number }) {
  const detalle = useCierrePeriodo(anio, mes, true, revision);

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

const ETIQUETA_CAMBIO: Record<TipoCambioCierre, string> = {
  Cambiada: "Cambió",
  Agregada: "Nueva",
  Quitada: "Ya no figura",
};

const COLUMNAS_DIFF: Column<CierreDiffCuenta>[] = [
  { key: "cuenta", header: "Cuenta", align: "right", cell: (c) => c.cuenta },
  { key: "cliente", header: "Cliente", cell: (c) => <span className="text-ink">{c.denominacion}</span> },
  { key: "tipo", header: "Qué pasó", cell: (c) => ETIQUETA_CAMBIO[c.tipo] },
  { key: "fotoSaldo", header: "Saldo en el informe", align: "right", cell: (c) => usd(c.saldoFoto) },
  { key: "actualSaldo", header: "Saldo hoy", align: "right", cell: (c) => usd(c.saldoActual) },
  {
    key: "delta",
    header: "Diferencia",
    align: "right",
    cell: (c) => (
      <span className={c.delta === 0 ? "text-ink-soft" : c.delta > 0 ? "font-semibold text-rojo" : "font-semibold text-ink"}>
        {c.delta > 0 ? "+" : ""}
        {usd(c.delta)}
      </span>
    ),
  },
];

/**
 * Verificación de registraciones retroactivas: le vuelve a pedir a MacroGest los saldos del MISMO
 * corte de la foto y muestra qué se movió. Es una consulta pesada, así que se dispara a mano.
 * Con permiso de gestión, ofrece guardar el resultado como una revisión nueva (la anterior queda).
 */
function VerificarCambios({ anio, mes, puedeGestionar }: Seleccion & { puedeGestionar: boolean }) {
  const [verificar, setVerificar] = useState(false);
  const diff = useCierreDiff(anio, mes, verificar);
  const recerrar = useRecerrarPeriodo();

  // Al cambiar de mes se vuelve al estado inicial: el resultado de un período no sirve para otro.
  useEffect(() => setVerificar(false), [anio, mes]);

  if (!verificar) {
    return (
      <Button type="button" variant="outline" size="sm" className="no-print" onClick={() => setVerificar(true)}>
        <RefreshCw className="size-4" /> Verificar cambios
      </Button>
    );
  }

  if (diff.isError) return <ErrorState error={diff.error} onRetry={() => void diff.refetch()} />;
  if (diff.isPending) return <Skeleton className="h-24 rounded-card" />;

  const datos = diff.data;

  if (!datos.hayCambios) {
    return (
      <div className="flex items-center gap-2 rounded-card border border-verde/40 bg-verde/10 px-3 py-2 text-sm text-ink">
        <Check className="size-4 shrink-0" aria-hidden="true" />
        <span>
          Sin cambios: MacroGest al {fecha(datos.corte)} sigue dando lo mismo que el informe.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-card border border-clementina/40 bg-clementina/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink">
          <span className="font-semibold">{datos.items.length}</span>{" "}
          {datos.items.length === 1 ? "cuenta cambió" : "cuentas cambiaron"} respecto del informe
          {datos.cambiadas > 0 && <> · {datos.cambiadas} con otro saldo</>}
          {datos.agregadas > 0 && <> · {datos.agregadas} nuevas</>}
          {datos.quitadas > 0 && <> · {datos.quitadas} que ya no figuran</>} · diferencia total{" "}
          <span className="font-semibold">{usd(datos.deltaSaldo)}</span>
        </p>
        {puedeGestionar && (
          <Button
            type="button"
            variant="accent"
            size="sm"
            className="no-print"
            disabled={recerrar.isPending}
            onClick={() => recerrar.mutate({ anio, mes })}
          >
            <Save className="size-4" />
            {recerrar.isPending ? "Guardando…" : "Guardar como revisión nueva"}
          </Button>
        )}
      </div>
      <p className="text-xs text-ink-soft">
        Son comprobantes cargados en MacroGest con fecha dentro del período, después de que se cerró.
        Guardar una revisión nueva no borra la anterior: el informe que presentaste sigue disponible en
        el selector de revisiones.
      </p>
      <DataTable
        columns={COLUMNAS_DIFF}
        rows={datos.items}
        getRowKey={(c) => c.cuenta}
        empty="Sin diferencias."
      />
    </div>
  );
}

/**
 * Barra de gestión del cierre (solo con permiso): aviso si falta cerrar + botón "Cerrar mes".
 * El cierre pide la FECHA DEL INFORME: nada se cierra ni se blanquea solo, así que se puede cerrar
 * el 12 fechando la foto el 7, que es el día en que el informe se presentó.
 */
function CierreControls() {
  const estado = useCierreEstado();
  const cerrar = useCerrarMes();
  const [confirmar, setConfirmar] = useState(false);
  const [corte, setCorte] = useState(hoyIso());

  const faltaCerrar = estado.data?.faltaCerrar ?? false;
  const periodo = estado.data ? mesAnio(estado.data.anio, estado.data.mes) : "abierto";
  // El corte no puede ser futuro ni caer antes del mes que se está cerrando (mismos límites que la API).
  const minCorte = estado.data
    ? `${estado.data.anio}-${String(estado.data.mes).padStart(2, "0")}-01`
    : undefined;

  const abrir = () => {
    setCorte(hoyIso());   // cada apertura arranca en hoy; si el informe es de antes, se cambia acá
    setConfirmar(true);
  };

  const onCerrar = () => {
    setConfirmar(false);
    cerrar.mutate(corte);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {faltaCerrar && (
        <div className="flex items-center gap-2 rounded-card border border-clementina/40 bg-clementina/10 px-3 py-2 text-sm text-clementina-deep">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>
            El mes <span className="font-semibold">{periodo}</span> está sin cerrar
          </span>
        </div>
      )}
      <Button type="button" variant="accent" size="sm" disabled={cerrar.isPending} onClick={abrir}>
        <Lock className="size-4" /> {cerrar.isPending ? "Cerrando…" : "Cerrar mes"}
      </Button>

      <Modal open={confirmar} onClose={() => setConfirmar(false)} title="Cerrar mes" className="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Se guarda la foto de <span className="font-semibold">{periodo}</span> (saldos + Devolución +
            Observaciones) y la carga arranca en blanco para el mes siguiente.
          </p>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Fecha del informe</span>
            <Input
              type="date"
              value={corte}
              min={minCorte}
              max={hoyIso()}
              onChange={(e) => setCorte(e.target.value)}
            />
            <span className="block text-xs text-ink-soft">
              Los saldos se congelan a este día. Si presentaste el informe el 7 y estás cerrando hoy,
              poné el 7: la foto va a coincidir con lo que entregaste.
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmar(false)} disabled={cerrar.isPending}>
              Cancelar
            </Button>
            <Button type="button" variant="accent" onClick={onCerrar} disabled={cerrar.isPending || !corte}>
              {cerrar.isPending ? "Cerrando…" : "Cerrar mes"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Selector de revisión: solo aparece cuando el período se re-fotografió alguna vez. */
function SelectorRevision({
  anio,
  mes,
  revision,
  onRevision,
}: Seleccion & { revision?: number; onRevision: (r: number | undefined) => void }) {
  const revisiones = useCierreRevisiones(anio, mes, true);
  const lista = revisiones.data ?? [];
  if (lista.length <= 1) return null;

  const vigente = lista.find((r) => r.vigente);
  return (
    <Select
      aria-label="Revisión"
      className="min-w-56"
      value={String(revision ?? vigente?.revision ?? "")}
      onChange={(e) => {
        const r = Number(e.target.value);
        // Elegir la vigente equivale a "sin revisión": así el export y la foto siguen la vigente
        // aunque más adelante se agregue otra.
        onRevision(r === vigente?.revision ? undefined : r);
      }}
    >
      {lista.map((r) => (
        <option key={r.revision} value={r.revision}>
          Revisión {r.revision} · al {fecha(r.corte)} · cerrada {fecha(r.fechaCierre)}
          {r.vigente ? " · vigente" : ""}
        </option>
      ))}
    </Select>
  );
}

/**
 * Solapa "Histórico": foto mensual congelada de las cuentas (solo lectura). Selector de mes cerrado,
 * tabla con totales y export a Excel. Con permiso de gestión, además, el botón para cerrar el mes.
 * Cada mes puede tener varias revisiones (re-fotografías por registraciones retroactivas): se elige
 * cuál mirar y se puede contrastar la vigente contra MacroGest.
 */
export function HistoricoPanel({ puedeGestionar }: { puedeGestionar: boolean }) {
  const periodos = useCierrePeriodos();
  const exportar = useExportarCierre();
  const [sel, setSel] = useState<Seleccion | null>(null);
  const [revision, setRevision] = useState<number | undefined>(undefined);

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
          <div className="flex flex-wrap items-center gap-3">
            <Select
              aria-label="Mes cerrado"
              className="min-w-48"
              value={`${seleccion.anio}-${seleccion.mes}`}
              onChange={(e) => {
                const [anio, mes] = e.target.value.split("-").map(Number);
                setSel({ anio, mes });
                setRevision(undefined);   // cada mes arranca en su revisión vigente
              }}
            >
              {lista.map((p) => (
                // El corte va en la etiqueta porque no se deduce del mes: "Septiembre 2026" puede estar
                // fotografiado al 07-10, el día en que se presentó el informe.
                <option key={`${p.anio}-${p.mes}`} value={`${p.anio}-${p.mes}`}>
                  {mesAnio(p.anio, p.mes)} · al {fecha(p.corte)}
                  {p.revisiones > 1 ? ` · ${p.revisiones} revisiones` : ""}
                </option>
              ))}
            </Select>
            <SelectorRevision {...seleccion} revision={revision} onRevision={setRevision} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="no-print"
            disabled={exportar.isPending}
            onClick={() => exportar.mutate({ ...seleccion, revision })}
          >
            <Download className="size-4" /> {exportar.isPending ? "Generando…" : "Excel"}
          </Button>
        </div>

        <VerificarCambios {...seleccion} puedeGestionar={puedeGestionar} />

        <FotoDelMes anio={seleccion.anio} mes={seleccion.mes} revision={revision} />
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
