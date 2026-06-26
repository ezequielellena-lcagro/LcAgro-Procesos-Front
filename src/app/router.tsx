/* eslint-disable react-refresh/only-export-components -- archivo de configuración de rutas: define páginas lazy y exporta el router (no aplica fast-refresh). */
import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { NotFoundPage } from "@/shared/components/not-found-page";
import { PageLoader } from "@/shared/components/page-loader";
import { AppLayout } from "./app-layout";
import { ProtectedRoute } from "./protected-route";

// Code-splitting: cada página se carga en su propio chunk, bajo demanda.
const LoginPage = lazy(() => import("@/features/auth/pages/login-page").then((m) => ({ default: m.LoginPage })));
const DevolucionPage = lazy(() => import("@/features/devolucion-publica/pages/devolucion-page").then((m) => ({ default: m.DevolucionPage })));
const DashboardPage = lazy(() => import("@/features/dashboard/pages/dashboard-page").then((m) => ({ default: m.DashboardPage })));
const PosicionPage = lazy(() => import("@/features/posicion/pages/posicion-page").then((m) => ({ default: m.PosicionPage })));
const CuentasPage = lazy(() => import("@/features/cuentas/pages/cuentas-page").then((m) => ({ default: m.CuentasPage })));
const SemillaPage = lazy(() => import("@/features/semilla/pages/semilla-page").then((m) => ({ default: m.SemillaPage })));
const StockPage = lazy(() => import("@/features/stock/pages/stock-insumos-page").then((m) => ({ default: m.StockInsumosPage })));
const UsuariosPage = lazy(() => import("@/features/usuarios/pages/usuarios-page").then((m) => ({ default: m.UsuariosPage })));
const ConfigPage = lazy(() => import("@/features/config/pages/config-page").then((m) => ({ default: m.ConfigPage })));
const AuditoriaPage = lazy(() => import("@/features/auditoria/pages/auditoria-page").then((m) => ({ default: m.AuditoriaPage })));

export const router = createBrowserRouter([
  // Pública
  {
    path: "/login",
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: "/devolucion/:token",
    element: (
      <Suspense fallback={<PageLoader />}>
        <DevolucionPage />
      </Suspense>
    ),
  },

  // Privada: todo cuelga del shell, detrás del guard de sesión. El <Outlet/> del AppLayout
  // está envuelto en Suspense, así que cubre todas las páginas lazy de abajo.
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          {
            element: <ProtectedRoute roles={["Admin", "Operador", "SoloLectura"]} />,
            children: [{ path: "posicion", element: <PosicionPage /> }],
          },
          {
            element: <ProtectedRoute roles={["Admin", "Cobranzas", "SoloLectura"]} />,
            children: [{ path: "cuentas", element: <CuentasPage /> }],
          },
          {
            element: <ProtectedRoute roles={["Admin", "Operador", "SoloLectura"]} />,
            children: [{ path: "semilla-fiscalizada", element: <SemillaPage /> }],
          },
          {
            element: <ProtectedRoute roles={["Admin", "Operador", "SoloLectura"]} />,
            children: [{ path: "stock", element: <StockPage /> }],
          },
          {
            element: <ProtectedRoute roles={["Admin"]} />,
            children: [
              { path: "usuarios", element: <UsuariosPage /> },
              { path: "config", element: <ConfigPage /> },
              { path: "auditoria", element: <AuditoriaPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: "*", element: <NotFoundPage /> },
]);
