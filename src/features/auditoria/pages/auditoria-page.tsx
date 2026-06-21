import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { Pagination } from "@/shared/components/pagination";
import { AuditoriaTable } from "../components/auditoria-table";
import { DatosDialog } from "../components/datos-dialog";
import { useAuditoria } from "../queries/use-auditoria";
import type { AuditDto } from "../types";

const PAGE_SIZE = 20;

export function AuditoriaPage() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [page, setPage] = useState(1);
  const [ver, setVer] = useState<AuditDto | null>(null);

  const auditoria = useAuditoria({
    desde: desde || undefined,
    hasta: hasta || undefined,
    usuarioId: usuarioId ? Number(usuarioId) : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <>
      <PageHeader
        title="Auditoría"
        subtitle="Registro de acciones sobre ajustes, observaciones, usuarios y configuración."
      />

      <FilterBar>
        <FilterField label="Desde">
          <Input
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPage(1);
            }}
          />
        </FilterField>
        <FilterField label="Hasta">
          <Input
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPage(1);
            }}
          />
        </FilterField>
        <FilterField label="Usuario (ID)">
          <Input
            type="number"
            className="w-28"
            placeholder="Todos"
            value={usuarioId}
            onChange={(e) => {
              setUsuarioId(e.target.value);
              setPage(1);
            }}
          />
        </FilterField>
      </FilterBar>

      {auditoria.isError ? (
        <ErrorState error={auditoria.error} onRetry={() => void auditoria.refetch()} />
      ) : auditoria.isPending ? (
        <div className="space-y-2 rounded-card border border-line bg-panel p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <>
          <AuditoriaTable filas={auditoria.data.items} onVer={setVer} />
          <Pagination
            page={auditoria.data.page}
            totalPages={auditoria.data.totalPages}
            total={auditoria.data.total}
            onPage={setPage}
          />
        </>
      )}

      <DatosDialog registro={ver} onClose={() => setVer(null)} />
    </>
  );
}
