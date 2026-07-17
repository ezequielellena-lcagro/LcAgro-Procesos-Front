import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { AjusteDto, AjusteInput, SignoAjuste } from "../types";
import { ajustesKeys, posicionKeys } from "./keys";

/** Todos los `arrastre_inicial` vigentes (de todas las campañas), para armar la grilla de arrastre. */
export function useArrastresIniciales(enabled = true) {
  return useQuery({
    queryKey: ajustesKeys.arrastres(),
    queryFn: async () => {
      const { data } = await apiClient.get<AjusteDto[]>("/ajustes");
      return data.filter((a) => a.tipo === "arrastre_inicial");
    },
    enabled,
  });
}

/** Valor de una celda de la grilla (una campaña × un cereal). `tn`/`precio` viajan como string del input. */
export interface CeldaArrastre {
  cereal: string;
  tn: string;
  signo: SignoAjuste;
  precio: string;
}

export type ArrastreOp =
  | { kind: "create"; cereal: string; tn: number; signo: SignoAjuste; precio: number | null }
  | { kind: "update"; id: number; cereal: string; tn: number; signo: SignoAjuste; precio: number | null }
  | { kind: "delete"; id: number };

/**
 * Diff entre lo cargado en el form y lo que ya existe: crea celdas nuevas con valor, actualiza las que
 * cambiaron (tn, signo o precio) y elimina las que se vaciaron (o quedaron en 0 = "no arrastra").
 * Devuelve solo las operaciones necesarias (pura → testeable).
 */
export function calcularOps(existentes: AjusteDto[], celdas: CeldaArrastre[]): ArrastreOp[] {
  const ops: ArrastreOp[] = [];
  for (const celda of celdas) {
    const ex = existentes.find((e) => e.cereal === celda.cereal);
    const v = celda.tn.trim();
    const tn = Number(v);
    const tiene = v !== "" && Number.isFinite(tn) && tn > 0;
    const p = celda.precio.trim();
    const precio = p === "" || !Number.isFinite(Number(p)) ? null : Number(p);

    if (tiene && !ex) ops.push({ kind: "create", cereal: celda.cereal, tn, signo: celda.signo, precio });
    else if (tiene && ex && (ex.tn !== tn || ex.signo !== celda.signo || ex.precioUsd !== precio))
      ops.push({ kind: "update", id: ex.id, cereal: celda.cereal, tn, signo: celda.signo, precio });
    else if (!tiene && ex) ops.push({ kind: "delete", id: ex.id });
  }
  return ops;
}

function aInput(campania: string, cereal: string, tn: number, signo: SignoAjuste, precio: number | null): AjusteInput {
  return { campania, cereal, tipo: "arrastre_inicial", tn, precioUsd: precio, signo, nota: null };
}

/** Aplica las operaciones de una campaña (crear/editar/eliminar arrastre_inicial) e invalida la posición. */
export function useGuardarArrastre() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true },
    mutationFn: async ({ campania, ops }: { campania: string; ops: ArrastreOp[] }) => {
      for (const op of ops) {
        if (op.kind === "create")
          await apiClient.post("/ajustes", aInput(campania, op.cereal, op.tn, op.signo, op.precio));
        else if (op.kind === "update")
          await apiClient.put(`/ajustes/${op.id}`, aInput(campania, op.cereal, op.tn, op.signo, op.precio));
        else await apiClient.delete(`/ajustes/${op.id}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ajustesKeys.all });
      qc.invalidateQueries({ queryKey: posicionKeys.all });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Arrastre guardado.");
    },
  });
}
