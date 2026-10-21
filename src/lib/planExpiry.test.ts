import { describe, expect, it } from "vitest";
import {
  diffDaysISO,
  expiryHeadline,
  expirySortKey,
  expiryTone,
  matchesExpiryFilter,
  planExpiryInfo,
  renewalStart,
  suggestedExpiry,
  timeSinceLabel,
} from "./planExpiry";

const row = (from: string | null, to: string | null, cycle: string | null = "mensual") => ({
  billing_cycle: cycle,
  plan_paid_from: from,
  plan_expires_at: to,
});

describe("diffDaysISO", () => {
  it("cuenta días de calendario", () => {
    expect(diffDaysISO("2026-10-21", "2026-10-21")).toBe(0);
    expect(diffDaysISO("2026-10-21", "2026-10-31")).toBe(10);
    expect(diffDaysISO("2026-10-31", "2026-10-21")).toBe(-10);
  });
  it("cruza meses y años bisiestos", () => {
    expect(diffDaysISO("2028-02-28", "2028-03-01")).toBe(2);
    expect(diffDaysISO("2026-12-31", "2027-01-01")).toBe(1);
  });
});

describe("expiryHeadline / expiryTone", () => {
  it("redacta el texto según los días", () => {
    expect(expiryHeadline(23)).toBe("Quedan 23 días");
    expect(expiryHeadline(2)).toBe("Quedan 2 días");
    expect(expiryHeadline(1)).toBe("Queda 1 día");
    expect(expiryHeadline(0)).toBe("Vence hoy");
    expect(expiryHeadline(-1)).toBe("Venció ayer");
    expect(expiryHeadline(-5)).toBe("Venció hace 5 días");
  });
  it("pasa a naranja a los 7 días y a rojo al vencer", () => {
    expect(expiryTone(30)).toBe("ok");
    expect(expiryTone(8)).toBe("ok");
    expect(expiryTone(7)).toBe("soon");
    expect(expiryTone(0)).toBe("soon");
    expect(expiryTone(-1)).toBe("expired");
  });
});

describe("planExpiryInfo", () => {
  it("devuelve null sin pago registrado o con datos inválidos", () => {
    expect(planExpiryInfo(row(null, null, null), "2026-10-21")).toBeNull();
    expect(planExpiryInfo(row("2026-10-21", null), "2026-10-21")).toBeNull();
    expect(planExpiryInfo(row("2026-10-21", "2026-11-20", "quincenal"), "2026-10-21")).toBeNull();
    expect(planExpiryInfo(row("2026-13-40", "2026-11-20"), "2026-10-21")).toBeNull();
    expect(planExpiryInfo(row("2026-11-20", "2026-10-21"), "2026-10-21")).toBeNull();
  });

  it("el primer día del período la barra está llena", () => {
    const info = planExpiryInfo(row("2026-10-21", "2026-11-20"), "2026-10-21")!;
    expect(info.totalDays).toBe(31);
    expect(info.daysLeft).toBe(30);
    expect(info.remainingPct).toBe(100);
    expect(info.tone).toBe("ok");
    expect(info.headline).toBe("Quedan 30 días");
  });

  it("a mitad de período queda cerca de la mitad", () => {
    const info = planExpiryInfo(row("2026-10-01", "2026-10-30"), "2026-10-15")!;
    expect(info.totalDays).toBe(30);
    expect(info.daysLeft).toBe(15);
    expect(info.remainingPct).toBe(53);
  });

  it("el último día cubierto vence hoy y todavía no está vencido", () => {
    const info = planExpiryInfo(row("2026-10-01", "2026-10-30"), "2026-10-30")!;
    expect(info.daysLeft).toBe(0);
    expect(info.tone).toBe("soon");
    expect(info.headline).toBe("Vence hoy");
    expect(info.remainingPct).toBeGreaterThan(0);
  });

  it("al día siguiente está vencido y la barra queda vacía", () => {
    const info = planExpiryInfo(row("2026-10-01", "2026-10-30"), "2026-11-02")!;
    expect(info.daysLeft).toBe(-3);
    expect(info.tone).toBe("expired");
    expect(info.headline).toBe("Venció hace 3 días");
    expect(info.remainingPct).toBe(0);
  });

  it("un período que empieza en el futuro (renovación a continuación) no pasa del 100 %", () => {
    const info = planExpiryInfo(row("2026-11-21", "2026-12-20"), "2026-10-21")!;
    expect(info.remainingPct).toBe(100);
    expect(info.daysLeft).toBe(60);
    expect(info.tone).toBe("ok");
  });

  it("acepta timestamps y se queda con la fecha", () => {
    const info = planExpiryInfo(row("2026-10-21T00:00:00+00:00", "2026-11-20"), "2026-10-21")!;
    expect(info.paidFrom).toBe("2026-10-21");
  });
});

