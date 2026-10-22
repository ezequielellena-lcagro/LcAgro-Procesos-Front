import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { FilterField } from "@/shared/components/filter-bar";
import { periodoInicial, campania, fecha, kg } from "../format";
import { useListado } from "../queries/use-logistica";
import type { Preventa, Venta } from "../types";
import { usePaginacion } from "../lib/paginacion";
import { Paginacion } from "./paginacion";
import { TablaLogistica } from "./tabla-logistica";
import { PeriodoFiltro } from "./periodo-filtro";
import { Elegir } from "./elegir";
import { FiltrosComercialesCampos } from "./filtros-comerciales";
import { filtrosComercialesVacios, paramsComercialesErp } from "../lib/filtros-comerciales";
/**
 * Por qué una preventa no se puede usar como referencia de un pedido.
 *
 * El control de campaña mira el FORMATO además de la presencia: una campaña que no sea de ocho
 * dígitos se formatea como "Sin campaña", que el formulario del pedido rechaza, y el productor y el
 * cereal están ocultos en esa modalidad — con lo cual el pedido quedaba trabado sin campo que tocar.
 */
function motivoPreventa(
  p: Preventa,
  filtros?: { clienteNumero: number; producto: number; campania: number },
): string | null {
  if (p.estado === "A") return "Preventa anulada";
  if (!p.clienteNumero) return "Sin productor en MacroGest";
  if (!p.producto) return "Sin cereal en MacroGest";
  if (!p.campania || campania(p.campania) === "Sin campaña") return "Campaña inválida en MacroGest";
  if (filtros) {
    if (p.clienteNumero !== filtros.clienteNumero) return "De otro productor";
    if (p.producto !== filtros.producto) return "De otro cereal";
    if (p.campania !== filtros.campania) return "De otra campaña";
  }
  return null;
}

/** Por qué un contrato de venta no sirve para pedir o recibir cupos. */
function motivoVenta(v: Venta): string | null {
  if (v.estado === "A") return "Contrato anulado";
  if (!v.producto) return "Sin cereal en MacroGest";
  if (!v.campania || campania(v.campania) === "Sin campaña") return "Campaña inválida en MacroGest";
  return null;
}

