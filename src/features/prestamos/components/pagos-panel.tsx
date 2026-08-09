import { useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha } from "@/shared/format/format";
import { importe } from "../format";
import type { ConciliacionPagos, ConfirmarPagoItem, PagoNoImputado, PagoSugerido } from "../types";

interface Props {
  datos: ConciliacionPagos | undefined;
  cargando: boolean;
  error: unknown;
  onReintentar: () => void;
  onConfirmar: (pagos: ConfirmarPagoItem[]) => void;
  confirmando: boolean;
  puedeGestionar: boolean;
}

const COLUMNAS_NO_IMPUTADOS: Column<PagoNoImputado>[] = [
  {
    key: "fecha",
    header: "Fecha",
    cell: (p) => fecha(p.fecha),
    className: "whitespace-nowrap",
    sortBy: (p) => p.fecha,
  },
  { key: "banco", header: "Banco", cell: (p) => p.banco, sortBy: (p) => p.banco },
  {
    key: "comp",
    header: "Comprobante",
    cell: (p) => p.nroComprobante,
    sortBy: (p) => p.nroComprobante,
  },
  {
    key: "importe",
    header: "Debitado",
    align: "right",
    cell: (p) => importe(p.importeArs),
    sortBy: (p) => p.importeArs,
  },
  { key: "concepto", header: "Concepto en MacroGest", cell: (p) => p.concepto },
];

/** Sección informativa con su tabla. Fuera del componente: no se redefine en cada render. */
function Seccion({
  titulo,
  ayuda,
  filas,
}: {
  titulo: string;
  ayuda: string;
  filas: PagoNoImputado[];
}) {
  if (filas.length === 0) return null;

  return (
    <section aria-label={titulo} className="space-y-2">
      <h3 className="font-display text-lg font-semibold text-ink">
        {titulo} ({filas.length})
      </h3>
      <p className="text-xs text-ink-soft">{ayuda}</p>
      <DataTable
        columns={COLUMNAS_NO_IMPUTADOS}
        rows={filas}
        getRowKey={(p, i) => `${p.nroComprobante}-${p.fecha}-${i}`}
      />
    </section>
  );
}

/**
 * Los débitos de cuota que registró el banco, con la cuota que les correspondería.
 *
 * Todo lo que se ve acá es una **propuesta**: nada se marca como pagado hasta que el usuario tilda
 * y confirma. El sistema ata el débito con el préstamo por el número de comprobante y elige la
 * cuota que vence más cerca de la fecha del débito — pero quién decide es la persona.
 */