describe("suggestedExpiry / renewalStart", () => {
  it("vence el día anterior a la renovación", () => {
    expect(suggestedExpiry("2026-10-21", "mensual")).toBe("2026-11-20");
    expect(suggestedExpiry("2026-10-21", "semestral")).toBe("2027-04-20");
    expect(suggestedExpiry("2026-10-21", "anual")).toBe("2027-10-20");
  });
  it("31 de enero mensual no se pasa a marzo", () => {
    expect(suggestedExpiry("2026-01-31", "mensual")).toBe("2026-02-27");
  });
  it("renovar a continuación arranca el día después del vencimiento", () => {
    expect(renewalStart("2026-11-20", "2026-10-21")).toBe("2026-11-21");
    expect(renewalStart("2026-10-21", "2026-10-21")).toBe("2026-10-22");
  });
  it("si ya venció o no hay período, arranca hoy", () => {
    expect(renewalStart("2026-10-01", "2026-10-21")).toBe("2026-10-21");
    expect(renewalStart(null, "2026-10-21")).toBe("2026-10-21");
    expect(renewalStart("basura", "2026-10-21")).toBe("2026-10-21");
  });
});

describe("timeSinceLabel", () => {
  const today = "2026-10-21";
  it("redacta la antigüedad", () => {
    expect(timeSinceLabel("2026-10-21", today)).toBe("Hoy");
    expect(timeSinceLabel("2026-10-20", today)).toBe("Ayer");
    expect(timeSinceLabel("2026-10-09", today)).toBe("Hace 12 días");
    expect(timeSinceLabel("2026-07-21", today)).toBe("Hace 3 meses");
    expect(timeSinceLabel("2025-08-21", today)).toBe("Hace 1 año y 2 meses");
    expect(timeSinceLabel("2024-10-21", today)).toBe("Hace 2 años");
  });
  it("una fecha futura se lee como hoy", () => {
    expect(timeSinceLabel("2026-10-30", today)).toBe("Hoy");
  });
});

describe("filtros y orden", () => {
  const ok = planExpiryInfo(row("2026-10-21", "2026-11-20"), "2026-10-21");
  const soon = planExpiryInfo(row("2026-10-01", "2026-10-25"), "2026-10-21");
  const expired = planExpiryInfo(row("2026-09-01", "2026-09-30"), "2026-10-21");

  it("cada filtro deja pasar solo lo suyo", () => {
    expect(matchesExpiryFilter(ok, "al-dia")).toBe(true);
    expect(matchesExpiryFilter(soon, "por-vencer")).toBe(true);
    expect(matchesExpiryFilter(expired, "vencidas")).toBe(true);
    expect(matchesExpiryFilter(null, "sin-pago")).toBe(true);
    expect(matchesExpiryFilter(ok, "vencidas")).toBe(false);
    expect(matchesExpiryFilter(null, "al-dia")).toBe(false);
    expect(matchesExpiryFilter(null, "todas")).toBe(true);
  });

  it("ordena lo más urgente primero y sin pago al final", () => {
    const keys = [ok, null, expired, soon].map(expirySortKey);
    const sorted = [...keys].sort((a, b) => a - b);
    expect(sorted[0]).toBe(expirySortKey(expired));
    expect(sorted[1]).toBe(expirySortKey(soon));
    expect(sorted[2]).toBe(expirySortKey(ok));
    expect(sorted[3]).toBe(Number.POSITIVE_INFINITY);
  });
});
