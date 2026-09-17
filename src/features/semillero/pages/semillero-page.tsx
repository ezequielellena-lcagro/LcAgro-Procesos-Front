import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/lib/env";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { CatalogosPanel } from "../components/catalogos-panel";
import { LoteDialog } from "../components/lote-dialog";
import { MovimientoDialog } from "../components/movimiento-dialog";
import { MovimientosPanel } from "../components/movimientos-panel";
import { OrdenDialog } from "../components/orden-dialog";
import { OrdenImprimible } from "../components/orden-imprimible";
import { OrdenesPanel } from "../components/ordenes-panel";
import { PedidoOrdenAviso } from "../components/pedido-orden-aviso";
import { SemilleroKpis } from "../components/semillero-kpis";
import type { OperacionStock } from "../components/stock-panel";
import { StockPanel } from "../components/stock-panel";
import { useDestinos, useCrearDestino, useGuardarDestino } from "../queries/use-destinos";
import { useClientesSemillero, useSincronizarClientes } from "../queries/use-clientes-semillero";
import { useExportarMovimientos, useExportarOrdenes, useExportarStock } from "../queries/use-semillero-excel";
import {
  useActualizarLote,
  useActualizarOrden,
  useAnularOrden,
  useCrearLote,
  useCrearOrden,
  useDespacharOrden,
  useGuardarUbicacion,
  useGuardarVariedad,
  useRegistrarAjuste,
  useRegistrarIngreso,
  useReubicar,
} from "../queries/use-semillero-mutations";
import {
  useCatalogosSemillero,
  useLotesSemillero,
  useMovimientosSemillero,
  useOrdenesCarga,
  useStockSemillero,
} from "../queries/use-semillero";
import type {
  EstadoCopiaClientesDto,
  MovimientoFiltros,
  OrdenCargaDto,
  OrdenCargaFiltros,
  StockFilaDto,
  StockFiltros,
} from "../types";
import { usePedidoOrden } from "./use-pedido-orden";

type Pestania = "stock" | "ordenes" | "movimientos" | "catalogos";

/** Mientras la copia de clientes todavía no se pidió (o sigue en camino), se asume lo más cauto. */
const COPIA_CLIENTES_CARGANDO: EstadoCopiaClientesDto = {
  ultimaSincronizacion: null,
  ultimoIntentoFallido: null,
  ultimoError: null,
  desactualizada: true,
  sinCopia: true,
  cantidad: 0,
};

/**
 * Semillero · Stock y Órdenes de Carga (Fase 1, soja 2026-2027). Reemplaza SeedStock, la herramienta
 * casera de la planta (stock por lote + órdenes de carga), que sigue en uso hasta la aceptación.
 *
 * Página "tonta": es dueña de filtros, pestaña activa y qué diálogo está abierto, y delega todo el
 * resto a los paneles/diálogos de F5-F12 (cada uno ya probado por su cuenta). Lo que el diálogo de
 * orden espera antes de abrirse (stock completo al día, copia de clientes) lo coordina
 * `usePedidoOrden`. La copia de clientes de MacroGest (R2.2/R2.3) es cara — puede refrescar contra
 * MacroGest — así que sólo se pide cuando hace falta: al abrir un diálogo que la necesita (lote,
 * orden) o en las pestañas Órdenes/Catálogos, que tienen su propio selector de cliente. La pestaña
 * Movimientos nunca la necesita.
 */
