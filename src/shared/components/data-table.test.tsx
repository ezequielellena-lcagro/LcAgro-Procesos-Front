import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, type Column } from "./data-table";

interface Fila {
  id: number;
  banco: string;
  vence: string;
  total: number;
  tna: number | null;
}

const FILAS: Fila[] = [
  { id: 1, banco: "NACIÓN", vence: "2027-01-28", total: 30_646_027.4, tna: 10 },
  { id: 2, banco: "GALICIA", vence: "2026-10-15", total: 174_463.69, tna: 2.9 },
  { id: 3, banco: "SANTANDER", vence: "2026-12-31", total: 183_300, tna: null },
];

const COLUMNAS: Column<Fila>[] = [
  { key: "vence", header: "Vencimiento", cell: (f) => f.vence, sortBy: (f) => f.vence },
  { key: "banco", header: "Banco", cell: (f) => f.banco, sortBy: (f) => f.banco },
  { key: "total", header: "Total", align: "right", cell: (f) => f.total, sortBy: (f) => f.total },
  { key: "tna", header: "TNA", cell: (f) => f.tna ?? "—", sortBy: (f) => f.tna },
  { key: "acciones", header: "", cell: () => "Pagar" },
];

/**
 * El contenido de una columna, fila por fila, en el orden en que se ve. Se saltean las filas que
 * no son de datos: el encabezado y, cuando hay agrupación, el título de cada grupo (que es un
 * `<th scope="colgroup">` y por eso no tiene celdas).
 */
function columna(indice: number): string[] {
  return screen
    .getAllByRole("row")
    .map((tr) => within(tr).queryAllByRole("cell"))
    .filter((celdas) => celdas.length > 0)
    .map((celdas) => celdas[indice]?.textContent ?? "");
}

