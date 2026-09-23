import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TotalesPorPlanta } from "./totales-por-planta";

describe("TotalesPorPlanta", () => {
  it("muestra el total de cada componente con su subtítulo", () => {
    render(
      <TotalesPorPlanta
        items={[
          { titulo: "Planta 15", subtitulo: "Acopio San Jorge", tn: 22107.57 },
          { titulo: "Silobolsa", subtitulo: "Embolsado en campo", tn: 0 },
        ]}
      />,
    );

    expect(screen.getByText("Planta 15")).toBeInTheDocument();
    expect(screen.getByText("22.107,57 tn")).toBeInTheDocument();
    expect(screen.getByText("Acopio San Jorge")).toBeInTheDocument();
    expect(screen.getByText("0 tn")).toBeInTheDocument();
  });

  it("usa `title` como explicación al pasar el mouse cuando viene", () => {
    // Es lo que reemplazó al aviso suelto de silobolsa pendiente: la aclaración vive en la celda.
    render(
      <TotalesPorPlanta
        items={[
          {
            titulo: "Silobolsa",
            subtitulo: "Pendiente de carga",
            title: "La silobolsa se carga por otra vía; hoy figura en 0.",
            tn: 0,
          },
        ]}
      />,
    );

    expect(screen.getByText("Pendiente de carga")).toHaveAttribute(
      "title",
      "La silobolsa se carga por otra vía; hoy figura en 0.",
    );
  });
});