export function SemilleroPage() {
  const [pestania, setPestania] = useState<Pestania>("stock");

  const [stockFiltros, setStockFiltros] = useState<StockFiltros>({});
  const [ordenesFiltros, setOrdenesFiltros] = useState<OrdenCargaFiltros>({});
  const [movimientosFiltros, setMovimientosFiltros] = useState<MovimientoFiltros>({});

  const [loteDialogAbierto, setLoteDialogAbierto] = useState(false);
  const [loteEditandoId, setLoteEditandoId] = useState<number | null>(null);
  const [movimiento, setMovimiento] = useState<{ operacion: OperacionStock; fila: StockFilaDto } | null>(null);
  const [ordenImprimiendo, setOrdenImprimiendo] = useState<OrdenCargaDto | null>(null);
  const [clienteCatalogoElegido, setClienteCatalogoElegido] = useState<number | null>(null);
  const pedidoOrden = usePedidoOrden();

  // La copia de clientes (R2.2/R2.3) se pide sólo cuando algo de lo montado la necesita: un diálogo
  // de lote abierto, o las pestañas que tienen su propio selector de cliente (filtro de Órdenes,
  // Destinos por cliente en Catálogos). Movimientos nunca la necesita; el pedido de orden la pide
  // por su cuenta (`usePedidoOrden`).
  const clientesHabilitado = loteDialogAbierto || pestania === "ordenes" || pestania === "catalogos";

  const stock = useStockSemillero(stockFiltros);
  const ordenes = useOrdenesCarga(ordenesFiltros);
  const movimientos = useMovimientosSemillero(movimientosFiltros, pestania === "movimientos");
  const catalogos = useCatalogosSemillero();
  const clientes = useClientesSemillero(clientesHabilitado);
  const listaClientes = clientes.data?.clientes ?? [];
  // Todos los atributos del lote, incluidos duenioEditable/envaseYPesoEditables (ausentes en las
  // filas de stock): sólo hace falta al editar uno existente.
  const lotes = useLotesSemillero(loteDialogAbierto && loteEditandoId !== null);
  const destinosOrden = useDestinos(pedidoOrden.cliente ?? undefined);
  const destinosCatalogo = useDestinos(clienteCatalogoElegido ?? undefined, true);

  const sincronizarClientes = useSincronizarClientes();
  const crearLote = useCrearLote();
  const actualizarLote = useActualizarLote();
  const registrarIngreso = useRegistrarIngreso();
  const registrarAjuste = useRegistrarAjuste();
  const reubicar = useReubicar();
  const crearOrden = useCrearOrden();
  const actualizarOrden = useActualizarOrden();
  const despacharOrden = useDespacharOrden();
  const anularOrden = useAnularOrden();
  const guardarVariedad = useGuardarVariedad();
  const guardarUbicacion = useGuardarUbicacion();
  const crearDestinoOrden = useCrearDestino(pedidoOrden.cliente ?? 0);
  const crearDestinoCatalogo = useCrearDestino(clienteCatalogoElegido ?? 0);
  const guardarDestinoCatalogo = useGuardarDestino(clienteCatalogoElegido ?? 0);

  const exportarStock = useExportarStock();
  const exportarOrdenes = useExportarOrdenes();
  const exportarMovimientos = useExportarMovimientos();

  const error = stock.error ?? ordenes.error ?? catalogos.error;
  const listoParaMostrar = stock.data && ordenes.data && catalogos.data;

  const abrirNuevoLote = () => {
    setLoteEditandoId(null);
    setLoteDialogAbierto(true);
  };
  const abrirEditarLote = (loteId: number) => {
    setLoteEditandoId(loteId);
    setLoteDialogAbierto(true);
  };
  const cerrarLoteDialog = () => {
    setLoteDialogAbierto(false);
    setLoteEditandoId(null);
  };

  const loteParaEditar =
    loteEditandoId === null ? null : (lotes.data?.find((l) => l.id === loteEditandoId) ?? null);
  // Con un id en edición, el diálogo no se abre hasta tener el LoteDto completo (duenioEditable /
  // envaseYPesoEditables no viajan en las filas de stock): evita un parpadeo mostrando "Nuevo lote".
  const loteDialogListoParaAbrir = loteDialogAbierto && (loteEditandoId === null || loteParaEditar !== null);

  const copiaClientes = clientes.data?.copia ?? COPIA_CLIENTES_CARGANDO;

  return (
    <>
      {/* Sin acciones en el header: StockPanel y OrdenesPanel ya traen su propio botón de alta
          ("Nuevo lote"/"Nueva orden") en el `FilterBar` de cada pestaña; duplicarlo acá confundiría
          más de lo que ayuda (dos botones con el mismo texto a la vez). */}
      <PageHeader
        title="Stock y Órdenes de Carga"
        subtitle="Semilla por lote y ubicación, y lo que se carga a cada cliente."
      />

      {env.useMocks && (
        <p className="no-print mb-3 inline-block rounded-md border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-clementina-deep">
          Datos de ejemplo (ficticios).
        </p>
      )}

      {/* Fuera del bloque de error: aunque la página no se pueda mostrar, el pedido se puede cancelar. */}
      {pedidoOrden.esperando && (
        <PedidoOrdenAviso
          error={pedidoOrden.fallo}
          onReintentar={pedidoOrden.reintentar}
          onCancelar={pedidoOrden.cerrar}
        />
      )}

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void stock.refetch();
            void ordenes.refetch();
            void catalogos.refetch();
          }}
        />
      ) : !listoParaMostrar ? (
        <p className="py-8 text-center text-ink-soft">Cargando el semillero…</p>
      ) : (
        <div className="space-y-4">
          <SemilleroKpis totales={stock.data.totales} />

          <Tabs value={pestania} onValueChange={setPestania} className="space-y-3">
            <TabsList>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              {/* Mismo dato que el KPI "Órdenes pendientes" (`SemilleroKpis`): nunca el total de
                  órdenes, que se queda alto aunque no quede ninguna accionable (recorrida 2026-09-16). */}
              <TabsTrigger value="ordenes">
                Órdenes de carga ({stock.data.totales.ordenesPendientes})
              </TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
            </TabsList>

            <TabsContent value="stock">
              <StockPanel
                datos={stock.data}
                cargando={stock.isPending || stock.isFetching}
                variedades={catalogos.data.variedades}
                campanias={catalogos.data.campanias}
                filtros={stockFiltros}
                onFiltros={setStockFiltros}
                onNuevoLote={abrirNuevoLote}
                onEditarLote={abrirEditarLote}
                onMovimiento={(operacion, fila) => setMovimiento({ operacion, fila })}
                onOrden={pedidoOrden.abrirDesdeStock}
                onExcel={() => exportarStock.mutate(stockFiltros)}
                descargando={exportarStock.isPending}
              />
            </TabsContent>

            <TabsContent value="ordenes">
              <OrdenesPanel
                datos={ordenes.data}
                cargando={ordenes.isPending || ordenes.isFetching}
                clientes={listaClientes}
                filtros={ordenesFiltros}
                onFiltros={setOrdenesFiltros}
                onNuevaOrden={pedidoOrden.abrirNueva}
                onEditarOrden={pedidoOrden.abrirEdicion}
                onDespachar={(id, input) => despacharOrden.mutateAsync({ id, ...input })}
                onAnular={(id, input) => anularOrden.mutateAsync({ id, ...input })}
                onErrorRefrescarStock={() => void stock.refetch()}
                onExcel={() => exportarOrdenes.mutate(ordenesFiltros)}
                descargando={exportarOrdenes.isPending}
                onImprimir={setOrdenImprimiendo}
              />
            </TabsContent>

            <TabsContent value="movimientos">
              <MovimientosPanel
                movimientos={movimientos.data}
                cargando={movimientos.isPending || movimientos.isFetching}
                error={movimientos.error}
                onReintentar={() => void movimientos.refetch()}
                filtros={movimientosFiltros}
                onFiltros={setMovimientosFiltros}
                onExcel={() => exportarMovimientos.mutate(movimientosFiltros)}
                descargando={exportarMovimientos.isPending}
              />
            </TabsContent>

            <TabsContent value="catalogos">
              <CatalogosPanel
                datos={catalogos.data}
                onGuardarVariedad={(input) => guardarVariedad.mutateAsync(input)}
                onGuardarUbicacion={(input) => guardarUbicacion.mutateAsync(input)}
                clientes={listaClientes}
                copiaClientes={copiaClientes}
                actualizandoClientes={sincronizarClientes.isPending}
                onActualizarClientes={() => sincronizarClientes.mutate()}
                clienteElegido={clienteCatalogoElegido}
                onClienteChange={setClienteCatalogoElegido}
                destinos={destinosCatalogo.data ?? []}
                cargandoDestinos={destinosCatalogo.isPending}
                onAgregarDestino={(nombre) => crearDestinoCatalogo.mutateAsync({ nombre })}
                onGuardarDestino={(input) => guardarDestinoCatalogo.mutateAsync(input)}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <LoteDialog
        open={loteDialogListoParaAbrir}
        lote={loteParaEditar}
        variedades={catalogos.data?.variedades ?? []}
        ubicaciones={catalogos.data?.ubicaciones ?? []}
        campanias={catalogos.data?.campanias ?? []}
        campaniaSugerida={catalogos.data?.campaniaSugerida ?? ""}
        clientes={listaClientes}
        onCrear={(input) => crearLote.mutateAsync(input)}
        onActualizar={(id, input) => actualizarLote.mutateAsync({ id, ...input })}
        onClose={cerrarLoteDialog}
      />

      <MovimientoDialog
        operacion={movimiento?.operacion ?? null}
        fila={movimiento?.fila ?? null}
        ubicaciones={catalogos.data?.ubicaciones ?? []}
        onIngreso={(input) => registrarIngreso.mutateAsync(input)}
        onAjuste={(input) => registrarAjuste.mutateAsync(input)}
        onReubicar={(input) => reubicar.mutateAsync(input)}
        onClose={() => setMovimiento(null)}
      />

      <OrdenDialog
        open={pedidoOrden.abierto}
        orden={pedidoOrden.orden}
        clientes={listaClientes}
        copiaClientes={copiaClientes}
        actualizandoClientes={sincronizarClientes.isPending}
        onActualizarClientes={() => sincronizarClientes.mutate()}
        filas={pedidoOrden.filas}
        filaOrigen={pedidoOrden.filaOrigen}
        clienteInicial={pedidoOrden.cliente}
        destinos={destinosOrden.data ?? []}
        onClienteChange={pedidoOrden.elegirCliente}
        onAgregarDestino={(nombre) => crearDestinoOrden.mutateAsync({ nombre })}
        onCrear={(input) => crearOrden.mutateAsync(input)}
        onActualizar={(id, input) => actualizarOrden.mutateAsync({ id, ...input })}
        onClose={pedidoOrden.cerrar}
      />

      <OrdenImprimible orden={ordenImprimiendo} onClose={() => setOrdenImprimiendo(null)} />
    </>
  );
}
