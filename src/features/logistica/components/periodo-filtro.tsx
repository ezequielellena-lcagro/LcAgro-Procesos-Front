import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Periodo } from "../types";
import { sumarDias } from "../format";
export function PeriodoFiltro({
  value,
  onChange,
  etiqueta = "Fecha solicitada",
  maxDias = 366,
}: {
  value: Periodo;
  onChange: (v: Periodo) => void;
  etiqueta?: string;
  maxDias?: number;
}) {
  const [desde, setDesde] = useState(value.desde);
  const [hasta, setHasta] = useState(sumarDias(value.hastaExclusivo, -1));
  const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1;
  return (
    <form
      className="mb-4 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (dias > 0 && dias <= maxDias) onChange({ desde, hastaExclusivo: sumarDias(hasta, 1) });
      }}
    >
      <label className="text-xs text-ink-soft">
        {etiqueta}: desde
        <Input type="date" required value={desde} onChange={(e) => setDesde(e.target.value)} />
      </label>
      <label className="text-xs text-ink-soft">
        Hasta inclusive
        <Input
          type="date"
          required
          value={hasta}
          min={desde}
          onChange={(e) => setHasta(e.target.value)}
        />
      </label>
      <Button variant="outline" type="submit" disabled={!(dias > 0 && dias <= maxDias)}>
        Consultar
      </Button>
      {!(dias > 0 && dias <= maxDias) && (
        <p role="alert" className="text-sm text-rojo">
          Elegí un período de hasta {maxDias} días.
        </p>
      )}
    </form>
  );
}
