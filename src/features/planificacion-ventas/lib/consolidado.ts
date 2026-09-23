import type { ExportColumn } from "@/shared/export/export-types";
import type {
  ConsolidadoResponse,
  FilaConsolidado,
  HectareasConsolidado,
  OriginacionConsolidado,
  TotalesConsolidado,
} from "../types";

type Agrupacion = "sucursal" | "vendedor";
type TipoLinea = "grupo" | "productor" | "subtotal" | "carteras" | "fuera" | "ajuste" | "total";

export interface LineaConsolidado {
  tipo: TipoLinea;
  etiqueta: string;
  /** Clave del grupo al que pertenece la línea; la cabecera del grupo lleva la suya. */
  grupo?: string;
  /**
   * Sólo en la cabecera de grupo: los totales del vendedor, para mostrarlos en su renglón cuando
   * está plegado. Van aparte de los campos propios para que la exportación siga viendo la cabecera
   * vacía y no duplique el subtotal que ya baja al pie del grupo.
   */
  totales?: LineaConsolidado;
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

/** Coincide por razón social o por CUIT. El CUIT de una persona física contiene su DNI. */
export function coincideConsolidado(fila: FilaConsolidado, texto: string): boolean {
  return fila.razonSocial.toLocaleLowerCase("es-AR").includes(texto) || fila.cuit.includes(texto);
}

/**
 * Subtotales calculados en el cliente. Se usan sólo con la búsqueda por texto activa: los que manda
 * el servidor son de la cartera entera y dejarían de cerrar con las filas a la vista.
 *
 * Espeja a `ConstructorConsolidado.Totales` del backend, incluida la participación, que se calcula
 * sobre las filas con mercado > 0 (numerador y denominador), y el mercado/potencial, que quedan en
 * null si ninguna fila los tiene.
 */
export function totalesDeFilas(filas: FilaConsolidado[]): TotalesConsolidado {
  const suma = (obtener: (fila: FilaConsolidado) => number | null | undefined) =>
    filas.reduce((total, fila) => total + (obtener(fila) ?? 0), 0);
  const conMercado = filas.filter((fila) => (fila.mercadoUsd ?? 0) > 0);
  const facturacion = suma((fila) => fila.facturacionLcUsd);
  const anterior = suma((fila) => fila.facturacionLcAnteriorUsd);
  const mercadoConMercado = conMercado.reduce((total, fila) => total + (fila.mercadoUsd ?? 0), 0);
  return {
    hectareas: {
      soja: suma((fila) => fila.hectareas?.soja),
      maiz: suma((fila) => fila.hectareas?.maiz),
      trigo: suma((fila) => fila.hectareas?.trigo),
      otro: suma((fila) => fila.hectareas?.otro),
      total: suma((fila) => fila.hectareas?.total),
    },
    mercadoUsd: filas.some((fila) => fila.mercadoUsd !== null) ? suma((fila) => fila.mercadoUsd) : null,
    facturacionLcUsd: facturacion,
    facturacionLcAnteriorUsd: anterior,
    variacionLc: anterior === 0 ? null : facturacion / anterior - 1,
    participacionLc: mercadoConMercado > 0
      ? conMercado.reduce((total, fila) => total + fila.facturacionLcUsd, 0) / mercadoConMercado
      : null,
    originacionTn: {
      anterior: suma((fila) => fila.originacionTn.anterior),
      campania: suma((fila) => fila.originacionTn.campania),
      total: suma((fila) => fila.originacionTn.total),
      sorgo: suma((fila) => fila.originacionTn.sorgo),
      girasol: suma((fila) => fila.originacionTn.girasol),
    },
    potencialTn: filas.some((fila) => fila.potencialTn !== null) ? suma((fila) => fila.potencialTn) : null,
  };
}

/** El servidor calcula importes, subtotales y total general. Acá sólo se ordenan las líneas visibles. */
export function armarLineasConsolidado(
  datos: ConsolidadoResponse,
  agrupacion: Agrupacion,
  gestion: boolean,
  filtros: {
    vendedorIds?: number[];
    sucursalId?: number;
    vendedorPropioId?: number;
    /** Búsqueda por nombre o CUIT: recalcula subtotales y reemplaza el pie por un TOTAL filtrado. */
    texto?: string;
  },
): LineaConsolidado[] {
  const deCartera = gestion ? datos.filas : datos.filas.filter((fila) => fila.vendedorId === filtros.vendedorPropioId);
  const texto = filtros.texto?.trim().toLocaleLowerCase("es-AR") ?? "";
  const filas = texto ? deCartera.filter((fila) => coincideConsolidado(fila, texto)) : deCartera;
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
    const grupo = `${agrupacion}-${id ?? "sin"}`;
    const subtotal = id === null
      ? undefined
      : texto
        ? totalesDeFilas(productores)
        : subtotales.find((item) => item.id === id)?.totales;
    const pie: LineaConsolidado | undefined = subtotal
      ? { ...subtotal, tipo: "subtotal", grupo, etiqueta: `Subtotal ${nombre}` }
      : undefined;
    lineas.push({
      tipo: "grupo", grupo, totales: pie,
      etiqueta: `${agrupacion === "sucursal" ? "Sucursal" : "Vendedor"}: ${nombre}`,
    });
    for (const productor of [...productores].sort((a, b) =>
      colador.compare(a.razonSocial, b.razonSocial) || a.cuit.localeCompare(b.cuit))) {
      lineas.push({ ...productor, tipo: "productor", grupo, etiqueta: productor.razonSocial });
    }
    if (pie) lineas.push(pie);
  }
  // Con búsqueda activa no bajan "Total carteras", "Fuera de carteras" ni el ajuste de redondeo:
  // son agregados de la cartera completa que no se pueden recortar por texto. En su lugar va un
  // único TOTAL de lo que quedó a la vista.
  if (texto) {
    if (filas.length) lineas.push({ ...totalesDeFilas(filas), tipo: "total", etiqueta: "TOTAL FILTRADO" });
    return lineas;
  }
  const todos = gestion && !filtros.vendedorIds?.length && filtros.sucursalId === undefined;
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
