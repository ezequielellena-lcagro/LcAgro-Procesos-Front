const ALICUOTA_IVA = 0.105;
const ALICUOTA_PERCEPCION = 0.015;

/** Redondeo a 2 decimales medio-arriba, como `MidpointRounding.AwayFromZero` del backend. */
function a2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * IVA sobre intereses bancarios: **10,5 % (IVA) + 1,5 % (percepción) = 12 %**.
 *
 * Cada componente se redondea por separado y recién después se suman — así lo hace la planilla de
 * Administración (`=133,15+932,05`) y así lo tiene cargado MacroGest. Aplicar el 12 % de una sola
 * vez difiere en un centavo en algunos importes.
 *
 * Espeja `LcAgro.Domain.IvaFinanciero.Sugerido`. Es una sugerencia: el importe queda editable
 * porque los préstamos con tasa subsidiada traen el IVA del cuadro de marcha del banco.
 */
export function ivaSugerido(interes: number): number {
  if (!Number.isFinite(interes)) return 0;
  return a2(a2(interes * ALICUOTA_IVA) + a2(interes * ALICUOTA_PERCEPCION));
}
