import { describe, expect, it } from "vitest";
import {
  balanceDue,
  buildReservationMessage,
  daysLeft,
  defaultExpiry,
  depositOf,
  depositProblem,
  displayDate,
  emptyReservationDraft,
  expiryText,
  isOverdue,
  parseCancelDraft,
  parseReservationDraft,
  statusLabel,
  suggestedExtension,
  totalDeposit,
  type DeviceReservation,
  type ReservationDraft,
} from "./reservations";

const now = new Date(2026, 9, 15, 12, 0, 0);

const draft = (over: Partial<ReservationDraft> = {}): ReservationDraft => ({
  customerName: "Ana Gómez",
  customerPhone: "0981 123 456",
  agreedPrice: "3.500.000",
  deposit: "500.000",
  paymentMethod: "Efectivo",
  expiresOn: "2026-10-18",
  notes: "",
  ...over,
});

const reservation = (over: Partial<DeviceReservation> = {}): DeviceReservation => ({
  id: "r1",
  company_id: "c1",
  branch_id: null,
  receipt_number: "RES-0001",
  inventory_item_id: "i1",
  device_name: "iPhone 13 128GB",
  imei: null,
  customer_name: "Ana Gómez",
  customer_phone: null,
  agreed_price: 3500000,
  deposit_amount: 500000,
  deposit_payment_method: "Efectivo",
  expires_on: "2026-10-18",
  notes: null,
  status: "activa",
  refunded_amount: 0,
  retained_amount: 0,
  cancel_reason: null,
  resolved_at: null,
  created_at: "2026-10-15T12:00:00.000Z",
  ...over,
});

describe("fechas de la reserva", () => {
  it("el vencimiento por defecto es en 3 días", () => {
    expect(defaultExpiry(now)).toBe("2026-10-18");
  });

  it("cuenta los días que faltan, con 0 = hoy y negativo = vencida", () => {
    expect(daysLeft("2026-10-15", now)).toBe(0);
    expect(daysLeft("2026-10-18", now)).toBe(3);
    expect(daysLeft("2026-10-14", now)).toBe(-1);
  });

  it("el texto del plazo cubre hoy, mañana, futuro y vencida", () => {
    expect(expiryText("2026-10-15", now)).toBe("Vence hoy");
    expect(expiryText("2026-10-16", now)).toBe("Vence mañana");
    expect(expiryText("2026-10-18", now)).toBe("Vence en 3 días");
    expect(expiryText("2026-10-14", now)).toBe("Vencida ayer");
    expect(expiryText("2026-10-10", now)).toBe("Vencida hace 5 días");
  });

  it("solo una reserva activa puede estar vencida", () => {
    expect(isOverdue({ status: "activa", expires_on: "2026-10-14" }, now)).toBe(true);
    expect(isOverdue({ status: "activa", expires_on: "2026-10-15" }, now)).toBe(false);
    expect(isOverdue({ status: "vendida", expires_on: "2026-10-01" }, now)).toBe(false);
    expect(isOverdue({ status: "cancelada", expires_on: "2026-10-01" }, now)).toBe(false);
  });

  it("la etiqueta de estado distingue activa, vencida, vendida y cancelada", () => {
    expect(statusLabel({ status: "activa", expires_on: "2026-10-18" }, now)).toBe("Activa");
    expect(statusLabel({ status: "activa", expires_on: "2026-10-01" }, now)).toBe("Vencida");
    expect(statusLabel({ status: "vendida", expires_on: "2026-10-01" }, now)).toBe("Vendida");
    expect(statusLabel({ status: "cancelada", expires_on: "2026-10-18" }, now)).toBe("Cancelada");
  });

  it("muestra la fecha como dd/MM/yyyy", () => {
    expect(displayDate("2026-10-18")).toBe("18/10/2026");
  });

  it("al extender suma 3 días al vencimiento actual, o a hoy si ya venció", () => {
    expect(suggestedExtension("2026-10-20", now)).toBe("2026-10-23");
    expect(suggestedExtension("2026-10-10", now)).toBe("2026-10-18");
    expect(suggestedExtension("2026-10-15", now)).toBe("2026-10-18");
  });
});

