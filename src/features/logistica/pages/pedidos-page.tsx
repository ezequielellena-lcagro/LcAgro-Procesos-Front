import { History, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { PageHeader } from "@/shared/components/page-header";
import { fecha, periodoInicial } from "../format";
import { cursorPropio, useListado } from "../queries/use-logistica";
import type { Pedido, Preventa } from "../types";
import { AvisoDemo } from "../components/aviso-demo";
import { PreventaPicker } from "../components/contrato-picker";
import { HistorialDialog } from "../components/historial-dialog";
import { usePaginacion } from "../lib/paginacion";
import { Paginacion } from "../components/paginacion";
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
  const paginacion = usePaginacion(q);
  return (
    <>
      <PageHeader
        title="Pedidos"
        subtitle="Demanda de productores y preventas de referencia."
        actions={
          gestionar &&
          // Con una preventa elegida en la solapa del ERP, el alta de arriba pasa a ser la de esa
          // preventa: el botón al pie de la grilla quedaba fuera de la vista al scrollear. Al lado
          // va cómo soltarla, porque si no el alta libre queda tapada hasta recargar la página.
          (tab === "erp" && preventa ? (
            <>
              <Button variant="outline" onClick={() => setPreventa(null)}>
                <X className="size-4" aria-hidden /> Quitar selección
              </Button>
              <Button onClick={() => setDialogo({ preventa })}>
                <Plus className="size-4" aria-hidden /> Crear pedido con {preventa.operacion}{" "}
                {preventa.numero}
              </Button>
            </>
          ) : (
            <Button onClick={() => setDialogo({})}>
              <Plus className="size-4" aria-hidden /> Nuevo pedido
            </Button>
          ))
        }
      />
      <AvisoDemo />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="agenda">Pedidos de Logística</TabsTrigger>
          <TabsTrigger value="erp">Preventas MacroGest</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda">
          <PeriodoFiltro value={periodo} onChange={setPeriodo} />
          <TablaLogistica
            titulo="Pedidos de Logística"
            filas={paginacion.filas}
            clave={(f) => f.id}
            cargando={q.isLoading}
            error={q.error}
            reintentar={() => void q.refetch()}
            vacio="Todavía no hay pedidos para estas fechas. Registrá el primer pedido del productor."
            pie={<Paginacion {...paginacion} unidad={{ singular: "pedido", plural: "pedidos" }} />}
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
                        <Pencil className="size-4" aria-hidden /> Corregir
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setHistoria(f.id)}>
                      <History className="size-4" aria-hidden /> Historial
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="erp">
          <PreventaPicker selected={preventa} onSelect={setPreventa} />
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
