import { toAppError } from "@/lib/api-error";
export function confirmacionPendiente(error: unknown): boolean {
  const e = toAppError(error);
  return error != null && (e.status === 0 || e.status >= 500);
}