describe("seña y saldo", () => {
  it("el saldo es el precio acordado menos la seña, nunca negativo", () => {
    expect(depositOf(reservation())).toBe(500000);
    expect(balanceDue(reservation())).toBe(3000000);
    expect(balanceDue(reservation({ agreed_price: "1000000", deposit_amount: "1000000" }))).toBe(0);
    expect(balanceDue(reservation({ agreed_price: 100, deposit_amount: 500 }))).toBe(0);
  });

  it("sin seña el saldo es el precio completo", () => {
    expect(depositOf(reservation({ deposit_amount: 0 }))).toBe(0);
    expect(balanceDue(reservation({ deposit_amount: 0 }))).toBe(3500000);
  });
});

describe("emptyReservationDraft", () => {
  it("precarga el precio de venta y el vencimiento por defecto", () => {
    const d = emptyReservationDraft(3500000.4, now);
    expect(d.agreedPrice).toBe("3500000");
    expect(d.expiresOn).toBe("2026-10-18");
    expect(d.customerName).toBe("");
    expect(d.deposit).toBe("");
    expect(d.paymentMethod).toBe("");
  });

  it("sin precio de venta deja el precio vacío", () => {
    expect(emptyReservationDraft(0, now).agreedPrice).toBe("");
  });
});

describe("parseReservationDraft", () => {
  it("arma los parámetros de la RPC con montos con punto de miles", () => {
    const res = parseReservationDraft(draft({ notes: "  viene el sábado " }), "item-1", now);
    expect(res.error).toBeNull();
    expect(res.params).toEqual({
      inventory_item_id: "item-1",
      customer_name: "Ana Gómez",
      customer_phone: "0981 123 456",
      agreed_price: 3500000,
      deposit_amount: 500000,
      payment_method: "Efectivo",
      expires_on: "2026-10-18",
      notes: "viene el sábado",
    });
  });

  it("sin seña no pide ni manda medio de pago", () => {
    const res = parseReservationDraft(draft({ deposit: "", paymentMethod: "Transferencia" }), "item-1", now);
    expect(res.error).toBeNull();
    expect(res.params?.deposit_amount).toBe(0);
    expect(res.params?.payment_method).toBeNull();
  });

  it("teléfono y notas vacíos van como null", () => {
    const res = parseReservationDraft(draft({ customerPhone: " ", notes: " " }), "item-1", now);
    expect(res.params?.customer_phone).toBeNull();
    expect(res.params?.notes).toBeNull();
  });

  it("exige el nombre del cliente", () => {
    expect(parseReservationDraft(draft({ customerName: "  " }), "i", now).error).toMatch(/nombre/);
    expect(parseReservationDraft(draft({ customerName: "x".repeat(121) }), "i", now).error).toMatch(/demasiado largo/);
  });

  it("exige un precio entero mayor a cero", () => {
    expect(parseReservationDraft(draft({ agreedPrice: "" }), "i", now).error).toMatch(/precio acordado/);
    expect(parseReservationDraft(draft({ agreedPrice: "0" }), "i", now).error).toMatch(/precio acordado/);
    expect(parseReservationDraft(draft({ agreedPrice: "abc" }), "i", now).error).toMatch(/precio acordado/);
    expect(parseReservationDraft(draft({ agreedPrice: "850.5" }), "i", now).error).toMatch(/precio acordado/);
    expect(parseReservationDraft(draft({ agreedPrice: "-100" }), "i", now).error).toMatch(/precio acordado/);
  });

  it("la seña no puede ser inválida ni superar el precio", () => {
    expect(parseReservationDraft(draft({ deposit: "1.5" }), "i", now).error).toMatch(/seña/);
    expect(parseReservationDraft(draft({ deposit: "3.500.001" }), "i", now).error).toMatch(/no puede superar/);
    expect(parseReservationDraft(draft({ deposit: "3.500.000" }), "i", now).error).toBeNull();
  });

  it("con seña exige el medio de pago", () => {
    expect(parseReservationDraft(draft({ paymentMethod: "" }), "i", now).error).toMatch(/medio de pago/);
  });

  it("el vencimiento no puede estar en el pasado pero hoy sí", () => {
    expect(parseReservationDraft(draft({ expiresOn: "2026-10-14" }), "i", now).error).toMatch(/anterior a hoy/);
    expect(parseReservationDraft(draft({ expiresOn: "2026-10-15" }), "i", now).error).toBeNull();
    expect(parseReservationDraft(draft({ expiresOn: "" }), "i", now).error).toMatch(/hasta cuándo/);
  });

  it("limita las notas a 500 caracteres", () => {
    expect(parseReservationDraft(draft({ notes: "n".repeat(501) }), "i", now).error).toMatch(/notas/);
  });
});

