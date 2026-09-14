import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DestinoDto } from "../types";
import { DestinoSelect } from "./destino-select";

const DESTINOS: DestinoDto[] = [
  { id: 1, clienteNumero: 1234, nombre: "Campo La Elvira", activo: true, enUso: 2 },
  { id: 2, clienteNumero: 1234, nombre: "Silo planta propia", activo: true, enUso: 0 },
];

// `process` no esta tipado en este tsconfig (sin "node" en `types`, sólo el runtime de Vitest lo
// expone como global). Se accede vía `globalThis` para detectar promesas rechazadas sin manejar,
// sin necesidad de ampliar la config compartida del proyecto.
type EscuchaRechazo = (razon: unknown) => void;
const procesoNode = (
  globalThis as unknown as {
    process: { on: (evento: "unhandledRejection", cb: EscuchaRechazo) => void; off: (evento: "unhandledRejection", cb: EscuchaRechazo) => void };
  }
).process;

/**
 * Destinos/campos por cliente (R1.3): catálogo propio de cada cliente, con alta rápida desde el
 * armado de la orden. El POST es idempotente (200 si ya existía, 201 si es nuevo), pero de cualquier
 * forma el resultado siempre se selecciona: la planta no tiene que buscarlo de nuevo en la lista.
 */
describe("DestinoSelect", () => {
  it("elegir un destino existente llama a onChange con su id", () => {
    const onChange = vi.fn();
    render(<DestinoSelect destinos={DESTINOS} value={null} onChange={onChange} onAgregar={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^destino$/i), { target: { value: "2" } });

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("muestra el destino ya elegido", () => {
    render(<DestinoSelect destinos={DESTINOS} value={1} onChange={vi.fn()} onAgregar={vi.fn()} />);

    expect(screen.getByLabelText(/^destino$/i)).toHaveValue("1");
  });

  it("alta rapida: agrega un destino nuevo y selecciona el resultado", async () => {
    const nuevo: DestinoDto = { id: 9, clienteNumero: 1234, nombre: "Campo Norte", activo: true, enUso: 0 };
    const onAgregar = vi.fn().mockResolvedValue(nuevo);
    const onChange = vi.fn();
    render(<DestinoSelect destinos={DESTINOS} value={null} onChange={onChange} onAgregar={onAgregar} />);

    fireEvent.change(screen.getByLabelText(/nuevo destino/i), { target: { value: "Campo Norte" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar destino/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(9));
    expect(onAgregar).toHaveBeenCalledWith("Campo Norte");
  });

  it("no agrega un destino con nombre vacio", () => {
    const onAgregar = vi.fn();
    render(<DestinoSelect destinos={DESTINOS} value={null} onChange={vi.fn()} onAgregar={onAgregar} />);

    expect(screen.getByRole("button", { name: /agregar destino/i })).toBeDisabled();
  });

  it("el boton se deshabilita mientras agrega, para no duplicar el alta", async () => {
    let resolver: (d: DestinoDto) => void = () => {};
    const onAgregar = vi.fn(
      () =>
        new Promise<DestinoDto>((resolve) => {
          resolver = resolve;
        }),
    );
    render(<DestinoSelect destinos={DESTINOS} value={null} onChange={vi.fn()} onAgregar={onAgregar} />);

    fireEvent.change(screen.getByLabelText(/nuevo destino/i), { target: { value: "Campo Norte" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar destino/i }));

    expect(screen.getByRole("button", { name: /agregando/i })).toBeDisabled();

    // Al resolver, el input se vacía (el destino ya quedó elegido) y el botón vuelve a su rótulo
    // normal — deshabilitado otra vez, pero porque no hay nada para agregar, no porque siga en curso.
    resolver({ id: 9, clienteNumero: 1234, nombre: "Campo Norte", activo: true, enUso: 0 });
    await waitFor(() => expect(screen.getByRole("button", { name: /^agregar destino$/i })).toBeInTheDocument());
  });

  it("si onAgregar rechaza (fallo de red o validacion), no deja una promesa sin manejar y el boton se vuelve a habilitar", async () => {
    const onAgregar = vi.fn().mockRejectedValue(new Error("no se pudo crear el destino"));
    const onChange = vi.fn();
    const rechazosSinManejar: unknown[] = [];
    const capturar = (razon: unknown) => rechazosSinManejar.push(razon);
    procesoNode.on("unhandledRejection", capturar);

    try {
      render(<DestinoSelect destinos={DESTINOS} value={null} onChange={onChange} onAgregar={onAgregar} />);

      fireEvent.change(screen.getByLabelText(/nuevo destino/i), { target: { value: "Campo Norte" } });
      fireEvent.click(screen.getByRole("button", { name: /agregar destino/i }));

      await waitFor(() => expect(screen.getByRole("button", { name: /^agregar destino$/i })).toBeInTheDocument());
      // Le damos una vuelta más al loop de eventos: si `agregar()` dejó la promesa sin capturar,
      // Node recien la marca como "unhandledRejection" despues de este tick.
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      procesoNode.off("unhandledRejection", capturar);
    }

    expect(rechazosSinManejar).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^agregar destino$/i })).not.toBeDisabled();
  });
});