describe("DataTable · ordenamiento", () => {
  it("sin tocar nada respeta el orden que le pasaron", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);

    expect(columna(1)).toEqual(["NACIÓN", "GALICIA", "SANTANDER"]);
  });

  it("solo las columnas con sortBy son clickeables", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);

    expect(screen.getByRole("button", { name: /banco/i })).toBeInTheDocument();
    // La de acciones no tiene sortBy: ordenar por ella no significaría nada.
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("el primer clic ordena ascendente", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);

    fireEvent.click(screen.getByRole("button", { name: /banco/i }));

    expect(columna(1)).toEqual(["GALICIA", "NACIÓN", "SANTANDER"]);
  });

  it("el segundo clic lo invierte", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);
    const banco = screen.getByRole("button", { name: /banco/i });

    fireEvent.click(banco);
    fireEvent.click(banco);

    expect(columna(1)).toEqual(["SANTANDER", "NACIÓN", "GALICIA"]);
  });

  it("el tercer clic vuelve al orden original", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);
    const banco = screen.getByRole("button", { name: /banco/i });

    fireEvent.click(banco);
    fireEvent.click(banco);
    fireEvent.click(banco);

    expect(columna(1)).toEqual(["NACIÓN", "GALICIA", "SANTANDER"]);
  });

  it("ordenar por otra columna descarta el orden anterior", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);

    fireEvent.click(screen.getByRole("button", { name: /banco/i }));
    fireEvent.click(screen.getByRole("button", { name: /vencimiento/i }));

    expect(columna(0)).toEqual(["2026-10-15", "2026-12-31", "2027-01-28"]);
  });

  /** Un importe se ordena por valor, no por su texto: "9" no va después de "30.646.027,40". */
  it("los números se ordenan como números", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);

    fireEvent.click(screen.getByRole("button", { name: /total/i }));

    expect(columna(2)).toEqual(["174463.69", "183300", "30646027.4"]);
  });

  /** "Ñ" después de "N", y sin distinguir mayúsculas: es una tabla en español. */
  it("los textos se ordenan con criterio local", () => {
    const filas = [
      { ...FILAS[0], banco: "ñandú" },
      { ...FILAS[1], banco: "Nación" },
      { ...FILAS[2], banco: "MACRO" },
    ];
    render(<DataTable columns={COLUMNAS} rows={filas} getRowKey={(f) => f.id} />);

    fireEvent.click(screen.getByRole("button", { name: /banco/i }));

    expect(columna(1)).toEqual(["MACRO", "Nación", "ñandú"]);
  });

  /** Sin dato no es "cero" ni "vacío primero": va al final, en los dos sentidos. */
  it("las celdas sin valor quedan al final aunque se invierta", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);
    const tna = screen.getByRole("button", { name: /tna/i });

    fireEvent.click(tna);
    expect(columna(3).at(-1)).toBe("—");

    fireEvent.click(tna);
    expect(columna(3).at(-1)).toBe("—");
  });

  it("anuncia el sentido del orden a los lectores de pantalla", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);
    const encabezado = () => screen.getByRole("columnheader", { name: /banco/i });

    expect(encabezado()).toHaveAttribute("aria-sort", "none");
    fireEvent.click(screen.getByRole("button", { name: /banco/i }));
    expect(encabezado()).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: /banco/i }));
    expect(encabezado()).toHaveAttribute("aria-sort", "descending");
  });

  it("puede arrancar ordenada por una columna", () => {
    render(
      <DataTable
        columns={COLUMNAS}
        rows={FILAS}
        getRowKey={(f) => f.id}
        defaultSort={{ key: "banco" }}
      />,
    );

    expect(columna(1)).toEqual(["GALICIA", "NACIÓN", "SANTANDER"]);
    expect(screen.getByRole("columnheader", { name: /banco/i })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("el orden inicial se puede invertir y soltar como cualquier otro", () => {
    render(
      <DataTable
        columns={COLUMNAS}
        rows={FILAS}
        getRowKey={(f) => f.id}
        defaultSort={{ key: "banco" }}
      />,
    );
    const banco = screen.getByRole("button", { name: /banco/i });

    fireEvent.click(banco);
    expect(columna(1)).toEqual(["SANTANDER", "NACIÓN", "GALICIA"]);

    // Y el siguiente clic devuelve el orden con el que vinieron los datos, no el inicial.
    fireEvent.click(banco);
    expect(columna(1)).toEqual(["NACIÓN", "GALICIA", "SANTANDER"]);
  });

  it("el orden inicial acepta empezar al revés", () => {
    render(
      <DataTable
        columns={COLUMNAS}
        rows={FILAS}
        getRowKey={(f) => f.id}
        defaultSort={{ key: "total", sentido: "desc" }}
      />,
    );

    expect(columna(2)).toEqual(["30646027.4", "183300", "174463.69"]);
  });

  /** Las filas con el mismo valor conservan el orden en que vinieron: un sort estable. */
  it("no reordena las filas empatadas", () => {
    const filas = [
      { id: 1, banco: "NACIÓN", vence: "2026-11-09", total: 1, tna: 1 },
      { id: 2, banco: "NACIÓN", vence: "2027-05-10", total: 2, tna: 1 },
      { id: 3, banco: "GALICIA", vence: "2026-10-15", total: 3, tna: 1 },
    ];
    render(<DataTable columns={COLUMNAS} rows={filas} getRowKey={(f) => f.id} />);

    fireEvent.click(screen.getByRole("button", { name: /banco/i }));

    // Las dos de NACIÓN quedan en su orden cronológico original.
    expect(columna(0)).toEqual(["2026-10-15", "2026-11-09", "2027-05-10"]);
  });

  it("el pie de totales no se mueve al reordenar", () => {
    render(
      <DataTable
        columns={COLUMNAS}
        rows={FILAS}
        getRowKey={(f) => f.id}
        footer={["TOTAL", "", "31.003.791,09", "", ""]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /banco/i }));

    expect(screen.getByText("31.003.791,09")).toBeInTheDocument();
  });
});

describe("DataTable · legibilidad", () => {
  /**
   * Franjas alternadas: en una tabla de 30 filas y 12 columnas de números, seguir una fila con la
   * vista es la mitad del trabajo de leerla.
   */
  it("pinta las filas alternadas", () => {
    render(<DataTable columns={COLUMNAS} rows={FILAS} getRowKey={(f) => f.id} />);

    const filas = screen.getAllByRole("row").filter((tr) => tr.closest("tbody"));
    expect(filas[0]).not.toHaveAttribute("data-franja");
    expect(filas[1]).toHaveAttribute("data-franja");
    expect(filas[2]).not.toHaveAttribute("data-franja");
  });

  it("la franja se reinicia en cada grupo", () => {
    const filas = [
      { id: 1, banco: "NACIÓN", vence: "2027-01-28", total: 1, tna: 1 },
      { id: 2, banco: "NACIÓN", vence: "2027-02-28", total: 2, tna: 1 },
      { id: 3, banco: "GALICIA", vence: "2027-03-28", total: 3, tna: 1 },
    ];
    render(
      <DataTable
        columns={COLUMNAS}
        rows={filas}
        getRowKey={(f) => f.id}
        groupBy={{ clave: (f) => f.banco, titulo: (f) => f.banco }}
      />,
    );

    const conDatos = screen
      .getAllByRole("row")
      .filter((tr) => within(tr).queryAllByRole("cell").length > 1);

    // NACIÓN: sin franja, con franja. GALICIA arranca de nuevo: sin franja.
    expect(conDatos[0]).not.toHaveAttribute("data-franja");
    expect(conDatos[1]).toHaveAttribute("data-franja");
    expect(conDatos[2]).not.toHaveAttribute("data-franja");
  });
});

