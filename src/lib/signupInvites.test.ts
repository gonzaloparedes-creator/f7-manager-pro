import { describe, expect, it } from "vitest";
import { guaranteeEndsAt, inviteStatus, inviteUrl, inviteWhatsAppMessage } from "./signupInvites";

const base = { used_at: null, revoked_at: null, plan_expires_at: "2026-12-03" };

describe("links de alta pagada", () => {
  it("arma el link de un solo uso", () => {
    expect(inviteUrl("AB12CD34EF", "https://f7manager.com")).toBe("https://f7manager.com/empezar/AB12CD34EF");
  });

  it("la garantía son 7 días contando el día del pago", () => {
    expect(guaranteeEndsAt("2026-11-04")).toBe("2026-11-10");
    expect(guaranteeEndsAt("2026-11-28")).toBe("2026-12-04");
  });

  it("estado: usado y anulado mandan sobre el vencimiento", () => {
    expect(inviteStatus(base, "2026-11-04")).toBe("pending");
    expect(inviteStatus({ ...base, used_at: "2026-11-05T10:00:00Z" }, "2026-11-04")).toBe("used");
    expect(inviteStatus({ ...base, revoked_at: "2026-11-05T10:00:00Z" }, "2026-11-04")).toBe("revoked");
    expect(inviteStatus(base, "2026-12-04")).toBe("expired");
    expect(inviteStatus(base, "2026-12-03")).toBe("pending");
  });

  it("el mensaje de WhatsApp trae el plan, el link, el vencimiento y la garantía, sin prometer nada automático", () => {
    const msg = inviteWhatsAppMessage(
      { code: "AB12CD34EF", plan_type: "pro", billing_cycle: "mensual", plan_paid_from: "2026-11-04", plan_expires_at: "2026-12-03" },
      "https://f7manager.com",
    );
    expect(msg).toContain("Plan Pro mensual");
    expect(msg).toContain("https://f7manager.com/empezar/AB12CD34EF");
    expect(msg).toContain("activo hasta el 03/12/2026");
    expect(msg).toContain("garantía hasta el 10/11/2026");
    expect(msg).not.toMatch(/autom[aá]ti/i);
  });
});
