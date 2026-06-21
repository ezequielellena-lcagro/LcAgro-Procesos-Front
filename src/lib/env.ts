// Único lugar que lee import.meta.env: el resto del código no depende de Vite y falla temprano
// si falta una variable obligatoria.
const env = {
  apiUrl: import.meta.env.VITE_API_URL,
  useMocks: import.meta.env.VITE_USE_MOCKS === "true",
} as const;

if (!env.apiUrl) {
  throw new Error("Falta VITE_API_URL. Copiá .env.example a .env.local y completala.");
}

export { env };
