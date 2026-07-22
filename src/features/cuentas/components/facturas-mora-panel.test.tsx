import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usd } from "@/shared/format/format";
import type { FacturasEnMora } from "../types";
import { useFacturasEnMora } from "../queries/use-facturas-en-mora";
import { FacturasMoraPanel } from "./facturas-mora-panel";

vi.mock("../queries/use-facturas-en-mora", () => ({ useFacturasEnMora: vi.fn() }));

/** Evita reconstruir todo el UseQueryResult en cada caso: solo importa lo que el panel lee. */
const comoResultado = (r: unknown) => r as ReturnType<typeof useFacturasEnMora>;

const DATOS: FacturasEnMora = {
  corte: "2026-07-21",
  totales: { vendedores: 1, cuentas: 2, facturas: 3, monto: 15900.33 },
  vendedores: [
    {
      vendNro: 2,
      vendedor: "PAMPA SUR",
      cuentas: 2,
      facturas: 3,
      monto: 15900.33,
      detalle: [
        {
          cuenta: 2011,
          denominacion: "Cabaña Los Aromos",
          saldoVencido: 12000.11,
          saldoAVencer: 2500.22,
          saldo: 14500.33,
          monto: 11400.33,
          facturas: [
            {
              comprobante: "A-17650",
              emision: "2025-08-05",
              vencimiento: "2025-09-04",
              plazoDias: 30,
              diasAtraso: 320,
              importe: 12500,
              pendiente: 9800,
            },
            {
              comprobante: "A-18033",
              emision: "2025-09-30",
              vencimiento: "2025-10-30",
              plazoDias: 30,
              diasAtraso: 264,
              importe: 1700.55,
              pendiente: 1600.33,
            },
          ],
        },
        {
          // Saldada por canje: el saldo global (980) es menor que la mora (4.500).
          cuenta: 2044,
          denominacion: "Siembras del Oeste S.A.",
          saldoVencido: 980,
          saldoAVencer: 0,
          saldo: 980,
          monto: 4500,
          facturas: [
            {
              comprobante: "A-16988",
              emision: "2025-06-18",
              vencimiento: "2025-07-18",
              plazoDias: 30,
              diasAtraso: 368,
              importe: 4500,
              pendiente: 4500,
            },
          ],
        },
      ],
    },
  ],
};

const bloqueDe = (titulo: string) => screen.getByText(titulo).closest("article");

describe("FacturasMoraPanel", () => {
  beforeEach(() => {
    vi.mocked(useFacturasEnMora).mockReturnValue(
      comoResultado({ isPending: false, isError: false, data: DATOS }),
    );
  });

  it("agrupa vendedor → cuenta → facturas", () => {
    render(<FacturasMoraPanel activa />);

    expect(screen.getByRole("button", { name: /PAMPA SUR/ })).toBeInTheDocument();

    const aromos = bloqueDe("2011 — Cabaña Los Aromos");
    expect(aromos).toHaveTextContent("A-17650");
    expect(aromos).toHaveTextContent("A-18033");
    expect(aromos).toHaveTextContent("320"); // días de atraso

    const oeste = bloqueDe("2044 — Siembras del Oeste S.A.");
    expect(oeste).toHaveTextContent("A-16988");
    expect(oeste).not.toHaveTextContent("A-17650"); // cada cuenta lleva solo sus facturas
  });

  it("renderiza el saldo global de la cuenta (vencido / a vencer / total)", () => {
    render(<FacturasMoraPanel activa />);

    const aromos = bloqueDe("2011 — Cabaña Los Aromos");
    expect(aromos).toHaveTextContent("Vencido");
    expect(aromos).toHaveTextContent("A vencer");
    expect(aromos).toHaveTextContent("Saldo total");
    expect(aromos).toHaveTextContent(usd(12000.11));
    expect(aromos).toHaveTextContent(usd(2500.22));
    expect(aromos).toHaveTextContent(usd(14500.33));
  });

  it("tolera que el saldo global sea menor que la mora (saldada por canje/LSG)", () => {
    render(<FacturasMoraPanel activa />);

    const oeste = bloqueDe("2044 — Siembras del Oeste S.A.");
    expect(oeste).toHaveTextContent(usd(980)); // el saldo global se muestra igual
    expect(oeste).toHaveTextContent(usd(4500)); // aunque la mora sea mayor
    expect(oeste).toHaveTextContent(/saldo global es menor que la mora/i);
  });

  it("colapsa el vendedor y esconde sus cuentas", () => {
    render(<FacturasMoraPanel activa />);
    const encabezado = screen.getByRole("button", { name: /PAMPA SUR/ });
    expect(encabezado).toHaveAttribute("aria-expanded", "true"); // abierto por defecto

    fireEvent.click(encabezado);

    expect(encabezado).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("2011 — Cabaña Los Aromos")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay facturas en mora", () => {
    vi.mocked(useFacturasEnMora).mockReturnValue(
      comoResultado({
        isPending: false,
        isError: false,
        data: { corte: "2026-07-21", totales: { vendedores: 0, cuentas: 0, facturas: 0, monto: 0 }, vendedores: [] },
      }),
    );
    render(<FacturasMoraPanel activa />);
    expect(screen.getByText(/No hay facturas de contado en mora/i)).toBeInTheDocument();
  });
});
