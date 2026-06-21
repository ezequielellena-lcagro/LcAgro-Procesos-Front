import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PagedResult } from "@/shared/types/paged";
import type { AuditDto, AuditoriaFiltros } from "../types";

export const auditoriaKeys = {
  all: ["auditoria"] as const,
  list: (f: AuditoriaFiltros) => [...auditoriaKeys.all, "list", f] as const,
};

export function useAuditoria(f: AuditoriaFiltros) {
  return useQuery({
    queryKey: auditoriaKeys.list(f),
    queryFn: async () => {
      const { data } = await apiClient.get<PagedResult<AuditDto>>("/auditoria", {
        params: {
          desde: f.desde || undefined,
          hasta: f.hasta || undefined,
          usuarioId: f.usuarioId,
          page: f.page,
          pageSize: f.pageSize,
        },
      });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}
