import { describe, it, expect } from "vitest";
import {
  WEEKS_PER_MONTH,
  abcCurve,
  aggregateProductSales,
  breakEven,
  clientLtv,
  clientProfiles,
  monthlyFixedCosts,
  rfmGroups,
  rfmSegment,
  type AbcProduct,
  type AbcSaleRow,
  type BreakEvenInput,
  type ClientOrderRow,
} from "./businessInsights";

const DAY = 86_400_000;
const NOW = new Date("2026-10-18T15:00:00").getTime();
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe("monthlyFixedCosts", () => {
  it("suma las mensuales tal cual y pasa las semanales a un mes típico (52/12)", () => {
    const { total, rows } = monthlyFixedCosts([
      { amount: 2_000_000, frequency: "mensual", category: "Alquiler", description: null },
      { amount: 100_000, frequency: "semanal", category: "Limpieza", description: "Limpieza del local" },
    ]);
    expect(total).toBeCloseTo(2_000_000 + 100_000 * WEEKS_PER_MONTH, 5);
    expect(rows.map((r) => r.label)).toEqual(["Alquiler", "Limpieza del local"]);
  });

  it("usa la descripción como nombre y cae a la categoría si está vacía", () => {
    const { rows } = monthlyFixedCosts([
      { amount: 500_000, frequency: "mensual", category: "Servicios", description: "  " },
      { amount: 300_000, frequency: "mensual", category: "Servicios", description: "Internet" },
    ]);
    expect(rows.map((r) => r.label)).toEqual(["Servicios", "Internet"]);
  });

  it("acepta montos como texto (numeric de Postgres) y descarta los que no suman", () => {
    const { total, rows } = monthlyFixedCosts([
      { amount: "1500000", frequency: "mensual", category: "Alquiler", description: null },
      { amount: "0", frequency: "mensual", category: "Nada", description: null },
    ]);
    expect(total).toBe(1_500_000);
    expect(rows).toHaveLength(1);
  });

  it("sin reglas no hay costos fijos", () => {
    expect(monthlyFixedCosts([])).toEqual({ total: 0, rows: [] });
  });
});

describe("breakEven", () => {
  const base: BreakEvenInput = {
    fixedMonthly: 2_000_000,
    monthRevenue: 3_000_000,
    monthCost: 1_000_000,
    trailingRevenue: 10_000_000,
    trailingCost: 6_000_000,
    dayOfMonth: 15,
    daysInMonth: 30,
  };

  it("el punto de equilibrio es costos fijos / margen de los últimos 90 días", () => {
    const r = breakEven(base);
    expect(r.marginPct).toBeCloseTo(40, 5);
    expect(r.breakEvenRevenue).toBeCloseTo(5_000_000, 5);
  });

  it("si la ganancia del mes ya cubre los costos fijos, está saludable y no falta nada", () => {
    const r = breakEven(base);
    expect(r.monthProfit).toBe(2_000_000);
    expect(r.coveragePct).toBe(100);
    expect(r.remaining).toBe(0);
    expect(r.health).toBe("saludable");
  });

  it("proyecta el mes al ritmo actual y clasifica según cuánto cubre", () => {
    // A mitad de mes con 600.000 de ganancia → proyecta 1.200.000 de 2.000.000 = 60 %.
    const critico = breakEven({ ...base, monthRevenue: 1_500_000, monthCost: 900_000 });
    expect(critico.projectedProfit).toBeCloseTo(1_200_000, 5);
    expect(critico.health).toBe("critico");

    // 1.000.000 a mitad de mes → proyecta 2.000.000: justo cubre.
    const justo = breakEven({ ...base, monthRevenue: 2_000_000, monthCost: 1_000_000 });
    expect(justo.projectedProfit).toBeCloseTo(2_000_000, 5);
    expect(justo.health).toBe("saludable");

    // 800.000 a mitad de mes → proyecta 1.600.000 = 80 %.
    const atencion = breakEven({ ...base, monthRevenue: 1_800_000, monthCost: 1_000_000 });
    expect(atencion.health).toBe("atencion");
    expect(atencion.remaining).toBe(1_200_000);
  });

  it("en los primeros días del mes no proyecta ni juzga", () => {
    const r = breakEven({ ...base, dayOfMonth: 3, monthRevenue: 100_000, monthCost: 50_000 });
    expect(r.projectedProfit).toBeNull();
    expect(r.health).toBe("temprano");
  });

  it("sin costos fijos cargados no hay semáforo ni punto de equilibrio", () => {
    const r = breakEven({ ...base, fixedMonthly: 0 });
    expect(r.health).toBe("sin_costos");
    expect(r.breakEvenRevenue).toBeNull();
  });

  it("sin cobros en los 90 días usa el margen del mes; sin nada de nada no hay margen", () => {
    const delMes = breakEven({ ...base, trailingRevenue: 0, trailingCost: 0 });
    expect(delMes.marginPct).toBeCloseTo((2_000_000 / 3_000_000) * 100, 5);
    const nada = breakEven({ ...base, trailingRevenue: 0, trailingCost: 0, monthRevenue: 0, monthCost: 0 });
    expect(nada.marginPct).toBeNull();
    expect(nada.breakEvenRevenue).toBeNull();
    expect(nada.health).toBe("critico");
  });

  it("un margen cero o negativo no tiene punto de equilibrio", () => {
    const r = breakEven({ ...base, trailingRevenue: 1_000_000, trailingCost: 1_200_000 });
    expect(r.marginPct).toBeLessThan(0);
    expect(r.breakEvenRevenue).toBeNull();
  });
});

