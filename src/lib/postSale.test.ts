import { describe, expect, it } from "vitest";
import {
  birthdayDue,
  formatDMY,
  isReviewDue,
  isWarrantyDue,
  joinDistinct,
  lastBirthday,
  pickBirthdays,
  pickReviewGroups,
  pickWarrantyGroups,
  postSaleActive,
  warrantyDaysLeft,
  warrantyExpiryDate,
  type DeliveredOrder,
  type PostSaleLogRow,
} from "./postSale";

// Todo en hora local para que los tests no dependan de la zona del equipo.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const iso = (date: Date) => date.toISOString();
const NOW = at(2026, 10, 14);

const order = (id: string, deliveredDaysAgo: number, phone = "595981111111", warrantyDays = 30): DeliveredOrder => ({
  orderId: id,
  deliveredAt: iso(new Date(NOW.getTime() - deliveredDaysAgo * 86_400_000)),
  phone,
  warrantyDays,
});

const log = (over: Partial<PostSaleLogRow>): PostSaleLogRow => ({
  order_id: null,
  client_id: null,
  event_key: "postventa_resena",
  action: "opened",
  phone: null,
  created_at: iso(NOW),
  ...over,
});

describe("ventana de reseñas", () => {
  it("aparece entre los 3 y los 7 días de la entrega", () => {
    const due = (days: number) => isReviewDue(order("x", days).deliveredAt, NOW);
    expect(due(2)).toBe(false);
    expect(due(3)).toBe(true);
    expect(due(7)).toBe(true);
    expect(due(8)).toBe(false);
  });
});

describe("garantías por vencer", () => {
  it("avisa los últimos 3 días antes del vencimiento, inclusive el último", () => {
    const due = (days: number, wd = 30) => isWarrantyDue(order("x", days, "595981111111", wd).deliveredAt, wd, NOW);
    expect(due(26)).toBe(false); // le quedan 4
    expect(due(27)).toBe(true); // le quedan 3
    expect(due(30)).toBe(true); // vence hoy
    expect(due(31)).toBe(false); // ya venció
  });

  it("no avisa si la orden no tiene garantía", () => {
    expect(warrantyDaysLeft(order("x", 5).deliveredAt, 0, NOW)).toBeNull();
    expect(isWarrantyDue(order("x", 5).deliveredAt, 0, NOW)).toBe(false);
    expect(isWarrantyDue(order("x", 5).deliveredAt, null, NOW)).toBe(false);
  });

  it("coincide con los días restantes que muestra la etiqueta de la orden", () => {
    expect(warrantyDaysLeft(order("x", 28).deliveredAt, 30, NOW)).toBe(2);
  });

  it("calcula la fecha de vencimiento", () => {
    const expiry = warrantyExpiryDate(iso(at(2026, 10, 1)), 30);
    expect(formatDMY(expiry)).toBe("31/10/2026");
  });
});

describe("cumpleaños", () => {
  it("es hoy, y se tolera hasta 2 días de atraso", () => {
    expect(lastBirthday("1990-10-14", NOW)?.daysAgo).toBe(0);
    expect(birthdayDue("1990-10-12", NOW)?.daysAgo).toBe(2);
    expect(birthdayDue("1990-10-11", NOW)).toBeNull();
    expect(birthdayDue("1990-10-15", NOW)).toBeNull(); // todavía no llegó
  });

  it("cruza el fin de año (cumple 31/12 visto el 1/1)", () => {
    const occ = birthdayDue("1985-12-31", at(2027, 1, 1));
    expect(occ?.daysAgo).toBe(1);
    expect(occ?.start.getFullYear()).toBe(2026);
  });

  it("el 29/02 se celebra el 28/02 en años no bisiestos", () => {
    expect(birthdayDue("2000-02-29", at(2027, 2, 28))?.daysAgo).toBe(0);
    expect(birthdayDue("2000-02-29", at(2028, 2, 29))?.daysAgo).toBe(0);
    expect(birthdayDue("2000-02-29", at(2028, 2, 28))).toBeNull();
  });

  it("ignora fechas inválidas", () => {
    expect(lastBirthday("", NOW)).toBeNull();
    expect(lastBirthday("1990-13-40", NOW)).toBeNull();
  });
});

