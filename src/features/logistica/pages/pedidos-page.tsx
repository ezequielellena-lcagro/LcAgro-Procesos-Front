import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { PageHeader } from "@/shared/components/page-header";
import { fecha, periodoInicial } from "../format";
import { cursorPropio, useListado } from "../queries/use-logistica";
import type { Pedido, Preventa } from "../types";
import { PreventaPicker } from "../components/contrato-picker";
import { HistorialDialog } from "../components/historial-dialog";
import { LogisticaNav } from "../components/logistica-nav";
import { PedidoDialog } from "../components/pedido-dialog";
import { PeriodoFiltro } from "../components/periodo-filtro";
import { TablaLogistica } from "../components/tabla-logistica";
export function PedidosPage() {
  const { user } = useAuth();
  const gestionar = user?.roles.includes("logistica-pedidos") ?? false;
  const [tab, setTab] = useState("agenda");
  const [periodo, setPeriodo] = useState(() => periodoInicial());
  const [historia, setHistoria] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<{ pedido?: Pedido; preventa?: Preventa } | null>(null);
  const [preventa, setPreventa] = useState<Preventa | null>(null);
  const q = useListado<Pedido>("pedidos", periodo, cursorPropio);
  return (
    <>
      <PageHeader
        title="Pedidos"
        subtitle="Demanda de productores y preventas de referencia."
        actions={gestionar && <Button onClick={() => setDialogo({})}>Nuevo pedido</Button>}
      />
      <LogisticaNav />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="agenda">Pedidos de Logística</TabsTrigger>
          <TabsTrigger value="erp">Preventas MacroGest</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda">
          <PeriodoFiltro value={periodo} onChange={setPeriodo} />
          <TablaLogistica
            titulo="Pedidos de Logística"
            filas={q.data?.pages.flatMap((p) => p.filas) ?? []}
            clave={(f) => f.id}
            cargando={q.isLoading}
            error={q.error}
            reintentar={() => void q.refetch()}
            hayMas={q.hasNextPage}
            mas={() => void q.fetchNextPage()}
            cargandoMas={q.isFetchingNextPage}
            vacio="Todavía no hay pedidos para estas fechas. Registrá el primer pedido del productor."
            columnas={[
              {
                titulo: "Productor",
                celda: (f) => (
                  <>
                    <span className="font-medium">{f.clienteNombre ?? "Nombre no disponible"}</span>
                    <div className="text-xs text-ink-soft">Cliente {f.clienteNumero}</div>
                  </>
                ),
              },
              {
                titulo: "Preventa",
                celda: (f) =>
                  f.preventa ? `${f.preventa.operacion} ${f.preventa.numero}` : "Sin preventa",
              },
              {
                titulo: "Cereal / campaña",
                celda: (f) => `${f.productoNombre ?? f.producto} / ${f.campania}`,
              },
              { titulo: "Para cuándo", celda: (f) => fecha(f.fechaSolicitada) },
              { titulo: "Solicitados", numero: true, celda: (f) => f.cantidadCupos },
              { titulo: "Otorgados", numero: true, celda: (f) => f.otorgados },
              { titulo: "Pendientes", numero: true, celda: (f) => f.pendientes },
              { titulo: "Estado", celda: (f) => f.estado },
              {
                titulo: "Acciones",
                celda: (f) => (
                  <div className="flex gap-1">
                    {gestionar && (
                      <Button size="sm" variant="outline" onClick={() => setDialogo({ pedido: f })}>
                        Corregir
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setHistoria(f.id)}>
                      Historial
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="erp">
          <p className="mb-3 text-sm text-ink-soft">
            MacroGest · sólo lectura. Seleccioná una preventa para ver sus campos en tabla.
          </p>
          <PreventaPicker selected={preventa} onSelect={setPreventa} />
          {gestionar && preventa && (
            <Button className="mt-4" onClick={() => setDialogo({ preventa })}>
              Crear pedido con esta preventa
            </Button>
          )}
        </TabsContent>
      </Tabs>
      {dialogo && (
        <PedidoDialog
          pedido={dialogo.pedido}
          preventaInicial={dialogo.preventa}
          onClose={() => setDialogo(null)}
        />
      )}
      {historia && (
        <HistorialDialog recurso="pedidos" id={historia} onClose={() => setHistoria(null)} />
      )}
    </>
  );
}