describe("aggregateProductSales", () => {
  const sale = (over: Partial<AbcSaleRow>): AbcSaleRow => ({
    inventory_item_id: null,
    product_name: "Funda",
    quantity: 1,
    unit_price: 50_000,
    unit_cost: 20_000,
    created_at: ago(5),
    ...over,
  });

  it("junta las ventas del mismo artículo y calcula facturación y ganancia", () => {
    const rows = aggregateProductSales(
      [sale({ inventory_item_id: "a", quantity: 2 }), sale({ inventory_item_id: "a", product_name: "Funda (renombrada)" }), sale({ inventory_item_id: "b", product_name: "Cable" })],
      null,
      null,
    );
    const a = rows.find((r) => r.key === "a")!;
    expect(a.units).toBe(3);
    expect(a.revenue).toBe(150_000);
    expect(a.profit).toBe(90_000);
    expect(rows).toHaveLength(2);
  });

  it("sin id de artículo agrupa por nombre", () => {
    const rows = aggregateProductSales([sale({}), sale({})], null, null);
    expect(rows).toHaveLength(1);
    expect(rows[0].units).toBe(2);
  });

  it("solo cuenta las ventas dentro del rango", () => {
    const rows = aggregateProductSales([sale({ created_at: ago(40) }), sale({ created_at: ago(2) })], new Date(NOW - 10 * DAY), new Date(NOW));
    expect(rows[0].units).toBe(1);
  });

  it("acepta precios y costos como texto y trata el costo vacío como cero", () => {
    const rows = aggregateProductSales([sale({ unit_price: "30000", unit_cost: null })], null, null);
    expect(rows[0].revenue).toBe(30_000);
    expect(rows[0].profit).toBe(30_000);
  });
});

describe("abcCurve", () => {
  const p = (name: string, revenue: number): AbcProduct => ({ key: name, name, units: 1, revenue, profit: revenue / 2 });

  it("A = los que juntan el 80 % de lo vendido; el que cruza el límite también es A", () => {
    // 50 + 30 = 80 → el segundo llega justo a 80 y ya es A; el tercero empieza en 80 → B.
    const { rows } = abcCurve([p("x", 50), p("y", 30), p("z", 10), p("w", 6), p("v", 4)]);
    expect(rows.map((r) => [r.name, r.klass])).toEqual([
      ["x", "A"],
      ["y", "A"],
      ["z", "B"],
      ["w", "B"],
      ["v", "C"],
    ]);
  });

  it("ordena por facturación y acumula hasta 100 %", () => {
    const { rows, totalRevenue } = abcCurve([p("chico", 10), p("grande", 90)]);
    expect(rows[0].name).toBe("grande");
    expect(rows[0].sharePct).toBeCloseTo(90, 5);
    expect(rows[1].cumulativePct).toBeCloseTo(100, 5);
    expect(totalRevenue).toBe(100);
  });

  it("un producto que supera él solo el 80 % es A y el resto cae a B/C según lo acumulado", () => {
    const { rows } = abcCurve([p("rey", 900), p("b", 60), p("c", 40)]);
    expect(rows.map((r) => r.klass)).toEqual(["A", "B", "C"]);
  });

  it("el resumen reparte productos y facturación por clase", () => {
    const { summary } = abcCurve([p("x", 80), p("y", 15), p("z", 5)]);
    const byClass = Object.fromEntries(summary.map((s) => [s.klass, s]));
    expect(byClass.A.products).toBe(1);
    expect(byClass.A.revenuePct).toBeCloseTo(80, 5);
    expect(byClass.B.revenuePct).toBeCloseTo(15, 5);
    expect(byClass.C.productsPct).toBeCloseTo(100 / 3, 5);
  });

  it("ignora lo que no facturó y no revienta sin datos", () => {
    expect(abcCurve([p("cero", 0)]).rows).toEqual([]);
    const vacio = abcCurve([]);
    expect(vacio.totalRevenue).toBe(0);
    expect(vacio.summary.every((s) => s.products === 0 && s.revenuePct === 0)).toBe(true);
  });
});

