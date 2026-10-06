import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterField } from "@/shared/components/filter-bar";
import { CatalogoSelect } from "./catalogo-select";

import { campaniaValida, type FiltrosCupos } from "../lib/filtros-cupos";

/**
 * Filtros de un listado de cupos.
 *
 * NO es un `<form>` propio: va DENTRO de la barra del `PeriodoFiltro`, que es la que arma el form
 * y recibe el `onSubmit`. Como bloque aparte quedaba una grilla de columnas tan anchas como la
 * pantalla, con los campos desparramados y sin nada que los agrupara como filtros.
 */
export function CuposFiltros({
  value,
  onChange,
  onClear,
  erp = false,
}: {
  value: FiltrosCupos;
  onChange: (v: FiltrosCupos) => void;
  onClear: () => void;
  erp?: boolean;
}) {
  const campaniaOk = campaniaValida(value);
  return (
    <>
      <FilterField label="Contrato">
        <Input
          className="w-40"
          value={value.contrato}
          maxLength={15}
          onChange={(e) => onChange({ ...value, contrato: e.target.value })}
        />
      </FilterField>
      <CatalogoSelect
        className="w-56"
        tipo="productos"
        titulo="Cereal"
        value={Number(value.producto)}
        required={false}
        modoFiltro
        onChange={(v) => onChange({ ...value, producto: v ? String(v) : "" })}
      />
      <CatalogoSelect
        className="w-56"
        tipo="destinos"
        titulo="Destino"
        value={Number(value.destinoCodigo)}
        required={false}
        modoFiltro
        onChange={(v) => onChange({ ...value, destinoCodigo: v ? String(v) : "" })}
      />
      {!erp && (
        <>
          <FilterField label="Campaña">
            <Input
              className="w-32"
              value={value.campania}
              maxLength={9}
              pattern="[0-9]{4}-[0-9]{4}"
              placeholder="2025-2026"
              onChange={(e) => onChange({ ...value, campania: e.target.value })}
            />
          </FilterField>
          <FilterField label="Circuito">
            <Select
              className="w-40"
              value={value.circuito}
              onChange={(e) => onChange({ ...value, circuito: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="directa">Directa</option>
              <option value="propia">Propia</option>
            </Select>
          </FilterField>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={!erp && !campaniaOk}>
          Aplicar filtros
        </Button>
        <Button type="button" variant="ghost" onClick={onClear}>
          Limpiar filtros
        </Button>
      </div>
      {!erp && !campaniaOk && (
        <p role="alert" className="basis-full text-sm text-rojo">
          Ingresá una campaña como 2025-2026.
        </p>
      )}
    </>
  );
}
