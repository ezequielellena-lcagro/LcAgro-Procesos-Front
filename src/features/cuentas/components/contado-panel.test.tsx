import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usd } from "@/shared/format/format";
import type { Contado } from "../types";
import { useContado } from "../queries/use-contado";
import { ContadoPanel } from "./contado-panel";

vi.mock("../queries/use-contado", () => ({ useContado: vi.fn() }));

/** Evita reconstruir todo el UseQueryResult en cada caso: solo importa lo que el panel lee. */
const comoResultado = (r: unknown) => r as ReturnType<typeof useContado>;

const DATOS: Contado = {
  corte: "2026-07-23",
  totales: { vendedores: 1, cuentas: 2, facturas: 3, montoVencido: 9800, montoAVencer: 30770, monto: 40570 },
  vendedores: [
    {
      vendNro: 2,
      vendedor: "PAMPA SUR",
      cuentas: 2,
      facturas: 3,
      montoVencido: 9800,
      montoAVencer: 30770,
      monto: 40570,
      detalle: [
        {
          // Todo vencido.
          cuenta: 2011,
          denominacion: "Cabaña Los Aromos",
          saldoVencido: 12000.11,
          saldoAVencer: 2500.22,
          saldo: 14500.33,
          montoVencido: 9800,
          montoAVencer: 0,
          monto: 9800,
          facturas: [
            {
              comprobante: "A-17650",
              emision: "2025-08-05",
              vencimiento: "2025-09-04",
              plazoDias: 30,
              vencida: true,
              diasAtraso: 322,
              importe: 12500,
              pendiente: 9800,
            },
          ],
        },
        {
          // Solo a vencer (vencido 0) y, además, saldada por canje: el saldo global (980) es menor
          // que el monto de contado (30.770).
          cuenta: 2734,
          denominacion: "Mathier German Andres",
          saldoVencido: 0,
          saldoAVencer: 980,
          saldo: 980,
          montoVencido: 0,
          montoAVencer: 30770,
          monto: 30770,
          facturas: [
            {
              comprobante: "A-38736",
              emision: "2026-07-23",
              vencimiento: "2026-08-10",
              plazoDias: 18,
              vencida: false,
              diasAtraso: 0,
              importe: 29570,
              pendiente: 29570,
            },
            {
              comprobante: "A-38999",
              emision: "2026-07-18",
              vencimiento: "2026-08-17",
              plazoDias: 30,
              vencida: false,
              diasAtraso: 0,
              importe: 1200,
              pendiente: 1200,
            },
          ],
        },
      ],
    },
  ],
};

const bloqueDe = (titulo: string) => screen.getByText(titulo).closest("article");
const filaDe = (comprobante: string) => screen.getByText(comprobante).closest("tr") as HTMLElement;

describe("ContadoPanel", () => {
  beforeEach(() => {
    vi.mocked(useContado).mockReturnValue(comoResultado({ isPending: false, isError: false, data: DATOS }));
  });

  it("agrupa vendedor → cuenta → facturas", () => {
    render(<ContadoPanel activa />);

    expect(screen.getByRole("button", { name: /PAMPA SUR/ })).toBeInTheDocument();

    const aromos = bloqueDe("2011 — Cabaña Los Aromos");
    expect(aromos).toHaveTextContent("A-17650");

    const mathier = bloqueDe("2734 — Mathier German Andres");
    expect(mathier).toHaveTextContent("A-38736");
    expect(mathier).not.toHaveTextContent("A-17650"); // cada cuenta lleva solo sus facturas
  });

  it("renderiza el saldo global de la cuenta (vencido / a vencer / total)", () => {
    render(<ContadoPanel activa />);

    const aromos = bloqueDe("2011 — Cabaña Los Aromos");
    expect(aromos).toHaveTextContent("Vencido");
    expect(aromos).toHaveTextContent("A vencer");
    expect(aromos).toHaveTextContent("Saldo total");
    expect(aromos).toHaveTextContent(usd(12000.11));
    expect(aromos).toHaveTextContent(usd(2500.22));
    expect(aromos).toHaveTextContent(usd(14500.33));
  });

  it("marca cada factura como Vencida o A vencer según su estado", () => {
    render(<ContadoPanel activa />);

    const filaVencida = filaDe("A-17650");
    expect(within(filaVencida).getByText("Vencida")).toBeInTheDocument();
    expect(within(filaVencida).getByText("322")).toBeInTheDocument(); // días de atraso

    const filaAVencer = filaDe("A-38736");
    expect(within(filaAVencer).getByText("A vencer")).toBeInTheDocument();
    expect(within(filaAVencer).getByText("—")).toBeInTheDocument(); // a vencer no muestra días de atraso
  });

  it("tolera que el saldo global sea menor que el contado (saldada por canje/LSG)", () => {
    render(<ContadoPanel activa />);

    const mathier = bloqueDe("2734 — Mathier German Andres");
    expect(mathier).toHaveTextContent(usd(980)); // el saldo global se muestra igual
    expect(mathier).toHaveTextContent(usd(30770)); // aunque el contado sea mayor
    expect(mathier).toHaveTextContent(/saldo global es menor que el monto de contado/i);
  });

  it("colapsa el vendedor y esconde sus cuentas", () => {
    render(<ContadoPanel activa />);
    const encabezado = screen.getByRole("button", { name: /PAMPA SUR/ });
    expect(encabezado).toHaveAttribute("aria-expanded", "true"); // abierto por defecto

    fireEvent.click(encabezado);

    expect(encabezado).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("2011 — Cabaña Los Aromos")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay facturas de contado impagas", () => {
    vi.mocked(useContado).mockReturnValue(
      comoResultado({
        isPending: false,
        isError: false,
        data: {
          corte: "2026-07-23",
          totales: { vendedores: 0, cuentas: 0, facturas: 0, montoVencido: 0, montoAVencer: 0, monto: 0 },
          vendedores: [],
        },
      }),
    );
    render(<ContadoPanel activa />);
    expect(screen.getByText(/No hay facturas de contado impagas/i)).toBeInTheDocument();
  });
});
