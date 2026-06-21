import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/shared/components/error-state";
import { KpiCard } from "@/shared/components/kpi-card";
import { PageHeader } from "@/shared/components/page-header";
import { numero, tn, usd } from "@/shared/format/format";
import { useDashboard } from "../queries/use-dashboard";

export function DashboardPage() {
  const { data, isPending, isError, error, refetch } = useDashboard();

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen de Posición de Cereal y Cuentas Corrientes." />

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <KpiCard
              label="Resultado calzado"
              value={usd(data.posicion.resultadoUsd)}
              hint={data.posicion.campania ? `Campaña ${data.posicion.campania}` : "Sin campaña"}
              tone="verde"
            />
            <KpiCard
              label="Posición final"
              value={`${numero(data.posicion.posicionFinalTn)} tn`}
              hint={`${data.posicion.cereales} cereales`}
            />
            <KpiCard
              label="Cartera total"
              value={usd(data.cuentas.saldoTotalUsd)}
              hint={`${data.cuentas.totalCuentas} cuentas`}
            />
            <KpiCard
              label="Saldo vencido"
              value={usd(data.cuentas.saldoVencidoUsd)}
              hint={`${data.cuentas.cuentasConVencido} con vencido`}
              tone="rojo"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Panel title={`Posición · ${data.posicion.campania ?? "—"}`}>
              <DefRow k="Compras" v={tn(data.posicion.tnCompra)} />
              <DefRow k="Ventas" v={tn(data.posicion.tnVenta)} />
              <DefRow k="Calzadas" v={tn(data.posicion.tnCalzadas)} />
              <DefRow k="Resultado calzado" v={usd(data.posicion.resultadoUsd)} />
              <DefRow k="Posición final" v={`${numero(data.posicion.posicionFinalTn)} tn`} />
            </Panel>

            <Panel title="Cuentas Corrientes USD">
              <DefRow k="Cuentas" v={String(data.cuentas.totalCuentas)} />
              <DefRow k="Saldo total" v={usd(data.cuentas.saldoTotalUsd)} />
              <DefRow k="Vencido" v={usd(data.cuentas.saldoVencidoUsd)} />
              <DefRow k="A vencer" v={usd(data.cuentas.saldoAVencerUsd)} />
              <DefRow k="Cuentas con vencido" v={String(data.cuentas.cuentasConVencido)} />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-panel p-4 shadow-card">
      <h2 className="mb-3 font-display text-lg font-semibold text-ink">{title}</h2>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

function DefRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft pb-1.5 last:border-0">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="tabular font-medium text-ink">{v}</dd>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    </div>
  );
}
