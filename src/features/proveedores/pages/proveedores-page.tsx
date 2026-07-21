import { PageHeader } from "@/shared/components/page-header";

/**
 * Proyección de deuda a proveedores en USD: cuántos dólares hay que desembolsar en cada ventana
 * de vencimiento. Shell mínimo para dejar registrada la ruta y el ítem de menú; la Task 11 le
 * agrega filtros, KPIs, tabla y export.
 */
export function ProveedoresPage() {
  return (
    <PageHeader
      title="Proyección de Deuda a Proveedores USD"
      subtitle="Cuántos dólares hay que desembolsar en cada ventana de vencimiento (USD)."
    />
  );
}
