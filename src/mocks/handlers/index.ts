import { authHandlers } from "./auth";
import { auditoriaHandlers } from "./auditoria";
import { configHandlers } from "./config";
import { cuentasHandlers } from "./cuentas";
import { dashboardHandlers } from "./dashboard";
import { devolucionHandlers } from "./devolucion";
import { posicionHandlers } from "./posicion";
import { semillaHandlers } from "./semilla";
import { stockHandlers } from "./stock";
import { usuariosHandlers } from "./usuarios";

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...posicionHandlers,
  ...cuentasHandlers,
  ...devolucionHandlers,
  ...semillaHandlers,
  ...stockHandlers,
  ...usuariosHandlers,
  ...configHandlers,
  ...auditoriaHandlers,
];
