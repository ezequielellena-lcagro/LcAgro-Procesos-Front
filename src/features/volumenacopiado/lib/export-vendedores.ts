import type { ExportKpi, ExportSpec } from "@/shared/export/export-types";
import { numero, pct } from "@/shared/format/format";
import type { AnalisisVendedorDto, ClienteCartera, VendedorResumen, VolumenAcopiadoDto } from "../types";

/** Fecha del pie de los reportes, en formato argentino. */
function fechaAr(hoy: Date): string {
  return hoy.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Objetivos de toda la empresa, uno por vendedor: es la pestaña Resumen tal como se ve, para llevar a
 * la reunión con el gerente comercial. Los excluidos (vinculadas / canales de baja) van con "—" en el
 * análisis comercial, igual que en pantalla: suman al volumen pero no llevan objetivo.
 */
export function specObjetivosPorVendedor(
  data: VolumenAcopiadoDto,
  hoy: Date = new Date(),
): ExportSpec<VendedorResumen> {
  const t = data.totales;

  const kpis: ExportKpi[] = [
    {
      titulo: "Total acopiado",
      metricas: [
        { label: "toneladas", valor: numero(t.tn), destacado: true },
        { label: "productores", valor: String(t.productores) },
      ],
    },
    {
      titulo: "Vendedor líder",
      metricas: [
        { label: t.vendedorLider, valor: `${numero(t.tnLider)} tn`, destacado: true },
        { label: "del total", valor: pct(t.shareLider) },
      ],
    },
    {
      titulo: "Cartera dormida",
      acento: "rojo",
      metricas: [
        { label: "toneladas a recuperar", valor: numero(t.tnDormidas), destacado: true },
        { label: "mejor año de los que hoy no entregan", valor: "" },
      ],
    },
  ];

  return {
    filename: `Objetivos_por_vendedor_${data.campania}`,
    title: "Objetivos por vendedor",
    subtitle: `Certificados de depósito 1116 A · campaña ${data.campania} · generado el ${fechaAr(hoy)}`,
    kpis,
    kpisTitulo: "Resumen de la campaña",
    kpisEtiqueta: "Indicador",
    notas: [
      "Los objetivos son una propuesta del sistema a validar con el gerente comercial, no metas impuestas: " +
        "se calculan sobre el volumen de la campaña con un piso de crecimiento y un plus según la cartera dormida.",
      "Las sociedades vinculadas y los canales dados de baja suman al volumen de la empresa pero quedan fuera " +
        "del análisis comercial y no llevan objetivo.",
    ],
    columns: [
      { header: "Vendedor", get: (r) => r.vendedor },
      { header: "Acopiado (tn)", get: (r) => r.tn, format: "number", total: true },
      { header: "Clientes activos", get: (r) => (r.excluido ? null : r.activos), format: "number" },
      { header: "Cartera", get: (r) => (r.excluido ? null : r.universo), format: "number" },
      { header: "Penetración", get: (r) => (r.excluido ? null : r.penetracion * 100), format: "percent" },
      { header: "Dormidos", get: (r) => (r.excluido ? null : r.dormidos), format: "number" },
      { header: "tn por cliente", get: (r) => (r.excluido ? null : r.tnPorActivo), format: "number" },
      {
        header: "Objetivo (tn)",
        get: (r) => (r.excluido ? null : (r.objetivoAcordado ?? r.objetivoSugerido)),
        format: "number",
        total: true,
      },
      {
        header: "Estado del objetivo",
        get: (r) => (r.excluido ? null : r.objetivoAcordado == null ? "Sugerido" : "Acordado"),
      },
      { header: "Cumplimiento", get: (r) => r.cumplimiento, format: "percent" },
    ],
    rows: data.vendedores,
  };
}

/**
 * Ficha de un vendedor: sus indicadores, el objetivo con su fundamento y la cartera completa con el
 * estado de cada cliente. Es el papel que se lleva a la charla con el vendedor.
 */
export function specFichaVendedor(
  analisis: AnalisisVendedorDto,
  campania: string,
  hoy: Date = new Date(),
): ExportSpec<ClienteCartera> {
  const r = analisis.resumen;
  const objetivoTn = r.objetivoAcordado ?? r.objetivoSugerido;

  const dormidos = analisis.clientes.filter((c) => c.estado === "Dormido");
  const declinantes = analisis.clientes.filter((c) => c.estado === "Declinante");
  const tnRecuperables = dormidos.reduce((acc, c) => acc + c.tnPico, 0);
  const tnEnRiesgo = declinantes.reduce((acc, c) => acc + (c.tnPico - c.tn), 0);

  const kpis: ExportKpi[] = [
    {
      titulo: "Acopiado",
      metricas: [
        { label: "toneladas", valor: numero(r.tn), destacado: true },
        { label: "clientes activos", valor: String(r.activos) },
      ],
    },
    {
      titulo: "Penetración",
      metricas: [
        { label: "de su cartera", valor: pct(r.penetracion * 100), destacado: true },
        { label: "activos / cartera", valor: `${r.activos} / ${r.universo}` },
      ],
    },
    {
      titulo: "Objetivo",
      acento: r.cumplimiento != null && r.cumplimiento >= 100 ? "verde" : undefined,
      metricas: [
        { label: r.objetivoAcordado == null ? "sugerido (sin acordar)" : "acordado", valor: `${numero(objetivoTn)} tn`, destacado: true },
        { label: "cumplimiento", valor: r.cumplimiento == null ? "—" : pct(r.cumplimiento) },
      ],
    },
    {
      titulo: "Para reactivar",
      acento: "rojo",
      metricas: [
        { label: "toneladas recuperables", valor: numero(tnRecuperables), destacado: true },
        { label: "clientes dormidos", valor: String(dormidos.length) },
      ],
    },
    {
      titulo: "Para defender",
      metricas: [
        { label: "toneladas en riesgo", valor: numero(tnEnRiesgo), destacado: true },
        { label: "clientes declinantes", valor: String(declinantes.length) },
      ],
    },
  ];

  const notas = [`Objetivo: ${analisis.explicacionObjetivo}`, `Palanca: ${analisis.palanca}`];
  if (analisis.notaObjetivo) notas.push(`Nota: ${analisis.notaObjetivo}`);

  return {
    filename: `Objetivo_${analisis.vendedor.replace(/[^\w]+/g, "_")}_${campania}`,
    title: `Objetivo y cartera — ${analisis.vendedor}`,
    subtitle: `Certificados de depósito 1116 A · campaña ${campania} · generado el ${fechaAr(hoy)}`,
    kpis,
    kpisTitulo: "Resumen del vendedor",
    kpisEtiqueta: "Indicador",
    notas,
    columns: [
      { header: "Cliente", get: (c) => c.cliente },
      { header: `${campania} (tn)`, get: (c) => c.tn, format: "number", total: true },
      { header: "Mejor año (tn)", get: (c) => c.tnPico, format: "number", total: true },
      { header: "En", get: (c) => c.campaniaPico },
      { header: "Estado", get: (c) => c.estado },
      {
        // Lo que está en juego en cada fila: recuperable si está dormido, brecha contra el pico si cae.
        header: "En juego (tn)",
        get: (c) => (c.estado === "Creciente" ? null : c.estado === "Dormido" ? c.tnPico : c.tnPico - c.tn),
        format: "number",
        total: true,
      },
    ],
    rows: [...analisis.clientes].sort((a, b) => b.tn - a.tn),
  };
}
