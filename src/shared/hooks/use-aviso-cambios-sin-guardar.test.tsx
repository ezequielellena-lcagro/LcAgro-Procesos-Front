import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAvisoCambiosSinGuardar } from "./use-aviso-cambios-sin-guardar";

function Formulario() {
  const [hayCambios, setHayCambios] = useState(false);
  const [campania, setCampania] = useState("2026/27");
  const { confirmarCambio } = useAvisoCambiosSinGuardar(hayCambios);

  return (
    <>
      <button onClick={() => setHayCambios((valor) => !valor)}>Alternar borrador</button>
      <button
        onClick={() => {
          if (confirmarCambio()) setCampania("2025/26");
        }}
      >
        Cambiar campaña
      </button>
      <span>{campania}</span>
      <Link to="/salida">Salir</Link>
    </>
  );
}

function montar() {
  const router = createMemoryRouter(
    [
      { path: "/plan", element: <Formulario /> },
      { path: "/salida", element: <span>Otra pantalla</span> },
    ],
    { initialEntries: ["/plan"] },
  );
  render(<RouterProvider router={router} />);
}

describe("useAvisoCambiosSinGuardar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("protege la recarga sólo mientras hay borrador", () => {
    montar();
    const limpio = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(limpio);
    expect(limpio.defaultPrevented).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Alternar borrador" }));
    const sucio = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(sucio);
    expect(sucio.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Alternar borrador" }));
    const guardado = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(guardado);
    expect(guardado.defaultPrevented).toBe(false);
  });

  it("permite cancelar o aceptar la navegación con cambios", async () => {
    const confirmar = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Alternar borrador" }));

    fireEvent.click(screen.getByRole("link", { name: "Salir" }));
    expect(await screen.findByRole("link", { name: "Salir" })).toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("link", { name: "Salir" }));
    expect(await screen.findByText("Otra pantalla")).toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(confirmar).toHaveBeenNthCalledWith(
      1,
      "Tenés cambios sin guardar. ¿Querés descartarlos y salir?",
    );
  });

  it("usa un mensaje propio para cambiar campaña o vendedor", () => {
    const confirmar = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Alternar borrador" }));

    fireEvent.click(screen.getByRole("button", { name: "Cambiar campaña" }));
    expect(screen.getByText("2026/27")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar campaña" }));
    expect(screen.getByText("2025/26")).toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(confirmar).toHaveBeenNthCalledWith(
      1,
      "Tenés cambios sin guardar. ¿Querés descartarlos y cambiar la selección?",
    );
  });

  it("no pregunta si no hay cambios", () => {
    const confirmar = vi.spyOn(window, "confirm");
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar campaña" }));
    expect(screen.getByText("2025/26")).toBeInTheDocument();
    expect(confirmar).not.toHaveBeenCalled();
  });
});