export function PagosPanel({
  datos,
  cargando,
  error,
  onReintentar,
  onConfirmar,
  confirmando,
  puedeGestionar,
}: Props) {
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());

  if (error) {
    return (
      <div className="rounded-card border border-rojo/30 bg-rojo-bg p-6 text-center">
        <p className="font-medium text-rojo">No se pudo consultar MacroGest.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Suele ser la VPN. Sin la base del cliente no hay pagos que cruzar — y mostrar las listas
          vacías se leería como &quot;no hay nada que imputar&quot;.
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

  const alternar = (cuotaId: number) =>
    setElegidas((previas) => {
      const siguiente = new Set(previas);
      if (!siguiente.delete(cuotaId)) siguiente.add(cuotaId);
      return siguiente;
    });

  const todasElegidas = datos.sugeridos.length > 0 && elegidas.size === datos.sugeridos.length;

  const confirmar = () =>
    onConfirmar(
      datos.sugeridos
        .filter((s) => elegidas.has(s.cuotaId))
        .map((s) => ({
          cuotaId: s.cuotaId,
          fechaPago: s.fechaPago,
          // En dólares el banco debita PESOS: guardarlo como importe pagado de una cuota en
          // dólares dejaría un número sin sentido en el histórico.
          importePagado: s.moneda === "ARS" ? s.importeDebitado : null,
        })),
    );

  const columnas: Column<PagoSugerido>[] = [
    ...(puedeGestionar
      ? [
          {
            key: "elegir",
            header: (
              <input
                type="checkbox"
                className="size-4 accent-clementina-deep"
                aria-label="Imputar todas"
                checked={todasElegidas}
                onChange={() =>
                  setElegidas(todasElegidas ? new Set() : new Set(datos.sugeridos.map((s) => s.cuotaId)))
                }
              />
            ),
            cell: (s: PagoSugerido) => (
              <input
                type="checkbox"
                className="size-4 accent-clementina-deep"
                aria-label={`Imputar la cuota ${s.nroCuota} de ${s.nroOperacion ?? "sin número"}`}
                checked={elegidas.has(s.cuotaId)}
                onChange={() => alternar(s.cuotaId)}
              />
            ),
          },
        ]
      : []),
    {
      key: "debito",
      header: "Débito",
      cell: (s) => fecha(s.fechaPago),
      className: "whitespace-nowrap",
    },
    { key: "banco", header: "Banco", cell: (s) => s.banco },
    { key: "op", header: "N° operación", cell: (s) => s.nroOperacion ?? "—" },
    { key: "cuota", header: "Cuota", cell: (s) => `${s.nroCuota}/${s.cantidadCuotas}` },
    {
      key: "vence",
      header: "Vence",
      cell: (s) => fecha(s.fechaVencimiento),
      className: "whitespace-nowrap",
    },
    { key: "total", header: "Total cuota", align: "right", cell: (s) => importe(s.totalCuota) },
    {
      key: "debitado",
      header: "Debitado",
      align: "right",
      cell: (s) => importe(s.importeDebitado),
    },
    {
      key: "dif",
      header: "Diferencia",
      align: "right",
      cell: (s) =>
        s.diferenciaArs === null || s.importeCoincide ? (
          "—"
        ) : (
          <span className="flex items-center justify-end gap-1 font-semibold text-rojo">
            <AlertTriangle className="size-3.5" />
            {importe(s.diferenciaArs)}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-panel-soft p-3">
        {datos.hayPropuestas ? (
          <p className="flex items-center gap-2 font-medium text-ink">
            {datos.sugeridos.length} pagos del banco para imputar
          </p>
        ) : (
          <p className="flex items-center gap-2 font-medium text-verde">
            <CheckCircle2 className="size-4" />
            No hay pagos para imputar: las cuotas pendientes no tienen débito en el banco
          </p>
        )}
        <p className="text-xs text-ink-soft">movimientos desde {fecha(datos.desde)}</p>
      </div>

      {datos.sugeridos.length > 0 ? (
        <section aria-label="Pagos para imputar" className="space-y-2">
          <p className="text-xs text-ink-soft">
            El débito se ata al préstamo por el número de comprobante, y se propone la cuota que
            vence más cerca. Al confirmar, la cuota queda pagada con la <strong>fecha del banco</strong>.
          </p>

          <DataTable columns={columnas} rows={datos.sugeridos} getRowKey={(s) => s.cuotaId} />

          {puedeGestionar ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="accent"
                size="sm"
                disabled={elegidas.size === 0 || confirmando}
                onClick={confirmar}
              >
                {confirmando ? "Imputando…" : `Imputar ${elegidas.size} cuota(s)`}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <Seccion
        titulo="Sin cuota pendiente"
        ayuda="El préstamo está cargado, pero ninguna cuota pendiente vence cerca de este débito. Casi siempre son cuotas anteriores a la carga inicial, que no se cargaron porque ya estaban pagadas."
        filas={datos.sinCuotaPendiente}
      />

      <Seccion
        titulo="Sin préstamo asociado"
        ayuda="El banco debitó una cuota de un préstamo que el sistema no tiene. Puede ser una operación vieja que nunca se cargó, o un número de comprobante distinto del que quedó guardado."
        filas={datos.sinPrestamo}
      />

      <p className="flex items-start gap-1.5 text-xs text-ink-soft">
        <HelpCircle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          En los préstamos en dólares el banco debita pesos al cambio del día: la columna Diferencia
          queda vacía porque comparar esos dos importes no diría nada.
        </span>
      </p>
    </div>
  );
}
