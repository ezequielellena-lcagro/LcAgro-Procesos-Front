import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FolderSearch,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toAppError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { numero, usd } from "@/shared/format/format";
import {
  useConfirmarBayer,
  useConfirmarBayerShare,
  useConfirmarPlanSiembra,
  useEstadoShareBayer,
  usePreviewBayer,
  usePreviewBayerShare,
  usePreviewPlanSiembra,
} from "../queries/use-importacion";
import { useSincronizarPadron } from "../queries/use-sincronizar-padron";
import type {
  FilaPendienteImportacionDto,
  ImportacionBayerDto,
  ImportacionPlanSiembraDto,
} from "../types";

/**
 * De dónde salen los datos del módulo.
 *
 * Existe porque la API sabía cargar todo esto desde el principio y no había forma de llamarla
 * desde la app: el padrón y el Excel se cargaban por línea de comandos, así que un servidor recién
 * instalado mostraba la pantalla en cero sin explicar por qué.
 *
 * El orden de las tarjetas es el orden real de carga. Cada una dice qué aporta y qué queda sin
 * calcular si falta, porque las dependencias no son obvias: sin costos el mercado da US$ 0 aunque
 * haya hectáreas, y sin Bayer la matriz de segmentación no puede correr.
 */
export function DatosTab({ campania }: { campania: string }) {
  return (
    <div className="space-y-4">
      <section className="rounded-card border border-line bg-panel p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink">Cargar los datos de la campaña</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          La facturación de La Clementina sale de MacroGest y se actualiza sola. Todo lo demás —
          cuántas hectáreas siembra cada productor, cuánto cuesta el insumo por hectárea y cuánto le
          facturó Bayer — MacroGest no lo guarda, y sale del <b>PLAN DE VENTAS.xlsx</b> que arma el
          negocio. Es un solo archivo: la app lee la hoja de ventas consolidadas para el plan y la
          hoja <i>Market Share</i> para los costos.
        </p>
      </section>

      <PadronCard />
      <PlanSiembraCard campania={campania} />
      <BayerCard />
    </div>
  );
}

function PadronCard() {
  const sincronizacion = useSincronizarPadron();
  const resumen = sincronizacion.data;

  return (
    <Tarjeta
      paso={1}
      icono={<Database className="size-4" aria-hidden />}
      titulo="Padrón de productores"
      fuente="MacroGest · solo lectura"
      descripcion={
        "Copia los clientes de MacroGest a la base propia: razón social, CUIT, vendedor y " +
        "localidad. Hace falta primero, porque el resto se cuelga de cada productor. Pisa lo que " +
        "manda el ERP y respeta lo local (si participa del proceso, la sucursal)."
      }
      error={sincronizacion.error}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={sincronizacion.isPending}
        onClick={() => sincronizacion.mutate()}
      >
        <RefreshCw
          className={cn("size-3.5", sincronizacion.isPending && "animate-spin")}
          aria-hidden
        />
        {sincronizacion.isPending ? "Sincronizando…" : "Sincronizar padrón"}
      </Button>

      {resumen && (
        <Cifras
          items={[
            { etiqueta: "Leídos de MacroGest", valor: numero(resumen.leidosMacroGest) },
            { etiqueta: "Altas", valor: numero(resumen.creados) },
            { etiqueta: "Modificados", valor: numero(resumen.actualizados) },
            { etiqueta: "Sin cambios", valor: numero(resumen.sinCambios) },
          ]}
        />
      )}
    </Tarjeta>
  );
}