describe("pickReviewGroups", () => {
  it("devuelve solo lo que está dentro de la ventana", () => {
    const groups = pickReviewGroups([order("a", 1), order("b", 4, "595982222222"), order("c", 9)], [], NOW);
    expect(groups.map((g) => g.primary.orderId)).toEqual(["b"]);
  });

  it("no repite una orden ya atendida (abierta, copiada o descartada)", () => {
    const orders = [order("a", 4, "595981111111"), order("b", 4, "595982222222"), order("c", 4, "595983333333")];
    const groups = pickReviewGroups(
      orders,
      [
        log({ order_id: "a", action: "opened" }),
        log({ order_id: "b", action: "dismissed" }),
        log({ order_id: "x", event_key: "postventa_garantia" }),
      ],
      NOW
    );
    expect(groups.map((g) => g.primary.orderId)).toEqual(["c"]);
  });

  it("agrupa por teléfono: un lote es un solo pedido de reseña", () => {
    const groups = pickReviewGroups(
      [order("a", 4, "595981111111"), order("b", 5, "595981111111"), order("c", 4, "595982222222")],
      [],
      NOW
    );
    expect(groups).toHaveLength(2);
    const batch = groups.find((g) => g.orders.length === 2);
    expect(batch?.primary.orderId).toBe("a");
    expect(batch?.orders.map((o) => o.orderId)).toEqual(["a", "b"]);
  });

  it("no vuelve a pedir reseña al mismo teléfono dentro de los 30 días", () => {
    const asked = log({
      order_id: "old",
      phone: "595981111111",
      created_at: iso(new Date(NOW.getTime() - 10 * 86_400_000)),
    });
    const groups = pickReviewGroups([order("a", 4, "595981111111"), order("b", 4, "595982222222")], [asked], NOW);
    expect(groups.map((g) => g.primary.orderId)).toEqual(["b"]);
  });

  it("un pedido descartado no frena a las demás órdenes del mismo teléfono", () => {
    const dismissed = log({ order_id: "old", phone: "595981111111", action: "dismissed" });
    const groups = pickReviewGroups([order("a", 4, "595981111111")], [dismissed], NOW);
    expect(groups).toHaveLength(1);
  });

  it("pasados los 30 días se puede volver a pedir", () => {
    const asked = log({
      order_id: "old",
      phone: "595981111111",
      created_at: iso(new Date(NOW.getTime() - 31 * 86_400_000)),
    });
    expect(pickReviewGroups([order("a", 4, "595981111111")], [asked], NOW)).toHaveLength(1);
  });
});

describe("pickWarrantyGroups", () => {
  it("lista las garantías por vencer y respeta las ya atendidas", () => {
    const orders = [order("a", 28), order("b", 10), order("c", 29, "595982222222")];
    const groups = pickWarrantyGroups(orders, [log({ order_id: "c", event_key: "postventa_garantia" })], NOW);
    expect(groups.map((g) => g.primary.orderId)).toEqual(["a"]);
  });

  it("junta las que vencen el mismo día para el mismo teléfono, no las de otro día", () => {
    const orders = [
      order("a", 28, "595981111111"),
      order("b", 28, "595981111111"),
      order("c", 29, "595981111111"),
    ];
    const groups = pickWarrantyGroups(orders, [], NOW);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.orders.length === 2)?.orders.map((o) => o.orderId).sort()).toEqual(["a", "b"]);
  });

  it("la reseña ya atendida no marca como atendida la garantía de la misma orden", () => {
    const groups = pickWarrantyGroups([order("a", 28)], [log({ order_id: "a", event_key: "postventa_resena" })], NOW);
    expect(groups).toHaveLength(1);
  });
});

describe("pickBirthdays", () => {
  const clients = [
    { id: "c1", birthDate: "1990-10-14" },
    { id: "c2", birthDate: "1988-10-13" },
    { id: "c3", birthDate: "1975-03-02" },
  ];

  it("trae a quienes cumplen hoy o hace hasta 2 días", () => {
    expect(pickBirthdays(clients, [], NOW).map((b) => b.client.id)).toEqual(["c1", "c2"]);
  });

  it("no repite a quien ya se saludó este cumpleaños", () => {
    const greeted = log({ client_id: "c1", event_key: "postventa_cumple", created_at: iso(at(2026, 10, 14, 9)) });
    expect(pickBirthdays(clients, [greeted], NOW).map((b) => b.client.id)).toEqual(["c2"]);
  });

  it("un saludo del año pasado no cuenta como atendido", () => {
    const lastYear = log({ client_id: "c1", event_key: "postventa_cumple", created_at: iso(at(2025, 10, 14, 9)) });
    expect(pickBirthdays(clients, [lastYear], NOW).map((b) => b.client.id)).toContain("c1");
  });
});

describe("postSaleActive", () => {
  const base = { review: false, warranty: false, birthday: false, reviewUrl: null };
  it("está inactivo con todo apagado", () => {
    expect(postSaleActive(base)).toBe(false);
  });
  it("reseñas prendidas sin link no cuentan como activas", () => {
    expect(postSaleActive({ ...base, review: true })).toBe(false);
    expect(postSaleActive({ ...base, review: true, reviewUrl: "  " })).toBe(false);
    expect(postSaleActive({ ...base, review: true, reviewUrl: "https://g.page/r/abc" })).toBe(true);
  });
  it("garantías o cumpleaños alcanzan solos", () => {
    expect(postSaleActive({ ...base, warranty: true })).toBe(true);
    expect(postSaleActive({ ...base, birthday: true })).toBe(true);
  });
});

describe("joinDistinct", () => {
  it("une sin repetir", () => {
    expect(joinDistinct(["Celular"])).toBe("Celular");
    expect(joinDistinct(["Celular", "Celular"])).toBe("Celular");
    expect(joinDistinct(["Celular", "Notebook"])).toBe("Celular y Notebook");
    expect(joinDistinct(["Celular", "Notebook", "Tablet"])).toBe("Celular, Notebook y Tablet");
  });
});
