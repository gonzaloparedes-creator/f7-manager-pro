import { describe, expect, it } from "vitest";
import {
  buildFollowupMessage,
  buildFollowupQueue,
  CONTACT_COOLDOWN_DAYS,
  daysPhrase,
  firstName,
  followupSituation,
  followupTemplate,
  renderFollowupTemplate,
  SITUATION_GROUP,
  SITUATION_LABELS,
  wasContactedRecently,
  type FollowupCompany,
  type FollowupSituation,
} from "./followup";
import { companyExpiryInfo } from "./planExpiry";

const TODAY = "2026-10-21";

const paid = (expiresAt: string) => ({
  billing_cycle: "mensual",
  plan_paid_from: "2026-09-01",
  plan_expires_at: expiresAt,
});

const trialRow = (endsAt: string, createdAt: string) => ({
  billing_cycle: null,
  plan_paid_from: null,
  plan_expires_at: null,
  trial_ends_at: endsAt,
  created_at: createdAt,
});

const company = (over: Partial<FollowupCompany> = {}): FollowupCompany => ({
  id: "c1",
  name: "Taller Norte",
  plan_type: "pro",
  is_active: true,
  admin_name: "Marcos Díaz",
  admin_phone: "0981 123 456",
  ...over,
});

const situationOf = (row: Parameters<typeof companyExpiryInfo>[0], c: Partial<FollowupCompany> = {}) =>
  followupSituation(company(c), companyExpiryInfo(row, TODAY), TODAY);

describe("followupSituation: cobros", () => {
  it("un plan al día no necesita mensaje", () => {
    expect(situationOf(paid("2026-11-20"))).toBeNull();
    expect(situationOf(paid("2026-10-29"))).toBeNull();
  });
  it("a 7 días o menos se avisa que está por vencer", () => {
    expect(situationOf(paid("2026-10-28"))).toBe("cobro-por-vencer");
    expect(situationOf(paid("2026-10-22"))).toBe("cobro-por-vencer");
  });
  it("el día del vencimiento tiene su propio mensaje", () => {
    expect(situationOf(paid("2026-10-21"))).toBe("cobro-hoy");
  });
  it("vencido dentro de la gracia", () => {
    expect(situationOf(paid("2026-10-20"))).toBe("cobro-gracia");
    expect(situationOf(paid("2026-10-18"))).toBe("cobro-gracia");
  });
  it("vencido y pasada la gracia", () => {
    expect(situationOf(paid("2026-10-17"))).toBe("cobro-suspendida");
  });
});

describe("followupSituation: pruebas gratis", () => {
  it("una prueba recién empezada no se molesta", () => {
    expect(situationOf(trialRow("2026-11-03", "2026-10-21"))).toBeNull();
    expect(situationOf(trialRow("2026-11-01", "2026-10-19"))).toBeNull();
  });
  it("a partir del día 4 se le pregunta qué le parece", () => {
    expect(situationOf(trialRow("2026-11-03", "2026-10-18"))).toBe("prueba-en-curso");
    expect(situationOf(trialRow("2026-11-03", "2026-10-10"))).toBe("prueba-en-curso");
  });
  it("en sus últimos 3 días está por terminar", () => {
    expect(situationOf(trialRow("2026-10-24", "2026-10-11"))).toBe("prueba-por-terminar");
    expect(situationOf(trialRow("2026-10-21", "2026-10-08"))).toBe("prueba-por-terminar");
  });
  it("terminada: en gracia o suspendida", () => {
    expect(situationOf(trialRow("2026-10-19", "2026-10-06"))).toBe("prueba-gracia");
    expect(situationOf(trialRow("2026-10-10", "2026-09-27"))).toBe("prueba-suspendida");
  });
  it("una prueba cuyo alta es hoy pero termina pronto igual avisa (dato manual)", () => {
    expect(situationOf(trialRow("2026-10-22", "2026-10-21"))).toBe("prueba-por-terminar");
  });
});

describe("followupSituation: exclusiones", () => {
  it("sin fechas no hay nada que decir", () => {
    expect(followupSituation(company(), null, TODAY)).toBeNull();
  });
  it("una cuenta suspendida a mano no se reclama", () => {
    expect(situationOf(paid("2026-10-18"), { is_active: false })).toBeNull();
    expect(situationOf(trialRow("2026-10-24", "2026-10-11"), { is_active: false })).toBeNull();
  });
});