describe("DataTable · agrupación", () => {
  const agrupado = {
    clave: (f: Fila) => f.banco,
    titulo: (f: Fila, filas: Fila[]) => `${f.banco} · ${filas.length} cuotas`,
  };

  it("junta las filas de cada grupo bajo su título", () => {
    const filas = [...FILAS, { id: 4, banco: "GALICIA", vence: "2026-11-09", total: 100, tna: 1 }];
    render(
      <DataTable columns={COLUMNAS} rows={filas} getRowKey={(f) => f.id} groupBy={agrupado} />,
    );

    expect(screen.getByText("GALICIA · 2 cuotas")).toBeInTheDocument();
    expect(screen.getByText("NACIÓN · 1 cuotas")).toBeInTheDocument();
  });

  /** Las filas del mismo préstamo tienen que quedar contiguas: es el punto de agrupar. */
  it("las filas de un grupo quedan juntas aunque vinieran intercaladas", () => {
    const filas = [
      { id: 1, banco: "NACIÓN", vence: "2027-01-28", total: 1, tna: 1 },
      { id: 2, banco: "GALICIA", vence: "2027-02-28", total: 2, tna: 1 },
      { id: 3, banco: "NACIÓN", vence: "2027-03-28", total: 3, tna: 1 },
    ];
    render(
      <DataTable columns={COLUMNAS} rows={filas} getRowKey={(f) => f.id} groupBy={agrupado} />,
    );

    // Las filas de título también son filas: se filtran por tener una sola celda.
    expect(columna(1)).toEqual(["NACIÓN", "NACIÓN", "GALICIA"]);
  });

  it("cada grupo puede llevar su subtotal", () => {
    // Dos cuotas de NACIÓN: así el subtotal es un número que no está en ninguna celda suelta.
    const filas = [...FILAS, { id: 4, banco: "NACIÓN", vence: "2027-07-28", total: 9, tna: 10 }];
    render(
      <DataTable
        columns={COLUMNAS}
        rows={filas}
        getRowKey={(f) => f.id}
        groupBy={{
          ...agrupado,
          subtotal: (fs) => ["Subtotal", "", String(fs.reduce((s, f) => s + f.total, 0)), "", ""],
        }}
      />,
    );

    expect(screen.getAllByText("Subtotal")).toHaveLength(3);
    // El primer grupo es NACIÓN (la clave que aparece primero en las filas).
    const subtotalNacion = screen.getAllByText("Subtotal")[0].closest("tr")!;
    expect(within(subtotalNacion).getAllByRole("cell")[2]).toHaveTextContent("30646036.4");
  });

  it("agrupado, el orden por columna se aplica dentro de cada grupo", () => {
    const filas = [
      { id: 1, banco: "NACIÓN", vence: "2027-03-28", total: 3, tna: 1 },
      { id: 2, banco: "NACIÓN", vence: "2027-01-28", total: 1, tna: 1 },
    ];
    render(
      <DataTable columns={COLUMNAS} rows={filas} getRowKey={(f) => f.id} groupBy={agrupado} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /vencimiento/i }));

    expect(columna(0).filter((t) => t.startsWith("20"))).toEqual(["2027-01-28", "2027-03-28"]);
  });

  it("sin filas no dibuja ningún grupo", () => {
    render(<DataTable columns={COLUMNAS} rows={[]} getRowKey={(f) => f.id} groupBy={agrupado} />);

    expect(screen.getByText("Sin datos.")).toBeInTheDocument();
  });
});
