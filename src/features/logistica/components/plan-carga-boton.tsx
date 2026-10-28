import { FileDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BotonIcono } from "./boton-icono";
import { apiClient } from "@/lib/api-client";
import { toAppError } from "@/lib/api-error";
import { descargarPlanCarga } from "../lib/plan-carga-pdf";
import type { PlanCarga } from "../types";

/**
 * Descarga el Plan de Carga del plan de un otorgamiento. Los datos se leen de MacroGest en el
 * momento (destino, corredores, entregador, códigos de cupo) y el PDF se arma acá, con el logo.
 */
export function PlanCargaBoton({
  otorgamientoId,
  texto = "Plan de Carga",
  variant = "outline",
  soloIcono = false,
}: {
  otorgamientoId: string;
  texto?: string;
  variant?: "outline" | "ghost" | "default";
  /** En las filas de una tabla: ícono con tooltip. */
  soloIcono?: boolean;
}) {
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-0.5">
      {(() => {
        const descargar = async () => {
          setPendiente(true);
          setError(null);
          try {
            const { data } = await apiClient.get<PlanCarga>(
              `/logistica/otorgamientos/${otorgamientoId}/plan-carga`,
            );
            await descargarPlanCarga(data);
          } catch (e) {
            setError(toAppError(e).message);
          } finally {
            setPendiente(false);
          }
        };
        return soloIcono ? (
          <BotonIcono
            icono={FileDown}
            etiqueta={pendiente ? "Generando Plan de Carga…" : "Descargar Plan de Carga"}
            disabled={pendiente}
            onClick={() => void descargar()}
          />
        ) : (
          <Button size="sm" variant={variant} disabled={pendiente} onClick={() => void descargar()}>
            <FileDown className="size-4" aria-hidden /> {pendiente ? "Generando…" : texto}
          </Button>
        );
      })()}
      {error && (
        <span role="alert" className="text-xs text-rojo">
          {error}
        </span>
      )}
    </span>
  );
}