function PlanSiembraCard({ campania }: { campania: string }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  // filaId -> productorId elegido a mano para las filas que el cruce automático no pudo resolver.
  const [resoluciones, setResoluciones] = useState<Record<string, number>>({});
  const preview = usePreviewPlanSiembra();
  const confirmar = useConfirmarPlanSiembra();
  const vista = confirmar.data ?? preview.data;
  const pendientes = vista?.pendientes ?? [];
  const faltanElegir = pendientes.filter((p) => !resoluciones[p.filaId]).length;

  function elegir(nuevo: File | null) {
    setArchivo(nuevo);
    setResoluciones({});
    preview.reset();
    confirmar.reset();
  }

  function analizar() {
    if (archivo) preview.mutate({ archivo, campania, resoluciones });
  }

  return (
    <Tarjeta
      paso={2}
      icono={<FileSpreadsheet className="size-4" aria-hidden />}
      titulo="Plan de siembra y costos"
      fuente={`PLAN DE VENTAS.xlsx · campaña ${campania}`}
      descripcion={
        "Las hectáreas por cultivo de cada productor y el costo del insumo por hectárea. Es lo que " +
        "define el mercado: sin esto, mercado, participación y oportunidad quedan en cero aunque " +
        "haya facturación."
      }
      error={preview.error ?? confirmar.error}
    >
      {/* Lo primero que se pregunta cualquiera parado acá: qué archivo y si hay que prepararlo. */}
      <div className="rounded-md border border-line bg-panel-soft p-3 text-xs leading-relaxed text-ink-soft">
        Subí el <b className="text-ink">PLAN DE VENTAS.xlsx</b> tal cual, sin tocarlo. Se leen dos
        hojas:
        <ul className="mt-1.5 space-y-1">
          <li>
            <b className="text-ink">Ventas consolidado Clientes</b> — las hectáreas: razón social en
            A, CUIT en B y los cultivos en D a G.
          </li>
          <li>
            <b className="text-ink">Market Share.</b> — los costos: cultivo, quintales de insumo,
            precio y rinde.
          </li>
        </ul>
        <p className="mt-1.5">
          El resto del archivo se ignora. Cada fila se cruza con el padrón por CUIT o por cuenta.
        </p>
      </div>
      <SelectorArchivo
        archivo={archivo}
        onElegir={elegir}
        accept=".xlsx"
        deshabilitado={preview.isPending || confirmar.isPending}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!archivo || preview.isPending || confirmar.isPending}
          onClick={analizar}
        >
          <Upload className="size-3.5" aria-hidden />
          {preview.isPending
            ? "Analizando…"
            : pendientes.length > 0
              ? "Analizar de nuevo"
              : "Analizar archivo"}
        </Button>

        {vista?.puedeConfirmar && !vista.confirmado && vista.tokenPreview && archivo && (
          <Button
            type="button"
            size="sm"
            disabled={confirmar.isPending}
            onClick={() =>
              confirmar.mutate({
                archivo,
                campania,
                // La misma vigencia que devolvió el análisis: entra en el token.
                vigenteDesde: vista.vigenteDesde,
                tokenPreview: vista.tokenPreview!,
                resoluciones,
              })
            }
          >
            {confirmar.isPending ? "Importando…" : "Confirmar importación"}
          </Button>
        )}
      </div>

      {pendientes.length > 0 && !vista?.confirmado && (
        <ResolverPendientes
          pendientes={pendientes}
          elegidos={resoluciones}
          faltan={faltanElegir}
          onElegir={(filaId, productorId) =>
            setResoluciones((actuales) => {
              if (productorId === null) {
                const { [filaId]: _, ...resto } = actuales;
                return resto;
              }
              return { ...actuales, [filaId]: productorId };
            })
          }
        />
      )}

      {vista && <ResumenPlanSiembra vista={vista} />}
    </Tarjeta>
  );
}

