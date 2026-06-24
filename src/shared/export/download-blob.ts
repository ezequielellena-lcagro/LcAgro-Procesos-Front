// Helpers para descargar un archivo que viene del backend como Blob (vía axios `responseType: "blob"`),
// preservando el header del JWT (un <a href> plano no lo llevaría).

/** Dispara la descarga de un Blob en el browser creando un <a> temporal. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Extrae el nombre de archivo de un header `Content-Disposition` (RFC 5987 o `filename="..."`). */
export function filenameFromContentDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (utf8?.[1]) return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ""));
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? fallback;
}
