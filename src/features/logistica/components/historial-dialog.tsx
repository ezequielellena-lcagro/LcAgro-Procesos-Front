import { camposHistorial } from "../lib/historial";
import { Modal } from "@/components/ui/modal";
import { useHistoria } from "../queries/use-logistica";
import { TablaLogistica } from "./tabla-logistica";
import { fechaHoraArgentina } from "../format";
function CamposEvento({ datos, recurso }: { datos: string; recurso: string }) {
  const campos = camposHistorial(datos, recurso);
  if (!campos.length)
    return <p className="mt-2 text-xs text-ink-soft">Sin campos adicionales registrados.</p>;
  return (
    <table className="mt-2 min-w-80 text-xs">
      <caption className="sr-only">Campos registrados</caption>
      <thead>
        <tr>
          <th scope="col">Campo</th>
          <th scope="col">Anterior</th>
          <th scope="col">Registrado</th>
        </tr>
      </thead>
      <tbody>
        {campos.map((c) => (
          <tr key={c.campo}>
            <th scope="row" className="p-1 font-medium">
              {c.campo}
            </th>
            <td className="p-1">{c.anterior}</td>
            <td className="p-1">{c.nuevo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function HistorialDialog({
  recurso,
  id,
  onClose,
}: {
  recurso: string;
  id: string;
  onClose: () => void;
}) {
  const q = useHistoria(recurso, id);
  return (
    <Modal open title="Historial de la operación" onClose={onClose} className="max-w-4xl">
      <TablaLogistica
        titulo="Historial"
        filas={q.data?.pages.flatMap((p) => p.filas) ?? []}
        clave={(f) => f.id}
        cargando={q.isLoading}
        error={q.error}
        reintentar={() => void q.refetch()}
        hayMas={q.hasNextPage}
        mas={() => void q.fetchNextPage()}
        columnas={[
          { titulo: "Revisión", numero: true, celda: (f) => f.revision },
          {
            titulo: "Fecha de registro (Argentina)",
            celda: (f) => fechaHoraArgentina(f.registradoAl),
          },
          { titulo: "Acción", celda: (f) => f.tipo.replaceAll("_", " ") },
          { titulo: "Operador", celda: (f) => `Usuario ${f.registradoPorId}` },
          {
            titulo: "Detalle",
            celda: (f) => (
              <>
                <span>{f.motivo}</span>
                <details>
                  <summary className="cursor-pointer">Ver datos registrados</summary>
                  <CamposEvento datos={f.datos} recurso={recurso} />
                </details>
              </>
            ),
          },
        ]}
      />
    </Modal>
  );
}
