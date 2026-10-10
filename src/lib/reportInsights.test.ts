import { describe, it, expect } from "vitest";
import {
  buildCountSheetHtml,
  findIdleStock,
  findReorder,
  formatDaysAmount,
  lapsedClients,
  onTimeDelivery,
  stageDurations,
  topServices,
  type OrderInsightRow,
  type StockItem,
} from "./reportInsights";

const DAY = 86_400_000;
const NOW = new Date("2026-10-10T15:00:00").getTime();
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

const item = (over: Partial<StockItem> & { id: string }): StockItem => ({
  name: over.id,
  stock: 5,
  min_stock_alert: 2,
  cost_price: 10_000,
  created_at: ago(400),
  branch_id: null,
  category_id: null,
  ...over,
});

const order = (over: Partial<OrderInsightRow> & { id: string }): OrderInsightRow => ({
  client_id: null,
  customer_name: "Cliente",
  customer_phone: "595981000000",
  created_at: ago(10),
  status: "entregado",
  problems: [],
  quote_amount: 0,
  cargos_adicionales: [],
  estimated_delivery_date: null,
  delivered_at: null,
  ...over,
});

describe("findIdleStock", () => {
  it("cuenta el stock cuyo último movimiento es anterior al corte y suma su valor", () => {
    const items = [
      item({ id: "viejo", stock: 3, cost_price: 20_000 }),
      item({ id: "usado-ayer", stock: 9 }),
      item({ id: "nuevo", created_at: ago(5) }),
      item({ id: "sin-stock", stock: 0 }),
    ];
    const used = new Map([["usado-ayer", NOW - DAY]]);
    const { rows, totalValue } = findIdleStock(items, used, 60, 365, NOW);
    expect(rows.map((r) => r.id)).toEqual(["viejo"]);
    expect(totalValue).toBe(60_000);
  });

  it("usa la última salida (no la fecha de carga) para contar los días sin movimiento", () => {
    const used = new Map([["a", NOW - 100 * DAY]]);
    const { rows } = findIdleStock([item({ id: "a" })], used, 60, 365, NOW);
    expect(rows[0].idleDays).toBe(100);
    expect(rows[0].idleDaysIsMinimum).toBe(false);
  });

  it("marca como mínimo los días de un artículo viejo que nunca salió dentro del historial consultado", () => {
    const { rows } = findIdleStock([item({ id: "a", created_at: ago(800) })], new Map(), 60, 365, NOW);
    expect(rows[0].idleDaysIsMinimum).toBe(true);
  });

  it("ordena por valor parado, de mayor a menor", () => {
    const items = [
      item({ id: "chico", stock: 1, cost_price: 1_000 }),
      item({ id: "grande", stock: 10, cost_price: 50_000 }),
    ];
    expect(findIdleStock(items, new Map(), 60, 365, NOW).rows.map((r) => r.id)).toEqual(["grande", "chico"]);
  });
});

describe("findReorder", () => {
  it("incluye stock igual o menor al mínimo y deja primero los agotados", () => {
    const rows = findReorder([
      item({ id: "ok", stock: 10, min_stock_alert: 2 }),
      item({ id: "justo", stock: 2, min_stock_alert: 2 }),
      item({ id: "agotado", stock: 0, min_stock_alert: 3 }),
    ]);
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ["agotado", "agotado"],
      ["justo", "bajo"],
    ]);
  });
});

describe("topServices", () => {
  const from = new Date(NOW - 30 * DAY);
  const to = new Date(NOW);

  it("cuenta cada problema una vez por orden y promedia el ticket de las órdenes con precio", () => {
    const rows = topServices(
      [
        order({ id: "1", problems: ["Pantalla", "Batería"], quote_amount: 100_000 }),
        order({ id: "2", problems: ["Pantalla", "Pantalla"], quote_amount: 200_000, cargos_adicionales: [{ monto: 50_000 }] }),
        order({ id: "3", problems: ["Batería"], quote_amount: 0 }),
      ],
      from,
      to,
    );
    expect(rows).toEqual([
      { name: "Batería", count: 2, avgTicket: 100_000 },
      { name: "Pantalla", count: 2, avgTicket: 175_000 },
    ]);
  });

  it("ignora presupuestos y órdenes fuera del rango", () => {
    const rows = topServices(
      [
        order({ id: "1", problems: ["Pantalla"], status: "presupuesto" }),
        order({ id: "2", problems: ["Pantalla"], created_at: ago(90) }),
      ],
      from,
      to,
    );
    expect(rows).toEqual([]);
  });
});

