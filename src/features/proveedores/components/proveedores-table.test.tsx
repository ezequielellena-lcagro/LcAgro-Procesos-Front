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

// `montos` viene con MENOS elementos que `tramos` a propósito: el último tramo no tiene deuda y
// el backend podría no mandarlo. La tabla igual tiene que dibujar la columna (en 0), porque las
// columnas las manda `tramos`. Si alguien iterara `montos` para armar la fila, faltaría una celda.
const FILA: ProveedorDto = {
  numero: 90001,
  denominacion: "Agroquímica del Litoral S.A.",
  montos: [100, 200, 300, 400],
  saldoTotal: 1000, // invariante del backend: Σ montos = saldoTotal
  yaVencido: -50, // memo: NO suma
};

// A propósito NO coincide con la suma de `filas`: la página muestra 1 proveedor de 1.000, pero el
// set filtrado son 87 proveedores por 87.000. Es el escenario real (pageSize 50) y es lo único que
// distingue "totales del backend" de "sumar la página".
const TOTALES: TotalesProveedores = {
  montos: [12000, 25000, 30000, 15000, 5000],
  saldoTotal: 87000,
  yaVencido: -1500,
  proveedores: 87,
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
      "90001",
      "Agroquímica del Litoral S.A.",
      usd(100),
      usd(200),
      usd(300),
      usd(400),
      usd(0), // tramo sin dato: la columna existe igual
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
    expect(pie[1]).toBe("TOTAL (87 proveedores)");
    expect(pie.slice(2, 7)).toEqual(TOTALES.montos.map(usd));
    expect(pie[7]).toBe(usd(87000));
    expect(pie[8]).toBe(usd(-1500));
    // Y explícitamente: nada del pie sale de la fila que se está mostrando.
    expect(pie).not.toContain(usd(1000));
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
      montos: [4000, 5000, 6000],
      saldoTotal: 15000,
      yaVencido: -300,
      proveedores: 12,
    };

    render(<ProveedoresTable filas={[fila]} tramos={tresTramos} totales={totales} />);

    const encabezados = screen.getAllByRole("columnheader").map((c) => c.textContent);
    expect(encabezados).toEqual([
      "N°",
      "Proveedor",
      ...tresTramos.map((t) => t.etiqueta),
      "Saldo total",
      "Ya vencido (memo)",
    ]);

    const celdas = within(screen.getAllByRole("row")[1])
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(celdas).toEqual([
      "90001",
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
    const fila: ProveedorDto = { ...FILA, montos: [1, 2, 3, 4, 5, 6, 7], saldoTotal: 28 };
    const montosTotales = [10, 20, 30, 40, 50, 60, 70];
    const totales: TotalesProveedores = {
      montos: montosTotales,
      saldoTotal: 280,
      yaVencido: 0,
      proveedores: 2,
    };

    render(<ProveedoresTable filas={[fila]} tramos={sieteTramos} totales={totales} />);

    // 2 columnas fijas + 7 tramos + saldo total + ya vencido
    expect(screen.getAllByRole("columnheader")).toHaveLength(11);

    const filas = screen.getAllByRole("row");
    const pie = within(filas[filas.length - 1])
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(pie).toHaveLength(11); // el pie es posicional: nunca puede desalinearse de las columnas
    expect(pie[1]).toBe("TOTAL (2 proveedores)");
    expect(pie.slice(2, 9)).toEqual(montosTotales.map(usd));
    expect(pie[9]).toBe(usd(280));
  });

  it("aclara —en pantalla y en el papel— que 'ya vencido' es un memo y no suma", () => {
    render(<ProveedoresTable filas={[FILA]} tramos={TRAMOS} totales={TOTALES} />);
    // Visible, no en un title: el title no se ve al imprimir ni en touch, y esta pantalla se imprime.
    expect(screen.getByRole("columnheader", { name: "Ya vencido (memo)" })).toBeInTheDocument();
    const nota = screen.getByText(/no suma/i);
    expect(nota).toBeVisible();
    expect(nota).not.toHaveClass("no-print");
  });
});