const order = (over: Partial<ClientOrderRow> & { id: string }): ClientOrderRow => ({
  client_id: "c1",
  customer_name: "Cliente",
  customer_phone: "595981123456",
  created_at: ago(10),
  status: "entregado",
  quote_amount: 100_000,
  cargos_adicionales: [],
  ...over,
});

describe("clientProfiles", () => {
  it("agrupa por cliente, suma lo entregado (con cargos adicionales) y cuenta visitas", () => {
    const [p] = clientProfiles(
      [
        order({ id: "1", quote_amount: 100_000, cargos_adicionales: [{ monto: 20_000 }] }),
        order({ id: "2", created_at: ago(3), quote_amount: 50_000 }),
        order({ id: "3", created_at: ago(1), status: "en_reparacion", quote_amount: 999_000 }),
      ],
      NOW,
    );
    expect(p.visits).toBe(3);
    expect(p.delivered).toBe(2);
    expect(p.value).toBe(170_000);
    expect(p.hasOpen).toBe(true);
    expect(p.daysSince).toBe(1);
  });

  it("los presupuestos sin convertir no son visitas ni suman plata", () => {
    const profiles = clientProfiles([order({ id: "1", status: "presupuesto" })], NOW);
    expect(profiles).toEqual([]);
  });

  it("una orden retirada sin reparar es una visita pero no deja plata", () => {
    const [p] = clientProfiles([order({ id: "1", status: "retirado_sin_reparar", quote_amount: 80_000 })], NOW);
    expect(p.visits).toBe(1);
    expect(p.delivered).toBe(0);
    expect(p.value).toBe(0);
    expect(p.hasOpen).toBe(false);
  });

  it("sin client_id agrupa por teléfono real, pero un teléfono de relleno no fusiona clientes", () => {
    const profiles = clientProfiles(
      [
        order({ id: "1", client_id: null, customer_phone: "595981777888", customer_name: "Ana" }),
        order({ id: "2", client_id: null, customer_phone: "595981777888", customer_name: "Ana" }),
        order({ id: "3", client_id: null, customer_phone: "000", customer_name: "Uno" }),
        order({ id: "4", client_id: null, customer_phone: "000", customer_name: "Dos" }),
      ],
      NOW,
    );
    expect(profiles).toHaveLength(3);
    expect(profiles.find((p) => p.name === "Ana")!.visits).toBe(2);
  });

  it("toma nombre y teléfono de la orden más reciente", () => {
    const [p] = clientProfiles(
      [order({ id: "1", created_at: ago(30), customer_name: "Nombre viejo" }), order({ id: "2", created_at: ago(2), customer_name: "Nombre nuevo" })],
      NOW,
    );
    expect(p.name).toBe("Nombre nuevo");
    expect(p.daysSince).toBe(2);
  });
});

describe("rfmSegment", () => {
  const seg = (visits: number, daysSince: number, hasOpen = false) => rfmSegment({ visits, daysSince, hasOpen });

  it("recientes: 3 o más visitas son campeones, 2 leales, 1 nuevo", () => {
    expect(seg(5, 10)).toBe("campeones");
    expect(seg(3, 90)).toBe("campeones");
    expect(seg(2, 40)).toBe("leales");
    expect(seg(1, 5)).toBe("nuevos");
  });

  it("entre 91 y 180 días sin volver está en riesgo, más de 180 hibernando — sin importar cuántas visitas tenga", () => {
    expect(seg(5, 91)).toBe("en_riesgo");
    expect(seg(1, 180)).toBe("en_riesgo");
    expect(seg(5, 181)).toBe("hibernando");
  });

  it("con una orden abierta cuenta como reciente aunque haya entrado hace mucho", () => {
    expect(seg(1, 400, true)).toBe("nuevos");
  });
});