describe("onTimeDelivery", () => {
  const from = new Date(NOW - 30 * DAY);
  const to = new Date(NOW);

  it("compara el día de entrega contra el día prometido", () => {
    const r = onTimeDelivery(
      [
        order({ id: "a", delivered_at: "2026-10-05T12:00:00", estimated_delivery_date: "2026-10-05" }),
        order({ id: "b", delivered_at: "2026-10-03T12:00:00", estimated_delivery_date: "2026-10-05" }),
        order({ id: "c", delivered_at: "2026-10-08T12:00:00", estimated_delivery_date: "2026-10-05" }),
        order({ id: "d", delivered_at: "2026-10-08T12:00:00", estimated_delivery_date: "2026-10-04" }),
        order({ id: "e", delivered_at: "2026-10-08T12:00:00", estimated_delivery_date: null }),
      ],
      from,
      to,
    );
    expect(r).toMatchObject({ withDate: 4, onTime: 2, late: 2, withoutDate: 1, pct: 50 });
    expect(r.avgLateDays).toBe(3.5);
  });

  it("no calcula porcentaje si ninguna entrega tenía fecha prometida", () => {
    const r = onTimeDelivery([order({ id: "a", delivered_at: "2026-10-05T12:00:00" })], from, to);
    expect(r.pct).toBeNull();
    expect(r.withoutDate).toBe(1);
  });

  it("solo cuenta órdenes entregadas dentro del rango", () => {
    const r = onTimeDelivery(
      [
        order({ id: "a", status: "en_reparacion", delivered_at: "2026-10-05T12:00:00", estimated_delivery_date: "2026-10-05" }),
        order({ id: "b", delivered_at: "2026-01-05T12:00:00", estimated_delivery_date: "2026-01-05" }),
      ],
      from,
      to,
    );
    expect(r.withDate).toBe(0);
  });
});

describe("stageDurations", () => {
  const h = (order_id: string, status: string, days: number) => ({ order_id, status, created_at: ago(days) });

  it("promedia el tiempo en cada etapa y no cuenta la etapa actual de la orden", () => {
    const stats = stageDurations([
      h("1", "recibido", 10),
      h("1", "en_reparacion", 8),
      h("1", "entregado", 4),
      h("2", "recibido", 6),
      h("2", "en_reparacion", 2),
    ]);
    const get = (s: string) => stats.find((x) => x.status === s);
    expect(get("recibido")).toMatchObject({ orders: 2, avgDays: 3 });
    expect(get("en_reparacion")).toMatchObject({ orders: 2, avgDays: 4 });
    expect(get("entregado")).toMatchObject({ orders: 1, avgDays: null });
  });

  it("las notas que repiten el estado no cortan la etapa", () => {
    const stats = stageDurations([
      h("1", "recibido", 10),
      h("1", "recibido", 9),
      h("1", "en_reparacion", 6),
    ]);
    expect(stats.find((s) => s.status === "recibido")).toMatchObject({ orders: 1, avgDays: 4 });
  });

  it("ordena las etapas según el flujo de una orden", () => {
    const stats = stageDurations([h("1", "listo", 3), h("1", "recibido", 9), h("1", "en_diagnostico", 7), h("1", "en_reparacion", 5)]);
    expect(stats.map((s) => s.status)).toEqual(["recibido", "en_diagnostico", "en_reparacion", "listo"]);
  });
});

describe("lapsedClients", () => {
  it("lista clientes cuya última orden tiene más de 90 días y no tienen órdenes abiertas", () => {
    const rows = lapsedClients(
      [
        order({ id: "1", client_id: "c1", customer_name: "Ana", created_at: ago(200) }),
        order({ id: "2", client_id: "c1", customer_name: "Ana", created_at: ago(120) }),
        order({ id: "3", client_id: "c2", customer_name: "Beto", created_at: ago(30) }),
        order({ id: "4", client_id: "c3", customer_name: "Cami", created_at: ago(150), status: "en_reparacion" }),
        order({ id: "5", client_id: "c4", customer_name: "Dani", created_at: ago(150), status: "presupuesto" }),
      ],
      90,
      NOW,
    );
    expect(rows.map((r) => [r.name, r.daysSince, r.orders])).toEqual([["Ana", 120, 2]]);
  });

  it("ordena del que se fue hace menos tiempo al que se fue hace más", () => {
    const rows = lapsedClients(
      [
        order({ id: "1", client_id: "c1", customer_name: "Viejo", created_at: ago(300) }),
        order({ id: "2", client_id: "c2", customer_name: "Reciente", created_at: ago(100) }),
      ],
      90,
      NOW,
    );
    expect(rows.map((r) => r.name)).toEqual(["Reciente", "Viejo"]);
  });
});

describe("buildCountSheetHtml", () => {
  it("escapa el texto de los artículos", () => {
    const html = buildCountSheetHtml({
      title: "Hoja",
      subtitle: "sub",
      showBranch: false,
      rows: [{ name: "<script>alert(1)</script>", category: "A & B", branch: null, stock: 4 }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("A &amp; B");
  });
});

describe("formatDaysAmount", () => {
  it("usa horas para menos de un día y días con coma decimal", () => {
    expect(formatDaysAmount(0.5)).toBe("12 h");
    expect(formatDaysAmount(1)).toBe("1 día");
    expect(formatDaysAmount(2.5)).toBe("2,5 días");
    expect(formatDaysAmount(3)).toBe("3 días");
  });
});
