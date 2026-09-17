import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, setTokenBridge } from "@/lib/api-client";
import { planificacionKeys } from "@/features/planificacion-ventas/queries/keys";
import { AuthProvider, useAuth } from "./auth-context";
import type { AuthResponse, RolNombre } from "./types";

vi.mock("@/lib/api-client", () => ({ apiClient: { post: vi.fn() }, setTokenBridge: vi.fn() }));

function respuesta(
  id: number,
  nombre: string,
  roles: RolNombre[] = ["planificacionventas"],
): AuthResponse {
  return {
    accessToken: "token-" + id,
    refreshToken: "refresh-" + id,
    expiresAtUtc: "2026-09-18T00:00:00Z",
    user: {
      id,
      nombre,
      email: nombre.toLowerCase() + "@example.test",
      roles,
    },
  };
}

function Probe() {
  const { user, login, logout } = useAuth();
  const client = useQueryClient();
  const cached = client.getQueryData<string>(planificacionKeys.contexto()) ?? "vacía";
  const consulta = useQuery({
    queryKey: planificacionKeys.contexto(),
    queryFn: () => new Promise<string>(() => {}),
    enabled: !!user,
    staleTime: Infinity,
  });
  return (
    <div>
      <span>{(user?.nombre ?? "Anónimo") + ": " + cached}</span>
      <span>{"Query: " + (consulta.data ?? "vacía")}</span>
      <button onClick={() => void login("a@example.test", "clave")}>Entrar A</button>
      <button onClick={() => void login("b@example.test", "clave")}>Entrar B</button>
      <button onClick={logout}>Salir</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(apiClient.post).mockImplementation(async (_url, body) => {
    const email = (body as { email: string }).email;
    return {
      data: email.startsWith("a") ? respuesta(1, "Usuario A") : respuesta(2, "Usuario B"),
    } as never;
  });
});
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("caché y sesión", () => {
  it("limpia cache si refresh cambia roles del mismo usuario y conserva cache si solo cambia orden", async () => {
    let roles: RolNombre[] = ["planificacionventas", "planificacionventasgestion"];
    vi.mocked(apiClient.post).mockImplementation(
      async () =>
        ({
          data: respuesta(1, "Usuario A", roles),
        }) as never,
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Entrar A" }));
    await screen.findByText("Usuario A: vacía");
    client.setQueryData(planificacionKeys.contexto(), "gestion A");
    const bridge = vi.mocked(setTokenBridge).mock.lastCall?.[0];
    expect(bridge).toBeDefined();
    roles = [...roles].reverse();
    await bridge!.refresh();
    expect(client.getQueryData(planificacionKeys.contexto())).toBe("gestion A");
    roles = roles.filter((rol) => rol !== "planificacionventasgestion");
    await bridge!.refresh();
    expect(client.getQueryData(planificacionKeys.contexto())).toBeUndefined();
    expect(await screen.findByText(/^Query: vac/)).toBeInTheDocument();
  });

  it("limpia contexto y planes antes de mostrar otro usuario en la misma pestaña", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Entrar A" }));
    await screen.findByText("Usuario A: vacía");
    client.setQueryData(planificacionKeys.contexto(), "cartera A");
    await screen.findByText("Query: cartera A");
    client.setQueryData(planificacionKeys.plan("2026-2027", undefined, false), {
      filas: ["productor A"],
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar B" }));
    expect(await screen.findByText("Usuario B: vacía")).toBeInTheDocument();
    expect(screen.getByText("Query: vacía")).toBeInTheDocument();
    expect(client.getQueryData(planificacionKeys.contexto())).toBeUndefined();
    expect(
      client.getQueryData(planificacionKeys.plan("2026-2027", undefined, false)),
    ).toBeUndefined();
    client.setQueryData(planificacionKeys.contexto(), "cartera B");
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(client.getQueryData(planificacionKeys.contexto())).toBeUndefined());
  });
});
