import { env } from "@/lib/env";

/**
 * Aviso de que la pantalla está corriendo contra datos ficticios.
 *
 * Es lo único que sobrevive de la vieja `LogisticaNav`: la fila de enlaces a Pedidos / Cupos /
 * Cargas a puerto / Flete y camiones repetía, dentro del contenido, el grupo "Logística" que ya
 * está en el menú lateral. Dos navegaciones para lo mismo, una encima de la otra.
 */
export function AvisoDemo() {
  if (!env.useMocks) return null;
  return (
    <p className="no-print mb-4 inline-block rounded-md border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-clementina-deep">
      Datos de ejemplo (ficticios). Lo que se opere acá dura sólo lo que dure la sesión.
    </p>
  );
}
