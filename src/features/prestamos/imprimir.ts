/**
 * Imprime la vista actual en hoja **apaisada**, y la deja como estaba al terminar.
 *
 * <p>El reporte tiene once columnas: en vertical sale cortado. La orientación se pide con una regla
 * `@page`, que no admite selectores — no hay forma de escribir "apaisado sólo esta vista" en la hoja
 * de estilos. Por eso se inyecta al imprimir y se saca después: si quedara puesta, el resto de la
 * app también saldría apaisado.</p>
 */
export function imprimirApaisado(): void {
  const hoja = document.createElement("style");
  hoja.textContent = "@page { size: landscape; margin: 10mm; }";
  document.head.appendChild(hoja);

  // `afterprint` y no un `remove()` después de print(): en algunos navegadores print() vuelve antes
  // de que el diálogo se cierre, y la regla se iría justo cuando hace falta.
  window.addEventListener("afterprint", () => hoja.remove(), { once: true });

  window.print();
}
