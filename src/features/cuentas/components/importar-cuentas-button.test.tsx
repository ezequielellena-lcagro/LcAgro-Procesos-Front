import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { ImportacionResultado } from "../queries/use-importar-cuentas";
import { useImportarCuentas } from "../queries/use-importar-cuentas";
import { ImportarCuentasButton } from "./importar-cuentas-button";

vi.mock("../queries/use-importar-cuentas", () => ({ useImportarCuentas: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const como = <R,>(r: unknown): R => r as R;

/** El archivo real de Bravin: 195 filas, 10 son suyas y 6 traen algo distinto de lo guardado. */
const OK: ImportacionResultado = {
  cuentasImportadas: 10,
  cuentasActualizadas: 6,
  filasLeidas: 195,
  filasIgnoradas: 185,
  vendedorDetectado: "GUILLERMO BRAVIN",
  advertencias: [],
};

/** Error tal como llega del backend cuando el archivo no está filtrado por vendedor. */
function errorVariosVendedores() {
  return new AxiosError("Request failed", "400", undefined, null, {
    status: 400,
    statusText: "Bad Request",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: {
      status: 400,
      detail: "El archivo tiene cuentas de 10 vendedores a la vista.",
      codigo: "varios_vendedores",
    },
  });
}

function montar(mutateAsync: ReturnType<typeof vi.fn>) {
  vi.mocked(useImportarCuentas).mockReturnValue(
    como({ mutateAsync, isPending: false }),
  );
  return render(<ImportarCuentasButton />);
}

function elegirArchivo(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([""], "cuentas.xlsx")] } });
}

describe("ImportarCuentasButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sube el archivo sin confirmar cuando la usuaria lo elige", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(OK);
    const { container } = montar(mutateAsync);

    elegirArchivo(container);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ confirmarVariosVendedores: false }),
      ),
    );
  });

  it("avisa cuántas cuentas se importaron y cuántas se modificaron, y de qué vendedor", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(OK);
    const { container } = montar(mutateAsync);

    elegirArchivo(container);

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const mensaje = vi.mocked(toast.success).mock.calls[0][0] as string;
    expect(mensaje).toContain("GUILLERMO BRAVIN");
    expect(mensaje).toContain("10 cuentas importadas");
    expect(mensaje).toContain("6 modificadas");
  });

  it("no menciona las filas descartadas: pasa en todos los imports y no es lo que se mira", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(OK);
    const { container } = montar(mutateAsync);

    elegirArchivo(container);

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const mensaje = vi.mocked(toast.success).mock.calls[0][0] as string;
    expect(mensaje).not.toMatch(/ignor|descart|195|185/i);
  });

  it("sigue mostrando las advertencias que manda el backend", async () => {
    const aviso = "La cuenta 7021 aparece dos veces en el archivo.";
    const mutateAsync = vi.fn().mockResolvedValue({ ...OK, advertencias: [aviso] });
    const { container } = montar(mutateAsync);

    elegirArchivo(container);

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(aviso));
  });

  it("pide confirmación en vez de pisar cuando el archivo tiene varios vendedores", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(errorVariosVendedores());
    const { container } = montar(mutateAsync);

    elegirArchivo(container);

    expect(await screen.findByText(/no está filtrado por vendedor/i)).toBeInTheDocument();
    expect(screen.getByText(/10 vendedores a la vista/i)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reintenta confirmando cuando la usuaria acepta importar el archivo entero", async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValueOnce(errorVariosVendedores())
      .mockResolvedValueOnce(OK);
    const { container } = montar(mutateAsync);

    elegirArchivo(container);
    fireEvent.click(await screen.findByRole("button", { name: /importar igual/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({ confirmarVariosVendedores: true }),
      ),
    );
  });
});
