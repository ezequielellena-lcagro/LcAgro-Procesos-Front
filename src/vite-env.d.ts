/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API .NET (LcAgro.Api), sin barra final. Ej: http://localhost:5080/api */
  readonly VITE_API_URL: string;
  /** "true" para usar mocks (MSW) en vez de la API real. */
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
