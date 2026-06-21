// PDF client-side vía el diálogo de impresión del navegador (Guardar como PDF). El chrome del
// layout (sidebars, topbar, filtros, botones) se oculta en impresión con la clase `no-print`
// (ver index.css). Un PDF tabular dedicado (jsPDF/pdfmake) queda como mejora futura.
export function exportToPdf() {
  window.print();
}