describe("firstName / daysPhrase", () => {
  it("toma el primer nombre con mayúscula inicial", () => {
    expect(firstName("Gonzalo Paredes")).toBe("Gonzalo");
    expect(firstName("  marcos   díaz ")).toBe("Marcos");
    expect(firstName("MARCOS")).toBe("Marcos");
    expect(firstName("McDonald Ruiz")).toBe("McDonald");
  });
  it("descarta correos, números y vacíos", () => {
    expect(firstName("juan@correo.com")).toBe("");
    expect(firstName("0981123456")).toBe("");
    expect(firstName("")).toBe("");
    expect(firstName(null)).toBe("");
    expect(firstName(undefined)).toBe("");
  });
  it("singular y plural de días", () => {
    expect(daysPhrase(1)).toBe("1 día");
    expect(daysPhrase(0)).toBe("0 días");
    expect(daysPhrase(5)).toBe("5 días");
  });
});

describe("plantillas", () => {
  it("reemplaza las variables y borra las desconocidas", () => {
    expect(renderFollowupTemplate("Hola {{nombre}} de {{negocio}}{{nada}}", { nombre: "Ana", negocio: "Taller" })).toBe(
      "Hola Ana de Taller"
    );
  });

  it("cada situación tiene su plantilla", () => {
    for (const situation of Object.keys(SITUATION_GROUP) as FollowupSituation[]) {
      expect(followupTemplate(situation).length).toBeGreaterThan(20);
      expect(SITUATION_LABELS[situation]).toBeTruthy();
    }
  });

  it("el cobro por vencer lleva los días, la fecha y el pedido de pago", () => {
    const info = companyExpiryInfo(paid("2026-10-24"), TODAY)!;
    const msg = buildFollowupMessage(company(), info, "cobro-por-vencer");
    expect(msg).toContain("Hola Marcos");
    expect(msg).toContain("Taller Norte");
    expect(msg).toContain("3 días");
    expect(msg).toContain("24/10/2026");
    expect(msg).toContain("pago");
    expect(msg).not.toContain("{{");
  });

  it("el último día se escribe en singular", () => {
    const info = companyExpiryInfo(paid("2026-10-22"), TODAY)!;
    expect(buildFollowupMessage(company(), info, "cobro-por-vencer")).toContain("Ya solo quedan 1 día");
  });

  it("la prueba pregunta qué le pareció y si quiere unirse", () => {
    const info = companyExpiryInfo(trialRow("2026-10-19", "2026-10-06"), TODAY)!;
    const msg = buildFollowupMessage(company(), info, "prueba-gracia");
    expect(msg).toContain("Qué te pareció");
    expect(msg).toContain("unirte a F7 Manager Pro");
    expect(msg).toContain("19/10/2026");
    expect(msg).toContain("22/10/2026");
    expect(msg).not.toContain("{{");
  });

  it("sin nombre de administrador saluda sin nombre", () => {
    const info = companyExpiryInfo(paid("2026-10-24"), TODAY)!;
    const msg = buildFollowupMessage(company({ admin_name: "juan@correo.com" }), info, "cobro-por-vencer");
    expect(msg.startsWith("Hola, ")).toBe(true);
  });

  it("nunca deja variables sin reemplazar en ninguna situación", () => {
    const info = companyExpiryInfo(paid("2026-10-18"), TODAY)!;
    for (const situation of Object.keys(SITUATION_GROUP) as FollowupSituation[]) {
      expect(buildFollowupMessage(company(), info, situation)).not.toContain("{{");
    }
  });
});

