import { FALLO_CLIENTE, toAppError } from "@/lib/api-error";

/**
 * ¿Quedó en duda si la escritura se aplicó?
 *
 * Sí cuando el servidor no contestó (timeout, red caída) o contestó 5xx: un 502/503/504 lo puede
 * emitir tanto la API como el servidor que la publica, así que el pedido pudo haber llegado y
 * haberse perdido la respuesta. Reintentar con la misma Idempotency-Key es la forma de averiguarlo.
 *
 * NO cuando falla nuestro propio código en el navegador: ahí no hay respuesta que confirmar ni
 * clave que reintentar —puede que la operación ni se haya enviado—, y el reintento a ciegas no
 * aporta nada. Hay que recargar y mirar el listado. Antes este caso caía acá por tener `status 0`,
 * y la pantalla quedaba trabada pidiendo reintentar una operación que nunca salió.
 */
export function confirmacionPendiente(error: unknown): boolean {
  if (error == null) return false;
  const e = toAppError(error);
  if (e.codigo === FALLO_CLIENTE) return false;
  return e.status === 0 || e.status >= 500;
}
