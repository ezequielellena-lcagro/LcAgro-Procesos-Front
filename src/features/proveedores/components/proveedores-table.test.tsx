import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usd } from "@/shared/format/format";
import type { ProveedorDto, TotalesProveedores, TramoDto } from "../types";
import { ProveedoresTable } from "./proveedores-table";

// Calendario parado en julio 2026 (offsets 1, 2, 4, 6), tal como lo devuelve el backend.
const TRAMOS: TramoDto[] = [
  { etiqueta: "Hasta 31-08-2026", desde: null, hasta: "2026-08-31" },
  { etiqueta: "01-09 → 30-09-2026", desde: "2026-08-31", hasta: "2026-09-30" },
  { etiqueta: "01-10 → 30-11-2026", desde: "2026-09-30", hasta: "2026-11-30" },
  { etiqueta: "30-11 → 31-01-2027", desde: "2026-11-30", hasta: "2027-01-31" },
  { etiqueta: "Posterior a 31-01-2027", desde: "2027-01-31", hasta: null },
];

const FILA: ProveedorDto = {
  numero: 10010,
  denominacion: "Agroquímica del Litoral S.A.",
  montos: [100, 200, 300, 400, 0],
  saldoTotal: 1000, // invariante del backend: Σ montos = saldoTotal
  yaVencido: -50, // memo: NO suma
};

const TOTALES: TotalesProveedores = {
  montos: [100, 200, 300, 400, 0],
  saldoTotal: 1000,
  yaVencido: -50,
  proveedores: 1,
};

describe("ProveedoresTable", () => {
  it("toma los encabezados de los tramos que manda el backend (los cortes ruedan con el mes base)", () => {
    render(<ProveedoresTable filas={[FILA]} tramos={TRAMOS} totales={TOTALES} />);
    for (const t of TRAMOS) {
      expect(screen.getByRole("columnheader", { name: t.etiqueta })).toBeInTheDocument();
    }
  });

  it("alinea montos[i] con tramos[i] (array posicional, sin reordenar)", () => {
    render(<ProveedoresTable filas={[FILA]} tramos={TRAMOS} totales={TOTALES} />);
    const fila = screen.getAllByRole("row")[1]; // 0 = encabezados
    const celdas = within(fila)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(celdas).toEqual([
      "10010",
      "Agroquímica del Litoral S.A.",
      usd(100),
      usd(200),
      usd(300),
      usd(400),
      usd(0),
      usd(1000),
      usd(-50),
    ]);
  });

  it("el pie totaliza el set filtrado completo, no la página", () => {
    render(<ProveedoresTable filas={[FILA]} tramos={TRAMOS} totales={TOTALES} />);
    const filas = screen.getAllByRole("row");
    const pie = within(filas[filas.length - 1])
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(pie[1]).toBe("TOTAL (1 proveedor)");
    expect(pie.slice(2, 7)).toEqual([usd(100), usd(200), usd(300), usd(400), usd(0)]);
    expect(pie[7]).toBe(usd(1000));
  });

  // Blindaje del contrato: la cantidad de tramos la decide el BACKEND (hoy 5, mañana las que sean).
  // Si el front asumiera 5 columnas fijas, un horizonte de más dejaría plata bajo la columna
  // equivocada SIN romper nada: por eso este caso corre con 3 tramos y otro con 7.
  it("se adapta a una cantidad de tramos distinta de 5 (3 tramos)", () => {
    const tresTramos: TramoDto[] = [
      { etiqueta: "Hasta 31-08-2026", desde: null, hasta: "2026-08-31" },
      { etiqueta: "01-09 → 30-09-2026", desde: "2026-08-31", hasta: "2026-09-30" },
      { etiqueta: "Posterior a 30-09-2026", desde: "2026-09-30", hasta: null },
    ];
    const fila: ProveedorDto = { ...FILA, montos: [11, 22, 33], saldoTotal: 66 };
    const totales: TotalesProveedores = {
      montos: [11, 22, 33],
      saldoTotal: 66,
      yaVencido: -50,
      proveedores: 1,
    };

    render(<ProveedoresTable filas={[fila]} tramos={tresTramos} totales={totales} />);

    const encabezados = screen.getAllByRole("columnheader").map((c) => c.textContent);
    expect(encabezados).toEqual([
      "N°",
      "Proveedor",
      ...tresTramos.map((t) => t.etiqueta),
      "Saldo total",
      "Ya vencido",
    ]);

    const celdas = within(screen.getAllByRole("row")[1])
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(celdas).toEqual([
      "10010",
      "Agroquímica del Litoral S.A.",
      usd(11),
      usd(22),
      usd(33),
      usd(66),
      usd(-50),
    ]);
  });

  it("se adapta a una cantidad de tramos distinta de 5 (7 tramos) y el pie sigue alineado", () => {
    const sieteTramos: TramoDto[] = Array.from({ length: 7 }, (_, i) => ({
      etiqueta: `Tramo ${i + 1}`,
      desde: i === 0 ? null : `2026-0${i + 2}-01`,
      hasta: i === 6 ? null : `2026-0${i + 2}-28`,
    }));
    const montos = [1, 2, 3, 4, 5, 6, 7];
    const fila: ProveedorDto = { ...FILA, montos, saldoTotal: 28 };
    const totales: TotalesProveedores = { montos, saldoTotal: 28, yaVencido: 0, proveedores: 2 };

    render(<ProveedoresTable filas={[fila]} tramos={sieteTramos} totales={totales} />);

    // 2 columnas fijas + 7 tramos + saldo total + ya vencido
    expect(screen.getAllByRole("columnheader")).toHaveLength(11);

    const filas = screen.getAllByRole("row");
    const pie = within(filas[filas.length - 1])
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(pie).toHaveLength(11); // el pie es posicional: nunca puede desalinearse de las columnas
    expect(pie[1]).toBe("TOTAL (2 proveedores)");
    expect(pie.slice(2, 9)).toEqual(montos.map(usd));
    expect(pie[9]).toBe(usd(28));
  });

  it("aclara que 'ya vencido' es un memo y no suma con los tramos", () => {
    render(<ProveedoresTable filas={[FILA]} tramos={TRAMOS} totales={TOTALES} />);
    const memo = screen.getByRole("columnheader", { name: /Ya vencido/ });
    expect(within(memo).getByTitle(/no suma/i)).toBeInTheDocument();
  });
});
