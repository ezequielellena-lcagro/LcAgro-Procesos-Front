import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts";
import "./index.css";
import App from "./App.tsx";

// Arranca MSW solo si VITE_USE_MOCKS=true (modo demo sin backend).
async function enableMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== "true") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

void enableMocks().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
