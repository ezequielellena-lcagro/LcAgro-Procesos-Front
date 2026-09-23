/**
 * Criterio de cálculo del consolidado.
 *
 * Va sólo en el PDF, que es el reporte que se imprime o se manda por fuera del sistema y necesita
 * explicarse solo. En la pantalla y en el Excel no se muestran: ahí el criterio ya se conoce y las
 * aclaraciones empujaban la tabla hacia abajo sin aportar.
 */
export const LEYENDA_CONSOLIDADO =
  "Facturación LC: comprobantes del 1-abr al 31-mar (misma regla que Comisiones) · Originación: certificados 1116 A (CEG) de la campaña asignada en MacroGest · Mercado y potencial: plan de siembra × Market Share";
export const LEYENDA_AJUSTE =
  "Ajuste de redondeo: diferencia entre importes por CUIT y renglones del motor de facturación. Se suma sólo al TOTAL.";
export const NOTA_D10 =
  "LC anterior 2025/26 incluye 12 renglones facturados en pesos en 2024/25; la conversión de moneda D10 sigue pendiente.";