describe("rfmGroups", () => {
  it("reparte a los clientes, suma su plata y ordena cada grupo por lo que dejaron", () => {
    const profiles = clientProfiles(
      [
        order({ id: "1", client_id: "campeon", customer_name: "Campeón", created_at: ago(30), quote_amount: 100_000 }),
        order({ id: "2", client_id: "campeon", created_at: ago(20), quote_amount: 100_000 }),
        order({ id: "3", client_id: "campeon", created_at: ago(5), quote_amount: 100_000 }),
        order({ id: "4", client_id: "nuevo1", customer_name: "Nuevo chico", created_at: ago(4), quote_amount: 10_000 }),
        order({ id: "5", client_id: "nuevo2", customer_name: "Nuevo grande", created_at: ago(6), quote_amount: 70_000 }),
        order({ id: "6", client_id: "viejo", customer_name: "Viejo", created_at: ago(300), quote_amount: 40_000 }),
      ],
      NOW,
    );
    const groups = Object.fromEntries(rfmGroups(profiles).map((g) => [g.segment, g]));
    expect(groups.campeones.count).toBe(1);
    expect(groups.campeones.value).toBe(300_000);
    expect(groups.nuevos.clients.map((c) => c.name)).toEqual(["Nuevo grande", "Nuevo chico"]);
    expect(groups.hibernando.count).toBe(1);
    expect(groups.leales.count).toBe(0);
    expect(rfmGroups(profiles).reduce((s, g) => s + g.pct, 0)).toBeCloseTo(100, 5);
  });

  it("sin clientes todos los grupos quedan en cero", () => {
    expect(rfmGroups([]).every((g) => g.count === 0 && g.pct === 0 && g.value === 0)).toBe(true);
  });
});

describe("clientLtv", () => {
  it("promedio por cliente, órdenes por cliente y tasa de retorno", () => {
    const profiles = clientProfiles(
      [
        order({ id: "1", client_id: "a", quote_amount: 100_000 }),
        order({ id: "2", client_id: "a", quote_amount: 200_000 }),
        order({ id: "3", client_id: "b", quote_amount: 100_000 }),
        order({ id: "4", client_id: "c", status: "en_reparacion", quote_amount: 500_000 }),
      ],
      NOW,
    );
    const ltv = clientLtv(profiles)!;
    expect(ltv.clients).toBe(2);
    expect(ltv.totalValue).toBe(400_000);
    expect(ltv.avgValue).toBe(200_000);
    expect(ltv.avgOrders).toBe(1.5);
    expect(ltv.returnRatePct).toBe(50);
    expect(ltv.topClients[0].key).toBe("a");
  });

  it("el 10 % de arriba es al menos un cliente y mide su parte de la facturación", () => {
    const orders = Array.from({ length: 20 }, (_, i) =>
      order({ id: `o${i}`, client_id: `c${i}`, quote_amount: i === 0 ? 800_000 : 10_000 }),
    );
    const ltv = clientLtv(clientProfiles(orders, NOW))!;
    expect(ltv.topTenCount).toBe(2);
    expect(ltv.topTenSharePct).toBeCloseTo(((800_000 + 10_000) / (800_000 + 19 * 10_000)) * 100, 5);
    expect(clientLtv(clientProfiles([order({ id: "x" })], NOW))!.topTenCount).toBe(1);
  });

  it("sin clientes que hayan pagado no hay LTV", () => {
    expect(clientLtv([])).toBeNull();
    expect(clientLtv(clientProfiles([order({ id: "1", status: "en_reparacion" })], NOW))).toBeNull();
  });

  it("limita la lista de mejores clientes", () => {
    const orders = Array.from({ length: 8 }, (_, i) => order({ id: `o${i}`, client_id: `c${i}`, quote_amount: 1_000 * (i + 1) }));
    const ltv = clientLtv(clientProfiles(orders, NOW), 3)!;
    expect(ltv.topClients).toHaveLength(3);
    expect(ltv.topClients[0].value).toBe(8_000);
  });
});
