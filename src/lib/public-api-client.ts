import axios from "axios";
import { env } from "./env";

// Cliente para el portal externo del viajante: SIN interceptor de JWT (acceso por token en la URL).
export const publicApiClient = axios.create({
  baseURL: env.apiUrl,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});
