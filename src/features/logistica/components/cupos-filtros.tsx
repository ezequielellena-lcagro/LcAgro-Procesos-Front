import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CatalogoSelect } from "./catalogo-select";

import type { FiltrosCupos } from "../lib/filtros-cupos";
export function CuposFiltros({
  value,
  onChange,
  onApply,
  onClear,
  erp = false,
}: {
  value: FiltrosCupos;
  onChange: (v: FiltrosCupos) => void;
  onApply: () => void;
  onClear: () => void;
  erp?: boolean;
}) {
  const campaniaValida =
    !value.campania ||
    (/^[0-9]{4}-[0-9]{4}$/.test(value.campania) &&
      Number(value.campania.slice(5)) === Number(value.campania.slice(0, 4)) + 1);
  return (
    <form
      className="mb-4 grid items-end gap-3 sm:grid-cols-3 xl:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (erp || campaniaValida) onApply();
      }}
    >
      <label className="text-xs text-ink-soft">
        Contrato
        <Input
          value={value.contrato}
          maxLength={15}
          onChange={(e) => onChange({ ...value, contrato: e.target.value })}
        />
      </label>
      <CatalogoSelect
        tipo="productos"
        titulo="Cereal"
        value={Number(value.producto)}
        required={false}
        modoFiltro
        onChange={(v) => onChange({ ...value, producto: v ? String(v) : "" })}
      />
      <CatalogoSelect
        tipo="destinos"
        titulo="Destino"
        value={Number(value.destinoCodigo)}
        required={false}
        modoFiltro
        onChange={(v) => onChange({ ...value, destinoCodigo: v ? String(v) : "" })}
      />
      {!erp && (
        <>
          <label className="text-xs text-ink-soft">
            Campaña
            <Input
              value={value.campania}
              maxLength={9}
              pattern="[0-9]{4}-[0-9]{4}"
              placeholder="2025-2026"
              onChange={(e) => onChange({ ...value, campania: e.target.value })}
            />
          </label>
          <label className="text-xs text-ink-soft">
            Circuito
            <select
              className="h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
              value={value.circuito}
              onChange={(e) => onChange({ ...value, circuito: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="directa">Directa</option>
              <option value="propia">Propia</option>
            </select>
          </label>
        </>
      )}
      <div className="flex flex-wrap gap-2 self-end">
        <Button type="submit" variant="outline" disabled={!erp && !campaniaValida}>
          Aplicar filtros
        </Button>
        <Button type="button" variant="ghost" onClick={onClear}>
          Limpiar filtros
        </Button>
      </div>
      {!erp && !campaniaValida && (
        <p role="alert" className="text-sm text-rojo">
          Ingresá una campaña como 2025-2026.
        </p>
      )}
    </form>
  );
}
