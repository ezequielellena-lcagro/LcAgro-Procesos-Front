import { Modal } from "@/components/ui/modal";
import type { AuditDto } from "../types";

function pretty(datos: string | null): string {
  if (!datos) return "(sin datos)";
  try {
    return JSON.stringify(JSON.parse(datos), null, 2);
  } catch {
    return datos;
  }
}

export function DatosDialog({ registro, onClose }: { registro: AuditDto | null; onClose: () => void }) {
  const title = registro
    ? `${registro.accion} · ${registro.entidad}${registro.entidadId ? ` #${registro.entidadId}` : ""}`
    : "";
  return (
    <Modal open={registro !== null} onClose={onClose} title={title} className="max-w-xl">
      <pre className="max-h-[60vh] overflow-auto rounded-md bg-panel-soft p-3 text-xs text-ink">
        {pretty(registro?.datos ?? null)}
      </pre>
    </Modal>
  );
}
