import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./pagination";

const base = { page: 1, totalPages: 2, onPage: vi.fn() };

describe("Pagination", () => {
  it("cuenta 'resultados' por default", () => {
    render(<Pagination {...base} total={7} />);
    expect(screen.getByText("7 resultados")).toBeInTheDocument();
  });

  it("singulariza el default", () => {
    render(<Pagination {...base} total={1} />);
    expect(screen.getByText("1 resultado")).toBeInTheDocument();
  });

  it("usa la unidad que le pasen (el listado de stock pagina artículos)", () => {
    render(<Pagination {...base} total={6} unidad={{ singular: "artículo", plural: "artículos" }} />);
    expect(screen.getByText("6 artículos")).toBeInTheDocument();
  });

  it("singulariza la unidad que le pasen", () => {
    render(<Pagination {...base} total={1} unidad={{ singular: "artículo", plural: "artículos" }} />);
    expect(screen.getByText("1 artículo")).toBeInTheDocument();
  });

  it("agrega el detalle cuando las filas no son la unidad paginada", () => {
    render(
      <Pagination
        {...base}
        total={6}
        unidad={{ singular: "artículo", plural: "artículos" }}
        detalle="7 lotes en esta página"
      />,
    );
    expect(screen.getByText("6 artículos · 7 lotes en esta página")).toBeInTheDocument();
  });
});
