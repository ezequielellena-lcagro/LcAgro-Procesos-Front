import { KpiCard } from "@/shared/components/kpi-card";
import { numero, tn, usd } from "@/shared/format/format";
import type { ControlPadron as ControlPadronDatos, VendedorComercial } from "../types";

export function ControlPadron({
  datos, vendedores,
}: {
  datos: ControlPadronDatos;
  vendedores: VendedorComercial[];
}) {
  const nombres = new Map(vendedores.map((item) => [item.id, item.nombre]));
  return (
    <section className="space-y-4 rounded-card border border-line bg-panel p-5 shadow-card">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Control del padrón</h2>
        <p className="text-sm text-ink-soft">
          Conteos de cuentas fuera de cartera y registros que requieren revisión.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="CUIT ambiguos" value={numero(datos.cuitsAmbiguos)} />
        <KpiCard label="Cuentas sin cliente con movimiento"
          value={numero(datos.cuentasSinClienteConMovimiento)} />
        <KpiCard label="Facturación sin CUIT"
          value={usd(datos.facturacionSinCuitUsd.total)}
          hint={numero(datos.facturacionSinCuitUsd.cuentas) + " cuentas · USD"} />
        <KpiCard label="Originación sin CUIT"
          value={tn(datos.originacionSinCuitTn.total)}
          hint={numero(datos.originacionSinCuitTn.cuentas) + " cuentas · tn"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-line bg-panel-soft/60 p-4">
          <h3 className="text-sm font-semibold text-ink">Códigos con movimiento sin vendedor</h3>
          {datos.codigosSinVendedorConMovimiento.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Sin cuentas pendientes.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {datos.codigosSinVendedorConMovimiento.map((fila) => (
                <li key={fila.codigo} className="flex justify-between gap-3">
                  <span className="tabular text-ink">Código {fila.codigo}</span>
                  <span className="tabular text-ink-soft">{numero(fila.cuentas)} cuentas</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-md border border-line bg-panel-soft/60 p-4">
          <h3 className="text-sm font-semibold text-ink">Cuentas sin CUIT válido por vendedor</h3>
          {datos.cuentasSinCuitValidoPorVendedor.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Sin cuentas pendientes.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {datos.cuentasSinCuitValidoPorVendedor.map((fila) => (
                <li key={fila.vendedorId} className="flex justify-between gap-3">
                  <span className="text-ink">{nombres.get(fila.vendedorId) ?? "Vendedor " + fila.vendedorId}</span>
                  <span className="tabular text-ink-soft">{numero(fila.cuentas)} cuentas</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
