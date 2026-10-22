/**
 * UUID v4 que funciona también fuera de un contexto seguro.
 *
 * `crypto.randomUUID()` SÓLO existe en contextos seguros (https o localhost). La API .NET sirve
 * este front por HTTP y se entra por IP (`http://192.168.0.25:8080`), así que en toda máquina que
 * no sea el propio servidor `crypto.randomUUID` es `undefined`. Con eso, el `useState` de la solapa
 * Otorgar reventaba en render (pantalla "Algo salió mal") y cualquier escritura fallaba con un
 * TypeError que la UI mostraba como "Ocurrió un error inesperado" sugiriendo reintentar.
 *
 * `crypto.getRandomValues` sí está disponible en contextos no seguros; el `Math.random` final es
 * sólo una red de seguridad para entornos sin WebCrypto. Estas claves son de idempotencia y
 * correlación de páginas, no secretos criptográficos.
 */
export function uuid(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
