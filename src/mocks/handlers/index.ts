import { authHandlers } from "./auth";
import { auditoriaHandlers } from "./auditoria";
import { comisionesHandlers } from "./comisiones";
import { configHandlers } from "./config";
import { cuentasHandlers } from "./cuentas";
import { dashboardHandlers } from "./dashboard";
import { devolucionHandlers } from "./devolucion";
import { posicionHandlers } from "./posicion";
import { proveedoresHandlers } from "./proveedores";
import { semillaHandlers } from "./semilla";
import { stockHandlers } from "./stock";
import { usuariosHandlers } from "./usuarios";

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...posicionHandlers,
  ...cuentasHandlers,
  ...proveedoresHandlers,
  ...devolucionHandlers,
  ...semillaHandlers,
  ...stockHandlers,
  ...comisionesHandlers,
  ...usuariosHandlers,
  ...configHandlers,
  ...auditoriaHandlers,
];