describe("parseCancelDraft", () => {
  it("devolver todo no deja nada retenido", () => {
    const res = parseCancelDraft({ refund: "500.000", method: "Efectivo", reason: " cambió de idea " }, "r1", 500000);
    expect(res.error).toBeNull();
    expect(res.retained).toBe(0);
    expect(res.params).toEqual({
      reservation_id: "r1",
      refund_amount: 500000,
      refund_method: "Efectivo",
      reason: "cambió de idea",
    });
  });

  it("devolver una parte retiene el resto", () => {
    const res = parseCancelDraft({ refund: "200000", method: "Transferencia", reason: "" }, "r1", 500000);
    expect(res.retained).toBe(300000);
    expect(res.params?.reason).toBeNull();
  });

  it("no devolver nada retiene toda la seña y no pide medio de pago", () => {
    const res = parseCancelDraft({ refund: "", method: "Efectivo", reason: "" }, "r1", 500000);
    expect(res.error).toBeNull();
    expect(res.retained).toBe(500000);
    expect(res.params?.refund_amount).toBe(0);
    expect(res.params?.refund_method).toBeNull();
  });

  it("rechaza devolver más que la seña, montos inválidos o devolución sin medio de pago", () => {
    expect(parseCancelDraft({ refund: "500001", method: "Efectivo", reason: "" }, "r1", 500000).error).toMatch(/más que la seña/);
    expect(parseCancelDraft({ refund: "abc", method: "Efectivo", reason: "" }, "r1", 500000).error).toMatch(/monto/);
    expect(parseCancelDraft({ refund: "100000", method: "", reason: "" }, "r1", 500000).error).toMatch(/medio de pago/);
  });

  it("una reserva sin seña solo se puede cancelar sin devolver", () => {
    expect(parseCancelDraft({ refund: "", method: "", reason: "" }, "r1", 0).error).toBeNull();
    expect(parseCancelDraft({ refund: "1", method: "Efectivo", reason: "" }, "r1", 0).error).toMatch(/más que la seña/);
  });

  it("limita el motivo a 300 caracteres", () => {
    expect(parseCancelDraft({ refund: "", method: "", reason: "m".repeat(301) }, "r1", 0).error).toMatch(/motivo/);
  });
});

describe("señas en el carrito", () => {
  it("suma las señas de las líneas que vienen de una reserva", () => {
    expect(totalDeposit([{ deposit: 500000 }, {}, { deposit: 250000 }])).toBe(750000);
    expect(totalDeposit([])).toBe(0);
  });

  it("una seña mayor que el precio de la línea es un problema", () => {
    expect(depositProblem([{ name: "iPhone", quantity: 1, unitPrice: 3000000, deposit: 500000 }])).toBeNull();
    expect(depositProblem([{ name: "iPhone", quantity: 1, unitPrice: 3000000, deposit: 3000000 }])).toBeNull();
    const msg = depositProblem([{ name: "iPhone", quantity: 1, unitPrice: 400000, deposit: 500000 }]);
    expect(msg).toContain("iPhone");
    expect(msg).toContain("500.000");
  });
});

describe("buildReservationMessage", () => {
  it("con seña muestra seña, saldo y hasta cuándo se guarda", () => {
    const msg = buildReservationMessage(reservation(), { businessName: "Seven Store", branchName: "Casa Central" });
    expect(msg).toContain("Reserva de equipo — Seven Store");
    expect(msg).toContain("(Casa Central)");
    expect(msg).toContain("Reserva RES-0001");
    expect(msg).toContain("Equipo: iPhone 13 128GB");
    expect(msg).toContain("Precio acordado: Gs. 3.500.000");
    expect(msg).toContain("Seña recibida: Gs. 500.000");
    expect(msg).toContain("Saldo a pagar al retirarlo: Gs. 3.000.000");
    expect(msg).toContain("hasta el 18/10/2026");
  });

  it("sin seña lo dice y no muestra saldo", () => {
    const msg = buildReservationMessage(reservation({ deposit_amount: 0 }), {});
    expect(msg).toContain("Sin seña");
    expect(msg).not.toContain("Saldo");
    expect(msg).toContain("F7 Manager Pro");
  });

  it("no expone el IMEI ni datos del cliente", () => {
    const msg = buildReservationMessage(
      reservation({ imei: "356938035643809", customer_phone: "0981 123 456", notes: "interna" }),
      {}
    );
    expect(msg).not.toContain("356938035643809");
    expect(msg).not.toContain("0981");
    expect(msg).not.toContain("interna");
  });
});
