import type { ExportColumn } from "@/shared/export/export-types";
import type {
  ConsolidadoResponse,
  FilaConsolidado,
  HectareasConsolidado,
  OriginacionConsolidado,
} from "../types";

type Agrupacion = "sucursal" | "vendedor";
type TipoLinea = "grupo" | "productor" | "subtotal" | "carteras" | "fuera" | "ajuste" | "total";

export interface LineaConsolidado {
  tipo: TipoLinea;
  etiqueta: string;
  cuit?: string;
  vendedor?: string | null;
  sucursal?: string | null;
  hectareas?: HectareasConsolidado | null;
  mercadoUsd?: number | null;
  facturacionLcUsd?: number;
  facturacionLcAnteriorUsd?: number;
  variacionLc?: number | null;
  participacionLc?: number | null;
  originacionTn?: OriginacionConsolidado;
  potencialTn?: number | null;
  compraInsumos?: FilaConsolidado["compraInsumos"];
}

const colador = new Intl.Collator("es-AR", { numeric: true, sensitivity: "base" });

/** El servidor calcula importes, subtotales y total general. Acá sólo se ordenan las líneas visibles. */
export function armarLineasConsolidado(
  datos: ConsolidadoResponse,
  agrupacion: Agrupacion,
  gestion: boolean,
  filtros: { vendedorId?: number; sucursalId?: number; vendedorPropioId?: number },
): LineaConsolidado[] {
  const filas = gestion ? datos.filas : datos.filas.filter((fila) => fila.vendedorId === filtros.vendedorPropioId);
  const grupos = new Map<number | null, FilaConsolidado[]>();
  for (const fila of filas) {
    const id = agrupacion === "sucursal" ? fila.sucursalId : fila.vendedorId;
    const grupo = grupos.get(id);
    if (grupo) grupo.push(fila);
    else grupos.set(id, [fila]);
  }
  const subtotales = agrupacion === "sucursal" ? datos.subtotalesSucursales : datos.subtotalesVendedores;
  const lineas: LineaConsolidado[] = [];
  const gruposOrdenados = [...grupos.entries()].sort(([a, af], [b, bf]) =>
    a === null ? 1 : b === null ? -1 : colador.compare(
      agrupacion === "sucursal" ? af[0].sucursal ?? "" : af[0].vendedor ?? "",
      agrupacion === "sucursal" ? bf[0].sucursal ?? "" : bf[0].vendedor ?? "",
    ));
  for (const [id, productores] of gruposOrdenados) {
    const nombre = agrupacion === "sucursal"
      ? productores[0].sucursal ?? "Sin vendedor"
      : productores[0].vendedor ?? "Sin vendedor";
    lineas.push({ tipo: "grupo", etiqueta: `${agrupacion === "sucursal" ? "Sucursal" : "Vendedor"}: ${nombre}` });
    for (const productor of [...productores].sort((a, b) =>
      colador.compare(a.razonSocial, b.razonSocial) || a.cuit.localeCompare(b.cuit))) {
      lineas.push({ ...productor, tipo: "productor", etiqueta: productor.razonSocial });
    }
    const subtotal = id === null ? undefined : subtotales.find((item) => item.id === id)?.totales;
    if (subtotal) lineas.push({ ...subtotal, tipo: "subtotal", etiqueta: `Subtotal ${nombre}` });
  }
  const todos = gestion && filtros.vendedorId === undefined && filtros.sucursalId === undefined;
  if (todos) lineas.push({ ...datos.total, tipo: "carteras", etiqueta: "Total carteras" });
  if (todos && datos.fueraDeCarteras) {
    lineas.push({
      tipo: "fuera",
      etiqueta: "Fuera de carteras / sin CUIT",
      facturacionLcUsd: datos.fueraDeCarteras.facturacionLcUsd,
      facturacionLcAnteriorUsd: datos.fueraDeCarteras.facturacionLcAnteriorUsd,
      originacionTn: datos.fueraDeCarteras.originacionTn,
    });
  }
  lineas.push({
    tipo: "ajuste", etiqueta: "Ajuste de redondeo",
    facturacionLcUsd: datos.ajusteRedondeo.campaniaUsd,
    facturacionLcAnteriorUsd: datos.ajusteRedondeo.anteriorUsd,
  });
  lineas.push({ ...datos.totalGeneral, tipo: "total", etiqueta: "TOTAL" });
  return lineas;
}

export type Columna = ExportColumn<LineaConsolidado> & { key: string };

export function columnasConsolidado(verSorgoGirasol: boolean): Columna[] {
  const columnas: Columna[] = [
    { key: "productor", header: "Productor", get: (l) => l.cuit ? `${l.etiqueta} · ${l.cuit}` : l.etiqueta },
    { key: "vendedor", header: "Vendedor", get: (l) => l.vendedor ?? null },
    { key: "sucursal", header: "Sucursal", get: (l) => l.sucursal ?? null },
    { key: "soja", header: "Soja ha", get: (l) => l.hectareas?.soja ?? null, format: "number" },
    { key: "maiz", header: "Maíz ha", get: (l) => l.hectareas?.maiz ?? null, format: "number" },
    { key: "trigo", header: "Trigo ha", get: (l) => l.hectareas?.trigo ?? null, format: "number" },
    { key: "otro", header: "Otro ha", get: (l) => l.hectareas?.otro ?? null, format: "number" },
    { key: "totalHa", header: "Total ha", get: (l) => l.hectareas?.total ?? null, format: "number" },
    { key: "mercado", header: "Mercado USD", get: (l) => l.mercadoUsd ?? null, format: "usd" },
    { key: "lc", header: "LC campaña USD", get: (l) => l.facturacionLcUsd ?? null, format: "usd" },
    { key: "lcAnterior", header: "LC anterior USD", get: (l) => l.facturacionLcAnteriorUsd ?? null, format: "usd" },
    { key: "variacion", header: "Var. % LC", get: (l) => l.variacionLc == null ? null : l.variacionLc * 100, format: "percent" },
    { key: "participacion", header: "Participación LC", get: (l) => l.participacionLc == null ? null : l.participacionLc * 100, format: "percent" },
    { key: "origenAnterior", header: "Originación anterior tn", get: (l) => l.originacionTn?.anterior ?? null, format: "number3" },
    { key: "origen", header: "Originación campaña tn", get: (l) => l.originacionTn?.campania ?? null, format: "number3" },
    { key: "origenTotal", header: "Originación total tn", get: (l) => l.originacionTn?.total ?? null, format: "number3" },
  ];
  if (verSorgoGirasol) columnas.push(
    { key: "sorgo", header: "Sorgo tn", get: (l) => l.originacionTn?.sorgo ?? null, format: "number3" },
    { key: "girasol", header: "Girasol tn", get: (l) => l.originacionTn?.girasol ?? null, format: "number3" },
  );
  columnas.push(
    { key: "potencial", header: "Potencial tn", get: (l) => l.potencialTn ?? null, format: "number" },
    { key: "compra", header: "Compra insumos", get: (l) => l.compraInsumos === "si" ? "Sí" : l.compraInsumos === "no" ? "No" : l.compraInsumos === "sin_originacion" ? "Sin originación" : null },
  );
  return columnas;
}