function ResumenPlanSiembra({ vista }: { vista: ImportacionPlanSiembraDto }) {
  const { mercadoAntes: antes, mercadoDespues: despues } = vista;

  return (
    <div className="space-y-3">
      {vista.confirmado && (
        <p className="flex items-center gap-1.5 rounded-md border border-verde/30 bg-verde/5 p-2.5 text-xs text-ink">
          <CheckCircle2 className="size-4 shrink-0 text-verde" aria-hidden />
          Importado. El tablero ya toma estos números.
        </p>
      )}

      {/* El destino no es obvio: sale del selector de campaña del encabezado, no del archivo. Un
          plan cargado en la campaña equivocada no rompe nada y no se nota hasta mucho después. */}
      {!vista.confirmado && (
        <p className="rounded-md border border-line bg-panel-soft p-2.5 text-xs text-ink">
          Se va a cargar en la campaña <b>{vista.campania}</b>. Si no es esa, cambiala en el
          encabezado y volvé a analizar.
        </p>
      )}

      {/* Lo primero que hay que poder mirar: en cuánto queda el mercado si se confirma. */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Comparacion titulo="Hectáreas" antes={numero(antes.hectareasTotales)} despues={numero(despues.hectareasTotales)} />
        <Comparacion titulo="Mercado" antes={usd(antes.mercadoUsd)} despues={usd(despues.mercadoUsd)} />
      </div>

      <Cifras
        items={[
          { etiqueta: "Filas leídas", valor: numero(vista.filasLeidas) },
          { etiqueta: "Cruzadas", valor: numero(vista.filasResueltas) },
          { etiqueta: "Productores", valor: numero(vista.productoresModificados) },
          { etiqueta: "Costos a actualizar", valor: numero(vista.costosAabrir) },
        ]}
      />

      {!despues.completo && despues.hectareasSinCosto > 0 && (
        <Aviso tono="atencion">
          {numero(despues.hectareasSinCosto)} hectáreas quedan sin valorizar porque no hay costo
          cargado para {despues.cultivosSinCosto.join(", ")}. El mercado de esos productores va a
          estar incompleto.
        </Aviso>
      )}

      {/* Los errores de resolución ya se explican arriba, con el selector para arreglarlos:
          repetirlos como texto rojo sólo agrega ruido. */}
      <Problemas
        errores={vista.errores.filter((e) => e.codigo !== "resolucion_invalida")}
        advertencias={vista.advertencias}
      />
    </div>
  );
}

function BayerCard() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const share = useEstadoShareBayer();
  const preview = usePreviewBayer();
  const confirmar = useConfirmarBayer();
  const previewShare = usePreviewBayerShare();
  const confirmarShare = useConfirmarBayerShare();

  // Las dos vías escriben lo mismo; gana la última que el usuario haya usado.
  const vista =
    confirmar.data ?? confirmarShare.data ?? preview.data ?? previewShare.data ?? null;
  const desdeShare = Boolean(previewShare.data ?? confirmarShare.data) && !preview.data;
  const trabajando =
    preview.isPending || confirmar.isPending || previewShare.isPending || confirmarShare.isPending;

  function reiniciar() {
    preview.reset();
    confirmar.reset();
    previewShare.reset();
    confirmarShare.reset();
  }

  return (
    <Tarjeta
      paso={3}
      icono={<FileSpreadsheet className="size-4" aria-hidden />}
      titulo="Facturación de Bayer"
      fuente="PLAN DE VENTAS.xlsx · o el archivo de comisiones del share"
      descripcion={
        "Bayer le factura directo al productor y La Clementina cobra comisión, así que esa venta no " +
        "pasa por MacroGest: se suma a la de LC en vez de pisarse. Sin esto la matriz de " +
        "segmentación no puede correr, porque uno de sus criterios es la facturación Bayer."
      }
      error={
        preview.error ?? confirmar.error ?? previewShare.error ?? confirmarShare.error
      }
    >
      {share.data?.disponible && (
        <div className="rounded-md border border-line bg-panel-soft p-3">
          <p className="text-xs text-ink-soft">
            <FolderSearch className="mr-1 inline size-3.5" aria-hidden />
            La app llega al archivo de comisiones del share: se puede importar sin subir nada.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={trabajando}
              onClick={() => {
                reiniciar();
                previewShare.mutate();
              }}
            >
              {previewShare.isPending ? "Leyendo del share…" : "Leer del share"}
            </Button>
            {desdeShare && vista?.puedeConfirmar && !vista.confirmado && vista.tokenPreview && (
              <Button
                type="button"
                size="sm"
                disabled={trabajando}
                onClick={() => confirmarShare.mutate(vista.tokenPreview!)}
              >
                {confirmarShare.isPending ? "Importando…" : "Confirmar importación"}
              </Button>
            )}
          </div>
        </div>
      )}

      {share.data && !share.data.disponible && (
        <Aviso tono="atencion">
          No se puede leer el archivo del share: {share.data.detalle} Subilo a mano acá abajo.
        </Aviso>
      )}

      <SelectorArchivo
        archivo={archivo}
        onElegir={(nuevo) => {
          setArchivo(nuevo);
          reiniciar();
        }}
        accept=".xls,.xlsx"
        deshabilitado={trabajando}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!archivo || trabajando}
          onClick={() => archivo && preview.mutate(archivo)}
        >
          <Upload className="size-3.5" aria-hidden />
          {preview.isPending ? "Analizando…" : "Analizar archivo"}
        </Button>

        {!desdeShare && vista?.puedeConfirmar && !vista.confirmado && vista.tokenPreview && archivo && (
          <Button
            type="button"
            size="sm"
            disabled={trabajando}
            onClick={() =>
              confirmar.mutate({ archivo, tokenPreview: vista.tokenPreview! })
            }
          >
            {confirmar.isPending ? "Importando…" : "Confirmar importación"}
          </Button>
        )}
      </div>

      {vista && <ResumenBayer vista={vista} />}
    </Tarjeta>
  );
}

