import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EstadoCopiaClientesDto } from "../types";
import { CopiaClientesAviso } from "./copia-clientes-aviso";

function estado(over: Partial<EstadoCopiaClientesDto> = {}): EstadoCopiaClientesDto {
  return {
    ultimaSincronizacion: "2026-09-12T10:00:00Z",
    ultimoIntentoFallido: null,
    ultimoError: null,
    desactualizada: false,
    sinCopia: false,
    cantidad: 5794,
    ...over,
  };
}

/**
 * Los 3 niveles de la copia local de clientes de MacroGest (R2.3/R2.4): ok, desactualizada (avisa
 * pero no bloquea) y sinCopia (bloquea el selector de clientes, pero no el resto del módulo). El
 * texto sale de `lib/copia-clientes.ts`; este componente sólo lo muestra con el color adecuado y
 * ofrece el botón "Actualizar clientes" (R2.3).
 */
describe("CopiaClientesAviso", () => {
  it("nivel ok: copia fresca", () => {
    render(<CopiaClientesAviso estado={estado()} onActualizar={vi.fn()} actualizando={false} />);

    expect(screen.getByText(/clientes actualizados/i)).toBeInTheDocument();
  });

  it("nivel desactualizada: avisa sin bloquear", () => {
    render(
      <CopiaClientesAviso estado={estado({ desactualizada: true })} onActualizar={vi.fn()} actualizando={false} />,
    );

    expect(screen.getByText(/desactualizados/i)).toBeInTheDocument();
  });

  it("nivel sinCopia: nunca hubo sincronizacion", () => {
    render(
      <CopiaClientesAviso
        estado={estado({ sinCopia: true, desactualizada: true, ultimaSincronizacion: null, cantidad: 0 })}
        onActualizar={vi.fn()}
        actualizando={false}
      />,
    );

    expect(screen.getByText(/todavía no hay clientes sincronizados/i)).toBeInTheDocument();
  });

  it('el boton "Actualizar clientes" llama al callback', () => {
    const onActualizar = vi.fn();
    render(<CopiaClientesAviso estado={estado()} onActualizar={onActualizar} actualizando={false} />);

    fireEvent.click(screen.getByRole("button", { name: /actualizar clientes/i }));

    expect(onActualizar).toHaveBeenCalled();
  });

  it("el boton se deshabilita mientras actualiza", () => {
    render(<CopiaClientesAviso estado={estado()} onActualizar={vi.fn()} actualizando />);

    expect(screen.getByRole("button", { name: /actualizando/i })).toBeDisabled();
  });
});