describe("wasContactedRecently", () => {
  const withContact = (at: string | null, kind: string | null) => ({ last_contact_at: at, last_contact_kind: kind });

  it("dentro del período de espera y del mismo motivo", () => {
    expect(wasContactedRecently(withContact("2026-10-21T12:00:00Z", "cobro"), "cobro", TODAY)).toBe(true);
    expect(wasContactedRecently(withContact("2026-10-19T12:00:00Z", "cobro"), "cobro", TODAY)).toBe(true);
  });
  it("pasado el período de espera ya vuelve a la lista", () => {
    expect(CONTACT_COOLDOWN_DAYS).toBe(3);
    expect(wasContactedRecently(withContact("2026-10-18T12:00:00Z", "cobro"), "cobro", TODAY)).toBe(false);
  });
  it("un mensaje de otro motivo no cuenta", () => {
    expect(wasContactedRecently(withContact("2026-10-21T12:00:00Z", "prueba"), "cobro", TODAY)).toBe(false);
    expect(wasContactedRecently(withContact("2026-10-21T12:00:00Z", "otro"), "prueba", TODAY)).toBe(false);
  });
  it("sin mensajes previos o con una fecha futura no cuenta", () => {
    expect(wasContactedRecently(withContact(null, null), "cobro", TODAY)).toBe(false);
    expect(wasContactedRecently(withContact("2026-10-25T12:00:00Z", "cobro"), "cobro", TODAY)).toBe(false);
  });
});

describe("buildFollowupQueue", () => {
  const row = (c: Partial<FollowupCompany>, r: Parameters<typeof companyExpiryInfo>[0]) => {
    const full = company(c);
    return { company: full, info: companyExpiryInfo(r, TODAY) };
  };

  it("deja afuera a los que no necesitan mensaje", () => {
    const queue = buildFollowupQueue(
      [
        row({ id: "a", name: "Al día" }, paid("2026-12-01")),
        row({ id: "b", name: "Sin fechas" }, { billing_cycle: null, plan_paid_from: null, plan_expires_at: null }),
        row({ id: "c", name: "Por vencer" }, paid("2026-10-25")),
      ],
      TODAY
    );
    expect(queue.map((i) => i.company.id)).toEqual(["c"]);
    expect(queue[0].group).toBe("cobro");
    expect(queue[0].situation).toBe("cobro-por-vencer");
  });

  it("lo más urgente primero", () => {
    const queue = buildFollowupQueue(
      [
        row({ id: "a", name: "A" }, paid("2026-10-26")),
        row({ id: "b", name: "B" }, paid("2026-10-18")),
        row({ id: "c", name: "C" }, paid("2026-10-22")),
      ],
      TODAY
    );
    expect(queue.map((i) => i.company.id)).toEqual(["b", "c", "a"]);
  });

  it("a igual urgencia, los cobros van antes que las pruebas y después por nombre", () => {
    const queue = buildFollowupQueue(
      [
        row({ id: "t", name: "Aaa Prueba" }, trialRow("2026-10-24", "2026-10-11")),
        row({ id: "z", name: "Zeta" }, paid("2026-10-24")),
        row({ id: "m", name: "Mario" }, paid("2026-10-24")),
      ],
      TODAY
    );
    expect(queue.map((i) => i.company.id)).toEqual(["m", "z", "t"]);
  });

  it("a quien ya se le escribió hace poco pasa al final y queda marcado", () => {
    const queue = buildFollowupQueue(
      [
        row(
          { id: "a", name: "A", last_contact_at: "2026-10-21T12:00:00Z", last_contact_kind: "cobro" },
          paid("2026-10-18")
        ),
        row({ id: "b", name: "B" }, paid("2026-10-26")),
      ],
      TODAY
    );
    expect(queue.map((i) => i.company.id)).toEqual(["b", "a"]);
    expect(queue[0].contactedRecently).toBe(false);
    expect(queue[1].contactedRecently).toBe(true);
  });

  it("un mensaje de cobro previo no esconde un seguimiento de prueba", () => {
    const queue = buildFollowupQueue(
      [
        row(
          { id: "a", name: "A", last_contact_at: "2026-10-21T12:00:00Z", last_contact_kind: "cobro" },
          trialRow("2026-10-24", "2026-10-11")
        ),
      ],
      TODAY
    );
    expect(queue[0].group).toBe("prueba");
    expect(queue[0].contactedRecently).toBe(false);
  });

  it("no incluye las cuentas suspendidas a mano", () => {
    const queue = buildFollowupQueue([row({ id: "a", is_active: false }, paid("2026-10-18"))], TODAY);
    expect(queue).toHaveLength(0);
  });
});