function ResumenBayer({ vista }: { vista: ImportacionBayerDto }) {
  return (
    <div className="space-y-3">
      {vista.confirmado && (
        <p className="flex items-center gap-1.5 rounded-md border border-verde/30 bg-verde/5 p-2.5 text-xs text-ink">
          <CheckCircle2 className="size-4 shrink-0 text-verde" aria-hidden />
          Importado. Campañas alcanzadas: {vista.campanias.join(", ") || "—"}.
        </p>
      )}
      {vista.yaImportado && !vista.confirmado && (
        <Aviso tono="atencion">
          Este archivo ya se importó antes. Confirmar de nuevo reemplaza la importación anterior.
        </Aviso>
      )}

      <Cifras
        items={[
          { etiqueta: "Filas del archivo", valor: numero(vista.filas) },
          { etiqueta: "Cruzadas con productor", valor: numero(vista.filasConProductor) },
          { etiqueta: "Total del archivo", valor: usd(vista.totalArchivoUsd) },
          { etiqueta: "Total que entra", valor: usd(vista.totalConProductorUsd) },
        ]}
      />

      {vista.filasSinCoincidencia > 0 && (
        <Aviso tono="atencion">
          {numero(vista.filasSinCoincidencia)} filas no encontraron productor en el padrón: su
          facturación no entra al tablero. Si son muchas, revisá que el padrón esté sincronizado.
        </Aviso>
      )}
      {vista.filasVendedorPendiente > 0 && (
        <Aviso tono="atencion">
          {numero(vista.filasVendedorPendiente)} filas traen un vendedor que la app no reconoce.
          Entran igual, pero quedan sin asignar hasta que se cargue la equivalencia.
        </Aviso>
      )}
    </div>
  );
}

/**
 * Filas cuyo CUIT existe en más de una cuenta de MacroGest, así que el cruce automático no puede
 * decidir solo. Frenan la importación entera hasta que alguien elige: importar la mitad sería peor
 * que no importar.
 *
 * Suele ser el mismo productor con una cuenta vieja y una nueva, y MacroGest lo dice en la propia
 * razón social ("NO USAR", "USAR 3751"). Por eso se muestran los nombres completos: la pista para
 * elegir bien ya está ahí.
 */
