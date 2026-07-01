// Único lugar que lee import.meta.env. `apiUrl` por defecto es "/api" (mismo origen): en producción la
// propia API .NET sirve el front, así que el SPA la llama relativo y anda con cualquier IP/host sin
// rebuild. En desarrollo, .env.local lo apunta al puerto de la API (http://localhost:5080/api).
const env = {
  apiUrl: import.meta.env.VITE_API_URL || "/api",
  useMocks: import.meta.env.VITE_USE_MOCKS === "true",
} as const;

export { env };
