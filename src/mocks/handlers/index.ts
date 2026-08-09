import { authHandlers } from "./auth";
import { auditoriaHandlers } from "./auditoria";
import { comisionesHandlers } from "./comisiones";
import { configHandlers } from "./config";
import { cuentasHandlers } from "./cuentas";
import { dashboardHandlers } from "./dashboard";
import { devolucionHandlers } from "./devolucion";
import { posicionHandlers } from "./posicion";
import { prestamosHandlers } from "./prestamos";
import { produccionPropiaHandlers } from "./produccionpropia";
import { proveedoresHandlers } from "./proveedores";
import { semillaHandlers } from "./semilla";
import { stockHandlers } from "./stock";
import { stockfisicoHandlers } from "./stockfisico";
import { usuariosHandlers } from "./usuarios";
import { volumenAcopiadoHandlers } from "./volumenacopiado";

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...posicionHandlers,
  ...produccionPropiaHandlers,
  ...volumenAcopiadoHandlers,
  ...cuentasHandlers,
  ...proveedoresHandlers,
  ...prestamosHandlers,
  ...devolucionHandlers,
  ...semillaHandlers,
  ...stockHandlers,
  ...stockfisicoHandlers,
  ...comisionesHandlers,
  ...usuariosHandlers,
  ...configHandlers,
  ...auditoriaHandlers,
];