function ResolverPendientes({
  pendientes,
  elegidos,
  faltan,
  onElegir,
}: {
  pendientes: FilaPendienteImportacionDto[];
  elegidos: Record<string, number>;
  faltan: number;
  onElegir: (filaId: string, productorId: number | null) => void;
}) {
  return (
    <div className="rounded-md border border-clementina-deep/30 bg-clementina/10 p-3">
      <p className="text-xs font-semibold text-ink">
        {numero(pendientes.length)}{" "}
        {pendientes.length === 1 ? "fila necesita" : "filas necesitan"} que elijas el productor
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        El CUIT del archivo aparece en más de una cuenta de MacroGest. Suele ser el mismo productor
        con una cuenta vieja y una nueva; fijate que el nombre en MacroGest muchas veces avisa cuál
        usar. Mientras falte alguna, no se puede importar nada.
      </p>

      <ul className="mt-3 space-y-2">
        {pendientes.map((pendiente) => (
          <li
            key={pendiente.filaId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-panel p-2.5"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink">
                {pendiente.razonSocialArchivo ?? "(sin razón social)"}
              </p>
              <p className="text-[11px] text-ink-soft">
                fila {pendiente.fila}
                {pendiente.cuitEnmascarado ? ` · CUIT ${pendiente.cuitEnmascarado}` : ""}
              </p>
            </div>
            <Select
              className="h-8 min-w-72 text-xs"
              value={elegidos[pendiente.filaId] ?? ""}
              onChange={(evento) =>
                onElegir(
                  pendiente.filaId,
                  evento.target.value === "" ? null : Number(evento.target.value),
                )
              }
              aria-label={`Productor para ${pendiente.razonSocialArchivo ?? `la fila ${pendiente.fila}`}`}
            >
              <option value="">— elegí el productor —</option>
              {pendiente.candidatos.map((candidato) => (
                <option key={candidato.productorId} value={candidato.productorId}>
                  {candidato.cuentaMacroGest != null ? `${candidato.cuentaMacroGest} · ` : ""}
                  {candidato.razonSocial}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 text-xs text-ink-soft">
        {faltan === 0
          ? "Listo. Volvé a analizar para que el archivo entre completo."
          : `Falta${faltan === 1 ? "" : "n"} ${numero(faltan)}.`}
      </p>
    </div>
  );
}

/* ── Piezas compartidas ──────────────────────────────────────────────────── */

function Tarjeta({
  paso,
  icono,
  titulo,
  fuente,
  descripcion,
  error,
  children,
}: {
  paso: number;
  icono: React.ReactNode;
  titulo: string;
  fuente: string;
  descripcion: string;
  error?: unknown;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-clementina/20 text-xs font-semibold text-clementina-deep"
          aria-hidden
        >
          {paso}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            {icono}
            {titulo}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
            {fuente}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{descripcion}</p>

          <div className="mt-3 space-y-3">{children}</div>

          {Boolean(error) && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-rojo/30 bg-rojo-bg p-2.5 text-xs text-rojo"
            >
              {toAppError(error).message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function SelectorArchivo({
  archivo,
  onElegir,
  accept,
  deshabilitado,
}: {
  archivo: File | null;
  onElegir: (archivo: File | null) => void;
  accept: string;
  deshabilitado: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept={accept}
        className="block w-full max-w-md text-xs text-ink-soft file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-panel file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-panel-soft"
        disabled={deshabilitado}
        onChange={(evento) => onElegir(evento.target.files?.[0] ?? null)}
      />
      {archivo && (
        <button
          type="button"
          className="text-xs text-ink-soft underline hover:text-ink"
          onClick={() => {
            if (input.current) input.current.value = "";
            onElegir(null);
          }}
        >
          Quitar
        </button>
      )}
    </div>
  );
}

function Cifras({ items }: { items: { etiqueta: string; valor: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.etiqueta}>
          <dt className="text-[11px] uppercase tracking-wide text-ink-soft">{item.etiqueta}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular text-ink">{item.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Comparacion({
  titulo,
  antes,
  despues,
}: {
  titulo: string;
  antes: string;
  despues: string;
}) {
  const cambia = antes !== despues;
  return (
    <div className="rounded-md border border-line bg-panel-soft p-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-soft">{titulo}</p>
      <p className="mt-1 text-sm tabular text-ink-soft">
        {antes}
        <span aria-hidden> → </span>
        <b className={cn("tabular", cambia ? "text-ink" : "text-ink-soft")}>{despues}</b>
      </p>
    </div>
  );
}

function Aviso({ tono, children }: { tono: "atencion" | "error"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-md border p-2.5 text-xs leading-relaxed",
        tono === "error"
          ? "border-rojo/30 bg-rojo-bg text-ink"
          : "border-clementina-deep/30 bg-clementina/10 text-ink",
      )}
    >
      <AlertTriangle
        className={cn("mt-0.5 size-3.5 shrink-0", tono === "error" ? "text-rojo" : "text-clementina-deep")}
        aria-hidden
      />
      <span>{children}</span>
    </p>
  );
}

function Problemas({
  errores,
  advertencias,
}: {
  errores: { codigo: string; mensaje: string }[];
  advertencias: { codigo: string; mensaje: string }[];
}) {
  if (errores.length === 0 && advertencias.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Se muestran las primeras: una plantilla mal armada puede traer cientos de la misma causa. */}
      {errores.slice(0, 5).map((problema, indice) => (
        <Aviso key={`${problema.codigo}-${indice}`} tono="error">
          {problema.mensaje}
        </Aviso>
      ))}
      {errores.length > 5 && (
        <p className="text-xs text-ink-soft">y {numero(errores.length - 5)} errores más.</p>
      )}
      {advertencias.slice(0, 3).map((problema, indice) => (
        <Aviso key={`${problema.codigo}-${indice}`} tono="atencion">
          {problema.mensaje}
        </Aviso>
      ))}
      {advertencias.length > 3 && (
        <p className="text-xs text-ink-soft">
          y {numero(advertencias.length - 3)} advertencias más.
        </p>
      )}
    </div>
  );
}
