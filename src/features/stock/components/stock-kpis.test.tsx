import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TabStock } from "../tabs";
import type { TotalesStock } from "../types";
import { StockKpis } from "./stock-kpis";

const totales: TotalesStock = {
  cantidadArticulos: 207,
  valorUsdTotal: 6588852,
  valorUsdPropio: 5000000,
  valorUsdConsignado: 1588852,
  valorUsdInmovilizado: 1200000,
  valorUsdComprometido: 412500,
  pctInmovilizado: 18.2,
  cantidadRiesgoQuiebre: 14,
  cantidadBajoMinimo: 9,
  valorUsdVencido: 24218,
  valorUsdPorVencer: 56344,
  cantidadPorVencer: 31,
  antiguedadPromedioDias: 145,
};

const TABS: TabStock[] = ["stock", "global", "vencimientos", "inmovilizado", "rubro"];

describe("StockKpis — solapa Stock", () => {
  it("muestra el valor USD total formateado", () => {
    render(<StockKpis tab="stock" totales={totales} />);
    expect(screen.getByText(/6\.588\.852/)).toBeInTheDocument();
  });

  it("muestra el desglose propio/consignado como hint", () => {
    render(<StockKpis tab="stock" totales={totales} />);
    expect(screen.getByText(/Propio US\$ 5\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Consignado US\$ 1\.588\.852/)).toBeInTheDocument();
  });

  it("muestra el USD comprometido con el hint que lo explica", () => {
    render(<StockKpis tab="stock" totales={totales} />);
    expect(screen.getByText("USD comprometido")).toBeInTheDocument();
    expect(screen.getByText(/412\.500/)).toBeInTheDocument();
    expect(screen.getByText("Ya vendido, sin entregar")).toBeInTheDocument();
  });
});

describe("StockKpis — solapa Stock global", () => {
  it("comparte los KPIs con la solapa Stock (mismo set, sumado por artículo)", () => {
    render(<StockKpis tab="global" totales={totales} />);
    expect(screen.getByText("Valor USD")).toBeInTheDocument();
    expect(screen.getByText("USD comprometido")).toBeInTheDocument();
  });
});

describe("StockKpis — solapa Vencimientos", () => {
  it("muestra USD vencido y por vencer", () => {
    render(<StockKpis tab="vencimientos" totales={totales} />);
    expect(screen.getByText("USD vencido")).toBeInTheDocument();
    expect(screen.getByText(/24\.218/)).toBeInTheDocument();
    expect(screen.getByText("Por vencer")).toBeInTheDocument();
    expect(screen.getByText(/56\.344/)).toBeInTheDocument();
  });

  it("muestra la cantidad de artículos por vencer como hint", () => {
    render(<StockKpis tab="vencimientos" totales={totales} />);
    expect(screen.getByText("31 art. (vencido + crítico)")).toBeInTheDocument();
  });
});

describe("StockKpis — solapa Inmovilizado", () => {
  it("muestra el USD inmovilizado", () => {
    render(<StockKpis tab="inmovilizado" totales={totales} />);
    expect(screen.getByText("USD inmovilizado")).toBeInTheDocument();
    expect(screen.getByText(/1\.200\.000/)).toBeInTheDocument();
  });

  it("muestra el % del total y la antigüedad promedio como hint", () => {
    render(<StockKpis tab="inmovilizado" totales={totales} />);
    expect(screen.getByText("18,2 % del total · antigüedad prom. 145 días")).toBeInTheDocument();
  });

  it("muestra '—' de antigüedad cuando no hay dato", () => {
    render(<StockKpis tab="inmovilizado" totales={{ ...totales, antiguedadPromedioDias: null }} />);
    expect(screen.getByText(/antigüedad prom\. —/)).toBeInTheDocument();
  });
});

describe("StockKpis — solapa Por rubro", () => {
  it("no muestra KPI", () => {
    const { container } = render(<StockKpis tab="rubro" totales={totales} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StockKpis — tarjetas eliminadas", () => {
  it.each(TABS)("la solapa %s no muestra Artículos / Bajo mínimo / En riesgo de quiebre", (tab) => {
    render(<StockKpis tab={tab} totales={totales} />);
    expect(screen.queryByText("Artículos")).not.toBeInTheDocument();
    expect(screen.queryByText("Bajo mínimo")).not.toBeInTheDocument();
    expect(screen.queryByText("En riesgo de quiebre")).not.toBeInTheDocument();
    expect(screen.queryByText("Antigüedad prom.")).not.toBeInTheDocument();
  });
});
