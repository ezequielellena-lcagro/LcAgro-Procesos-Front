import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { EstadoFiltroField } from "./estado-filtro";
import { MultiSelect } from "./multi-select";
import type { FiltrosCompartidos } from "../filtros";
import type { EstadoStock, StockFiltrosResponse, TipoDeposito } from "../types";

/**
 * Filtros compartidos por las solapas (el estado de vencimiento lo reemplaza la solapa).
 * `estadoFijo` es el estado que impone la solapa activa, si impone alguno; `estadoIgnorado` es el
 * motivo por el que la solapa activa no lo usa (Por rubro). Los dos deshabilitan el control con su
 * explicación a la vista: la barra nunca ofrece un control que no hace nada.
 */
export function StockFiltrosBar({
  valor,
  onChange,
  opciones,
  cargando,
  estadoFijo,
  estadoIgnorado,
}: {
  valor: FiltrosCompartidos;
  onChange: (v: FiltrosCompartidos) => void;
  opciones?: StockFiltrosResponse;
  cargando: boolean;
  estadoFijo?: EstadoStock;
  estadoIgnorado?: string;
}) {
  const set = <K extends keyof FiltrosCompartidos>(campo: K, v: FiltrosCompartidos[K]) =>
    onChange({ ...valor, [campo]: v });

  const depositoOpts = opciones?.depositos.map((d) => ({ value: d.codigo, label: `${d.nombre} (${d.codigo})` })) ?? [];
  const rubroOpts = opciones?.rubros.map((r) => ({ value: r.rubro, label: r.rubroDesc })) ?? [];

  return (
    <FilterBar>
      <FilterField label="Buscar producto / código">
        <Input value={valor.q} onChange={(e) => set("q", e.target.value)} placeholder="Nombre o código" />
      </FilterField>
      <FilterField label="Depósito">
        <MultiSelect
          options={depositoOpts}
          value={valor.deposito}
          onChange={(v) => set("deposito", v)}
          placeholder="Todos los depósitos"
          disabled={cargando}
        />
      </FilterField>
      <FilterField label="Rubro">
        <MultiSelect
          options={rubroOpts}
          value={valor.rubro}
          onChange={(v) => set("rubro", v)}
          placeholder="Todos los rubros"
          disabled={cargando}
        />
      </FilterField>
      <FilterField label="Tipo">
        <Select value={valor.tipo} onChange={(e) => set("tipo", e.target.value as TipoDeposito | "")}>
          <option value="">Todos</option>
          <option value="Propio">Propio</option>
          <option value="Consignado">Consignado</option>
        </Select>
      </FilterField>
      <EstadoFiltroField
        valor={valor.estado}
        onChange={(v) => set("estado", v)}
        fijo={estadoFijo}
        ignorado={estadoIgnorado}
      />
      <FilterField label="Mínimo">
        <label className="flex h-9 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-clementina-deep"
            checked={valor.soloBajoMinimo}
            onChange={(e) => set("soloBajoMinimo", e.target.checked)}
          />
          Solo bajo mínimo
        </label>
      </FilterField>
      <FilterField label="Ventana de venta (días)">
        <Input
          type="number"
          inputMode="numeric"
          className="w-28"
          value={valor.ventanaDias}
          onChange={(e) => set("ventanaDias", e.target.value)}
          placeholder="90"
        />
      </FilterField>
    </FilterBar>
  );
}
