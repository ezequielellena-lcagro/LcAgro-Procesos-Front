import type { jsPDF as JsPdf } from "jspdf";
import logoFull from "@/assets/brand/logo-full.png";
import { fecha, hoy } from "../format";
import type { PlanCarga, ReferenciaPlanCarga } from "../types";

/** CUIT de 11 dígitos con guiones, como lo imprime MacroGest; vacío queda «- -». */
export function cuit(valor: string | null | undefined): string {
  const digitos = (valor ?? "").replace(/\D/g, "");
  return digitos.length === 11
    ? `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`
    : "-   -";
}

/** Imagen del logo como data URL: jsPDF necesita los bytes, no la ruta del asset. */
async function logoDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch(logoFull)).blob();
    return await new Promise((resolve) => {
      const lector = new FileReader();
      lector.onload = () => resolve(typeof lector.result === "string" ? lector.result : null);
      lector.onerror = () => resolve(null);
      lector.readAsDataURL(blob);
    });
  } catch {
    // Sin logo el documento sigue sirviendo: se manda igual.
    return null;
  }
}

export function nombreArchivoPlanCarga(plan: Pick<PlanCarga, "contrato" | "plan">): string {
  return `plan-de-carga-${plan.contrato.replace(/[^\w-]+/g, "-")}-plan-${plan.plan}.pdf`;
}

/**
 * Arma el Plan de Carga con el mismo orden y rótulos que el que imprime MacroGest (cuadro 35:07 de
 * la reunión del 2026-10-23), más el logo de La Clementina. Hasta ahora lo mandaban como recorte de
 * pantalla porque el ERP no les genera el PDF. El envío por WhatsApp sigue siendo a mano.
 */
export async function generarPlanCargaPdf(plan: PlanCarga): Promise<JsPdf> {
  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    logoDataUrl(),
  ]);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margen = 36;
  const ancho = doc.internal.pageSize.getWidth();
  const etiquetaX = 190;
  const codigoX = 198;
  const nombreX = 232;
  const cuitX = 412;
  doc.setTextColor(20, 20, 20);

  // Encabezado: logo, empresa, fecha de emisión y hoja.
  let y = 40;
  if (logo) {
    const props = doc.getImageProperties(logo);
    const alto = 34;
    doc.addImage(logo, "PNG", margen, y - 12, (props.width / props.height) * alto, alto);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Fecha: ${fecha(hoy())}`, ancho - margen, y, { align: "right" });
  doc.text("Hoja: 1 de 1", ancho - margen, y + 12, { align: "right" });
  y += 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("LA CLEMENTINA S.A.", margen, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Conocemos el esfuerzo de la siembra y lo valoramos", margen, y + 14);
  y += 38;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Plan de Carga", ancho / 2, y, { align: "center" });

  // Renglón del contrato, subrayado como en el impreso del ERP.
  y += 30;
  doc.setFontSize(10);
  doc.text("Contrato:", margen, y);
  doc.setFontSize(14);
  doc.text(plan.contrato, margen + 52, y);
  doc.setFontSize(10);
  const cabecera: [string, string, number][] = [
    ["N° Plan:", String(plan.plan), 200],
    ["Viajes:", plan.viajes == null ? "" : String(plan.viajes), 285],
    ["Tn:", plan.toneladas == null ? "" : String(plan.toneladas), 355],
    ["Fecha:", fecha(plan.fecha), 425],
  ];
  for (const [rotulo, valor, x] of cabecera) {
    doc.setFont("helvetica", "bold");
    doc.text(rotulo, x, y);
    const corrimiento = doc.getTextWidth(rotulo) + 6;
    doc.setFont("helvetica", "normal");
    doc.text(valor, x + corrimiento, y);
  }
  doc.setDrawColor(40, 40, 40);
  doc.line(margen, y + 6, ancho - margen, y + 6);

  // Cuerpo: rótulo a la derecha, código, nombre y, cuando corresponde, C.U.I.T.
  y += 26;
  const renglon = (
    rotulo: string,
    ref: ReferenciaPlanCarga | null,
    opciones: { cuit?: boolean; extra?: [string, string] } = {},
  ) => {
    doc.setFont("helvetica", "bold");
    doc.text(rotulo, etiquetaX, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    if (ref?.codigo != null) doc.text(String(ref.codigo), codigoX, y);
    if (ref?.nombre) doc.text(doc.splitTextToSize(ref.nombre, cuitX - nombreX - 8)[0], nombreX, y);
    if (opciones.cuit) {
      doc.setFont("helvetica", "bold");
      doc.text("C.U.I.T.:", cuitX, y);
      doc.setFont("helvetica", "normal");
      doc.text(cuit(ref?.cuit), cuitX + 46, y);
    }
    if (opciones.extra) {
      doc.setFont("helvetica", "bold");
      doc.text(opciones.extra[0], cuitX, y);
      // El ancho se mide con la negrita del rótulo, antes de volver a la letra normal.
      const corrimiento = doc.getTextWidth(opciones.extra[0]) + 6;
      doc.setFont("helvetica", "normal");
      doc.text(opciones.extra[1], cuitX + corrimiento, y);
    }
    y += 17;
  };
  renglon("Cereal:", plan.cereal);
  renglon("Campaña:", {
    codigo: null,
    nombre: plan.campania == null ? null : String(plan.campania),
  });
  renglon("Titular Carta Porte:", plan.titular, {
    extra: [
      "N° Establecimiento:",
      plan.numeroEstablecimiento == null ? "" : String(plan.numeroEstablecimiento),
    ],
  });
  renglon("Destino:", plan.destino, { cuit: true });
  if (plan.destinoDomicilio) {
    doc.text(`( ${plan.destinoDomicilio} )`, codigoX - 6, y - 2);
    y += 15;
  }
  renglon("Planta:", plan.planta);
  renglon("Destinatario:", plan.destinatario, { cuit: true });
  renglon("Corredor Venta Secundaria:", plan.corredorVentaSecundaria, { cuit: true });
  renglon("Mercado a Término:", { codigo: plan.mercadoTermino, nombre: null }, { cuit: true });
  renglon("Corredor Venta Primaria:", plan.corredorVentaPrimaria, { cuit: true });
  renglon("Representante/Entregador:", plan.entregador, { cuit: true });
  // Los completan a mano en el ERP (el plan no hereda esos datos del contrato): salen en blanco.
  renglon("Rte. Comercial Vta. Primaria:", null, { cuit: true });
  renglon("Rte. Comercial Vta. Secundaria:", null, { cuit: true });
  renglon("Rte. Comercial Vta. Secundaria 2:", null, { cuit: true });
  renglon("Obs.:", { codigo: null, nombre: plan.observaciones });

  autoTable(doc, {
    startY: y + 10,
    margin: { left: 150, right: 130 },
    head: [["Cupo", "Fecha Carga", "Código Otorgado", "Carta de Porte"]],
    body: plan.cupos.map((c) => [
      String(c.cupo),
      fecha(c.fechaCarga),
      c.codigoOtorgado ?? "",
      c.cartaPorte ?? "",
    ]),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 3 },
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [40, 40, 40],
      fontStyle: "normal",
      halign: "center",
    },
    columnStyles: { 0: { halign: "right" } },
  });

  doc.setProperties({ title: `Plan de Carga ${plan.contrato} plan ${plan.plan}` });
  return doc;
}

/** Genera el PDF y lo descarga. */
export async function descargarPlanCarga(plan: PlanCarga): Promise<void> {
  (await generarPlanCargaPdf(plan)).save(nombreArchivoPlanCarga(plan));
}
