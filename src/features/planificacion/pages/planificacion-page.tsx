import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/shared/components/page-header";
import { CarteraTab } from "../components/cartera-tab";
import { ObjetivosTab } from "../components/objetivos-tab";
import { SegmentacionTab } from "../components/segmentacion-tab";
import { claveCampania, fraccionEstacional } from "../lib/campanias";
import { CRITERIOS, calcular } from "../lib/segmentacion";
import { COSTOS, FECHA_CORTE, OBJETIVOS_LINEA, PRODUCTORES } from "../mock/datos";
import type { CriterioMatriz, ObjetivoLinea } from "../types";

type Tab = "cartera" | "segmentacion" | "objetivos";

/**
 * Planificación de Ventas.
 *
 * ⚠️ PANTALLA MOCKUP — sin API, datos de ejemplo (ver `mock/datos.ts`).
 *
 * La unidad de análisis es el **productor**: del plan de siembra sale cuánto va a gastar en
 * insumos, contra eso se pone lo que le vendimos (La Clementina + Bayer), y la diferencia es
 * la oportunidad. La lectura por vendedor es una agregación de eso.
 */
export function PlanificacionPage() {
  const [tab, setTab] = useState<Tab>("cartera");
  const [criterios, setCriterios] = useState<CriterioMatriz[]>(CRITERIOS);
  const [lineas, setLineas] = useState<ObjetivoLinea[]>(OBJETIVOS_LINEA);

  const hoy = FECHA_CORTE;
  const campania = claveCampania(hoy);
  const campaniaPrev = claveCampania(hoy, 1);
  const esperado = useMemo(() => fraccionEstacional(hoy), [hoy]);

  // El score y el segmento se recalculan cuando cambia la matriz: es el punto de la pantalla.
  const productores = useMemo(
    () => PRODUCTORES.map((p) => calcular(p, COSTOS, criterios)),
    [criterios],
  );

  return (
    <div>
      <PageHeader
        title="Planificación de Ventas"
        subtitle={`Qué va a gastar cada productor, cuánto le vendemos y dónde está la oportunidad · campaña ${campania}`}
        actions={
          <span className="rounded-md border border-clementina-deep/40 bg-clementina/10 px-2 py-1 text-xs font-semibold text-clementina-deep">
            MOCKUP · datos de ejemplo
          </span>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="cartera">Cartera de productores</TabsTrigger>
          <TabsTrigger value="segmentacion">Segmentación</TabsTrigger>
          <TabsTrigger value="objetivos">Objetivos y avance</TabsTrigger>
        </TabsList>

        <TabsContent value="cartera">
          <CarteraTab
            productores={productores}
            costos={COSTOS}
            criterios={criterios}
            campania={campania}
          />
        </TabsContent>

        <TabsContent value="segmentacion">
          <SegmentacionTab productores={productores} criterios={criterios} onCambiar={setCriterios} />
        </TabsContent>

        <TabsContent value="objetivos">
          <ObjetivosTab
            productores={productores}
            lineas={lineas}
            onCambiar={setLineas}
            esperado={esperado}
            campania={campania}
            campaniaPrev={campaniaPrev}
          />
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-soft">
        Los nombres de productor son inventados; la economía (hectáreas, mercado, facturación,
        mix y score) sale de una muestra del <b>PLAN DE VENTAS</b> real. Campaña única
        <b> 1-abr a 31-mar</b> para todo, por rango de fechas, como lo confirmó el cliente.
      </p>
    </div>
  );
}
