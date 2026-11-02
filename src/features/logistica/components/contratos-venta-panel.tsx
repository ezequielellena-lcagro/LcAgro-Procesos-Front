import { useState } from "react";
import { Input } from "@/components/ui/input";
import { FilterField } from "@/shared/components/filter-bar";
import { fecha, hoy, kg, sumarDias } from "../format";
import { filtrosComercialesVacios, paramsComerciales } from "../lib/filtros-comerciales";
import { usePaginacion } from "../lib/paginacion";
import { useListado } from "../queries/use-logistica";
import type { ContratoVentaSeguimiento } from "../types";
import { FiltrosComercialesCampos } from "./filtros-comerciales";
import { Paginacion } from "./paginacion";
import { PeriodoFiltro } from "./periodo-filtro";
import { TablaLogistica } from "./tabla-logistica";

const filtrosVacios = { ...filtrosComercialesVacios, buscar: "" };
const TONO: Record<ContratoVentaSeguimiento["estado"], string> = {
  "Vencido, falta entregar": "font-medium text-rojo",
  "Vencido, entregado de más": "font-medium text-clementina-deep",
  "Entregado de más": "text-clementina-deep",
  Vigente: "text-ink",
  Cumplido: "font-medium text-verde",
};

/**
 * Seguimiento de contratos de venta (pedido el 15/10 y el 28/10): cuánto se contrató, cuánto se
 * entregó (kilos cargados: las cartas de porte del contrato, directo y planta) y cuánto falta, con el
 * fin del plazo de entrega. Primero los vencidos con saldo. Todo sale de MacroGest al leer.
 */
export function ContratosVentaPanel({ activo }: { activo: boolean }) {
  // Por defecto, los plazos que vencieron en los últimos 90 días y los del próximo año.
  const [periodo, setPeriodo] = useState(() => ({
    desde: sumarDias(hoy(), -90),
    hastaExclusivo: sumarDias(hoy(), 366),
  }));
  const [borrador, setBorrador] = useState(filtrosVacios);
  const [aplicados, setAplicados] = useState(filtrosVacios);
  const buscar = aplicados.buscar.trim();
  const lista = useListado<ContratoVentaSeguimiento>(
    "contratos/seguimiento",
    {
      ...periodo,
      ...paramsComerciales(aplicados),
      buscar: buscar.length >= 2 ? buscar : undefined,
    },
    (f) => ({ despues: f.posicion }),
    activo,
    undefined,
    50,
  );
  const paginacion = usePaginacion(lista);
  return (
    <section aria-label="Contratos de venta" className="min-w-0 space-y-3">
      <p className="text-sm text-ink-soft">
        Lo contratado, lo entregado (kilos cargados, directo y planta) y lo que falta de cada
        contrato de venta, con el fin del plazo de entrega. Primero los vencidos con saldo.
      </p>
      <PeriodoFiltro
        value={periodo}
        onChange={setPeriodo}
        maxDias={1100}
        etiquetas={{ desde: "Fin del plazo desde", hasta: "Fin del plazo hasta" }}
        onSubmit={(e) => {
          e.preventDefault();
          setAplicados({ ...borrador });
        }}
      >
        <FiltrosComercialesCampos
          value={borrador}
          onChange={(v) => setBorrador({ ...borrador, ...v })}
          onClear={() => {
            setBorrador(filtrosVacios);
            setAplicados(filtrosVacios);
          }}
        >
          <FilterField label="Contrato o comprador">
            <Input
              className="w-56"
              maxLength={80}
              value={borrador.buscar}
              onChange={(e) => setBorrador({ ...borrador, buscar: e.target.value })}
            />
          </FilterField>
        </FiltrosComercialesCampos>
      </PeriodoFiltro>
      <TablaLogistica
        titulo="Seguimiento de contratos de venta"
        filas={paginacion.filas}
        clave={(f) => f.numero}
        cargando={lista.isLoading}
        error={lista.error}
        reintentar={() => void lista.refetch()}
        pie={<Paginacion {...paginacion} unidad={{ singular: "contrato", plural: "contratos" }} />}
        vacio="No hay contratos de venta con el plazo de entrega en estas fechas."
        columnas={[
          {
            titulo: "Contrato",
            celda: (f) => (
              <span>
                {f.numero}
                <span className="block text-xs text-ink-soft">
                  {f.compradorNombre ?? "Sin comprador"}
                </span>
              </span>
            ),
          },
          {
            titulo: "Cereal / campaña",
            celda: (f) =>
              `${f.productoNombre ?? f.producto ?? "Sin cereal"} ${f.campania ?? ""}`.trim(),
          },
          {
            titulo: "Plazo de entrega",
            celda: (f) => (
              <span className="whitespace-nowrap">
                {fecha(f.entregaDesde)} – {fecha(f.entregaHasta)}
              </span>
            ),
          },
          { titulo: "Contratado", numero: true, celda: (f) => kg(f.contratado) },
          {
            titulo: "Entregado",
            numero: true,
            celda: (f) => (
              <span>
                {kg(f.entregado)}
                <span className="block text-xs text-ink-soft">
                  {f.camiones} {f.camiones === 1 ? "camión" : "camiones"}
                </span>
              </span>
            ),
          },
          {
            titulo: "Saldo",
            numero: true,
            celda: (f) => (
              <span className={f.saldo < 0 ? "text-clementina-deep" : undefined}>
                {kg(f.saldo)}
              </span>
            ),
          },
          {
            titulo: "Cupos que faltan",
            numero: true,
            celda: (f) => (f.cuposFaltan > 0 ? f.cuposFaltan : "—"),
          },
          {
            titulo: "Estado",
            celda: (f) => <span className={`whitespace-nowrap ${TONO[f.estado]}`}>{f.estado}</span>,
          },
        ]}
      />
    </section>
  );
}