export function PreventaPicker({
  selected,
  onSelect,
  filtros,
  paginaContexto,
  busquedaInicial = "",
  bajoFiltros,
  tamano,
}: {
  selected: Preventa | null;
  /** `null` cuando se suelta la preventa elegida. */
  onSelect: (p: Preventa | null) => void;
  filtros?: { clienteNumero: number; producto: number; campania: number };
  paginaContexto?: object;
  /** Búsqueda con la que arranca el listado: abrir con una preventa ya elegida la muestra sola. */
  busquedaInicial?: string;
  /** Bloque propio ENTRE la barra de filtros y la tabla, para no cruzar la grilla antes de él. */
  bajoFiltros?: ReactNode;
  /** Filas por página. En un diálogo conviene chico: la tabla comparte alto con el formulario. */
  tamano?: number;
}) {
  const [periodo, setPeriodo] = useState(() => periodoInicial(true));
  const [buscar, setBuscar] = useState(busquedaInicial);
  const [versionFiltros, setVersionFiltros] = useState(0);
  // Cereal y campaña sólo cuando el listado NO viene atado a un cupo ya elegido: en ese caso
  // `filtros` ya fija los tres valores y un filtro del usuario sólo podría contradecirlos.
  const [borrador, setBorrador] = useState(filtrosComercialesVacios);
  const [comercial, setComercial] = useState(filtrosComercialesVacios);
  const q = useListado<Preventa>(
    "preventas",
    {
      ...periodo,
      ...(filtros ?? paramsComercialesErp(comercial)),
      buscar: buscar.trim() || undefined,
    },
    (p) => ({ despuesOperacion: p.operacion, despuesNumero: p.numero }),
    buscar.trim().length !== 1,
    paginaContexto ? { ...paginaContexto, versionFiltros } : undefined,
    tamano,
  );
  const paginacion = usePaginacion(q);
  const aplicar = (nuevos: typeof filtrosComercialesVacios) => {
    setComercial(nuevos);
    setBorrador(nuevos);
    if (paginaContexto) setVersionFiltros((v) => v + 1);
  };
  return (
    <div>
      {/* El período y la búsqueda en la MISMA barra: son los dos filtros del mismo listado. */}
      <PeriodoFiltro
        value={periodo}
        onChange={(nuevo) => {
          setPeriodo(nuevo);
          if (paginaContexto) setVersionFiltros((v) => v + 1);
        }}
        etiqueta="Operación de la preventa"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar(borrador);
        }}
      >
        <FilterField label="Buscar preventa">
          <Input
            className="min-w-[240px]"
            placeholder="Número o nombre del productor"
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value);
              if (paginaContexto) setVersionFiltros((v) => v + 1);
            }}
          />
        </FilterField>
        {!filtros && (
          <FiltrosComercialesCampos
            value={borrador}
            onChange={setBorrador}
            onClear={() => aplicar(filtrosComercialesVacios)}
          />
        )}
      </PeriodoFiltro>
      {bajoFiltros}
      <TablaLogistica
        titulo="Elegir preventa"
        filas={paginacion.filas}
        clave={(p) => `${p.operacion}/${p.numero}`}
        elegida={(p) => selected?.numero === p.numero && selected.operacion === p.operacion}
        cargando={q.isLoading}
        error={q.error}
        reintentar={() => void q.refetch()}
        pie={<Paginacion {...paginacion} unidad={{ singular: "preventa", plural: "preventas" }} />}
        columnas={[
          {
            titulo: "Elegir",
            celda: (p) => {
              const elegida = selected?.numero === p.numero && selected.operacion === p.operacion;
              return (
                <Elegir
                  tipo="radio"
                  etiqueta={`Elegir preventa ${p.numero}`}
                  checked={elegida}
                  motivo={motivoPreventa(p, filtros)}
                  // Un radio no se destilda solo. El clic corre ANTES del change, así que acá se
                  // suelta la que ya estaba elegida; sin esto, una vez tocada una preventa no
                  // había cómo volver a un pedido sin preventa salvo recargando.
                  onClick={() => {
                    if (elegida) onSelect(null);
                  }}
                  onChange={() => onSelect(p)}
                />
              );
            },
          },
          {
            titulo: "Preventa",
            celda: (p) => (
              <span>
                {p.operacion} {p.numero}
              </span>
            ),
          },
          {
            titulo: "Productor",
            celda: (p) => p.clienteNombre ?? `Cliente ${p.clienteNumero ?? "sin identificar"}`,
          },
          {
            titulo: "Cereal / campaña",
            celda: (p) =>
              `${p.productoNombre ?? p.producto ?? "Sin cereal"} / ${campania(p.campania)}`,
          },
          {
            titulo: "Entrega",
            celda: (p) => `${fecha(p.fechaEntregaInicio)} — ${fecha(p.fechaEntregaFin)}`,
          },
          { titulo: "Contratado", numero: true, celda: (p) => kg(p.kgContratados) },
        ]}
      />
      {/* Aclara qué NO es la columna "Contratado". Antes decía "el saldo anterior al inicio de
          Logística queda pendiente de verificación", que no se entendía: lo que importa es que ese
          número es el contrato entero y no el remanente. */}
      <p className="mt-2 text-xs text-ink-soft">
        «Contratado» son los kilos del contrato en MacroGest, no lo que falta entregar: las entregas
        anteriores al inicio de Logística todavía no se descuentan.
      </p>
    </div>
  );
}
export function VentaPicker({
  selected,
  onSelect,
  onSoltar,
  tamano,
}: {
  selected: Venta | null;
  onSelect: (p: Venta) => void;
  /**
   * Suelta el contrato ya elegido cuando se vuelve a tocar su casillero. Un radio no se destilda
   * solo: sin esto, una vez marcado un contrato no había forma de volver atrás salvo recargando.
   * Las pantallas que no la pasan mantienen la elección firme, como antes.
   */
  onSoltar?: () => void;
  /** Filas por página. */
  tamano?: number;
}) {
  const [periodo, setPeriodo] = useState(() => periodoInicial(true));
  const [buscar, setBuscar] = useState("");
  const [borrador, setBorrador] = useState(filtrosComercialesVacios);
  const [comercial, setComercial] = useState(filtrosComercialesVacios);
  const q = useListado<Venta>(
    "contratos",
    { ...periodo, ...paramsComercialesErp(comercial), buscar: buscar.trim() || undefined },
    (p) => ({ despuesNumero: p.numero }),
    buscar.trim().length !== 1,
    undefined,
    tamano,
  );
  // Un tramo por vez con ida y vuelta, igual que el resto de las grillas. El "cargar más filas"
  // dejaba los contratos apilados abajo del buscador y sin forma de volver al tramo anterior.
  const paginacion = usePaginacion(q);
  return (
    <div className="space-y-3">
      {/* Período y búsqueda en la MISMA barra: son los dos filtros del mismo listado. */}
      <PeriodoFiltro
        value={periodo}
        onChange={setPeriodo}
        etiqueta="Operación del contrato"
        onSubmit={(e) => {
          e.preventDefault();
          setComercial(borrador);
        }}
      >
        <FilterField label="Buscar contrato">
          <Input
            className="min-w-[260px]"
            placeholder="Número de contrato o comprador"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </FilterField>
        <FiltrosComercialesCampos
          value={borrador}
          onChange={setBorrador}
          onClear={() => {
            setBorrador(filtrosComercialesVacios);
            setComercial(filtrosComercialesVacios);
          }}
        />
      </PeriodoFiltro>
      <TablaLogistica
        titulo="Elegir contrato de venta"
        filas={paginacion.filas}
        clave={(p) => p.numero}
        elegida={(p) => selected?.numero === p.numero}
        cargando={q.isLoading}
        error={q.error}
        reintentar={() => void q.refetch()}
        pie={<Paginacion {...paginacion} unidad={{ singular: "contrato", plural: "contratos" }} />}
        columnas={[
          {
            titulo: "Elegir",
            celda: (p) => {
              const elegido = selected?.numero === p.numero;
              return (
                <Elegir
                  tipo="radio"
                  name="contrato-venta"
                  etiqueta={`Elegir contrato ${p.numero}`}
                  checked={elegido}
                  motivo={motivoVenta(p)}
                  // El clic corre ANTES del change: acá se suelta el que ya estaba elegido.
                  onClick={() => {
                    if (elegido) onSoltar?.();
                  }}
                  onChange={() => onSelect(p)}
                />
              );
            },
          },
          { titulo: "Contrato", celda: (p) => p.numero },
          { titulo: "Comprador", celda: (p) => p.compradorNombre ?? "Sin nombre" },
          {
            titulo: "Cereal / campaña",
            celda: (p) =>
              `${p.productoNombre ?? p.producto ?? "Sin cereal"} / ${campania(p.campania)}`,
          },
          {
            titulo: "Destino",
            celda: (p) => p.destinoNombre ?? `Código ${p.destinoCodigo ?? "sin dato"}`,
          },
        ]}
      />
    </div>
  );
}
