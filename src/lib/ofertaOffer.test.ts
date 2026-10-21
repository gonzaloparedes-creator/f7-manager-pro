import { describe, expect, it } from "vitest";
import { OFFER_DEADLINE, formatDeadline, offerStatus } from "./ofertaOffer";

const DEADLINE = "2026-10-31T23:59:59-03:00";

describe("offerStatus", () => {
  it("está activa antes de la fecha límite y cuenta los días que quedan", () => {
    const s = offerStatus(new Date("2026-10-20T13:00:00Z"), DEADLINE);
    expect(s.active).toBe(true);
    if (s.active) {
      expect(s.daysLeft).toBe(12);
      expect(s.urgencyText).toBe("Quedan 12 días");
      expect(s.lastDay).toBe(false);
    }
  });

  it("con más de 24 horas por delante todavía no es el último día", () => {
    const s = offerStatus(new Date("2026-10-30T12:00:00-03:00"), DEADLINE);
    expect(s.active).toBe(true);
    if (s.active) {
      expect(s.lastDay).toBe(false);
      expect(s.daysLeft).toBe(2);
      expect(s.urgencyText).toBe("Quedan 2 días");
    }
  });

  it("el último día avisa que termina hoy", () => {
    const s = offerStatus(new Date("2026-10-31T09:00:00-03:00"), DEADLINE);
    expect(s.active).toBe(true);
    if (s.active) {
      expect(s.lastDay).toBe(true);
      expect(s.urgencyText).toBe("Termina hoy");
    }
  });

  it("queda activa hasta el último segundo y se apaga después", () => {
    expect(offerStatus(new Date("2026-10-31T23:59:58-03:00"), DEADLINE).active).toBe(true);
    expect(offerStatus(new Date("2026-10-31T23:59:59-03:00"), DEADLINE).active).toBe(false);
    expect(offerStatus(new Date("2026-11-01T00:00:00-03:00"), DEADLINE).active).toBe(false);
  });

  it("una fecha ilegible apaga la oferta en vez de mostrar urgencia falsa", () => {
    expect(offerStatus(new Date("2026-10-20T12:00:00Z"), "no-es-una-fecha").active).toBe(false);
  });

  it("la fecha límite vigente es una fecha válida", () => {
    expect(Number.isFinite(new Date(OFFER_DEADLINE).getTime())).toBe(true);
  });
});

describe("formatDeadline", () => {
  it("muestra el día y el mes en hora de Paraguay", () => {
    const label = formatDeadline(DEADLINE);
    expect(label).toContain("31");
    expect(label.toLowerCase()).toContain("octubre");
  });

  it("no corre el día por la zona horaria (23:59 en Paraguay sigue siendo ese día)", () => {
    expect(formatDeadline("2026-10-31T23:59:59-03:00")).toContain("31");
  });
});
