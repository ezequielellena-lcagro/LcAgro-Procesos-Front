import { authHandlers } from "./auth";
import { auditoriaHandlers } from "./auditoria";
import { configHandlers } from "./config";
import { cuentasHandlers } from "./cuentas";
import { dashboardHandlers } from "./dashboard";
import { posicionHandlers } from "./posicion";
import { usuariosHandlers } from "./usuarios";

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...posicionHandlers,
  ...cuentasHandlers,
  ...usuariosHandlers,
  ...configHandlers,
  ...auditoriaHandlers,
];
