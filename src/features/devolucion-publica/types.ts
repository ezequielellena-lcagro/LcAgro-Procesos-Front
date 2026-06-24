export interface DevolucionPortalItem {
  cuenta: number;
  denominacion: string;
  saldoVencido: number;
  saldoAVencer: number;
  saldo: number;
  devolucion: string | null;
}
export interface DevolucionPortal {
  vendedor: string;
  expiraUtc: string;
  items: DevolucionPortalItem[];
}
