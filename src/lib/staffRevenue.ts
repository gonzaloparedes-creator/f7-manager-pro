import { inRange } from "@/lib/reportInsights";

export interface StaffOrderFields {
  quote_amount: number | null;
  senia_amount: number | null;
  cargos_adicionales: { monto?: unknown }[] | null;
  deposit_date: string | null;
  final_payment_date: string | null;
  assigned_technician_id: string | null;
}

export interface StaffSaleFields {
  quantity: number;
  unit_price: number;
  created_at: string;
  created_by: string | null;
}

export function totalOf(o: Pick<StaffOrderFields, "quote_amount" | "cargos_adicionales">) {
  const cargos = (o.cargos_adicionales ?? []).reduce((s, c) => s + Number(c?.monto ?? 0), 0);
  return Number(o.quote_amount ?? 0) + cargos;
}

/**
 * Lo atribuido a cada persona en el período, sobre base caja: la seña cuenta el
 * día que se cobró, el saldo el día de la entrega; las ventas, al vendedor.
 * Es la única regla de comisiones: Reportes y la liquidación usan esta misma.
 */
export function revenueByStaffId(
  orders: StaffOrderFields[],
  sales: StaffSaleFields[],
  from: Date | null,
  to: Date | null,
) {
  const map = new Map<string, number>();
  const add = (id: string | null, amount: number) => {
    if (!amount) return;
    const key = id ?? "";
    map.set(key, (map.get(key) ?? 0) + amount);
  };
  for (const o of orders) {
    const senia = Number(o.senia_amount ?? 0);
    let rev = 0;
    if (inRange(o.deposit_date, from, to)) rev += senia;
    if (inRange(o.final_payment_date, from, to)) rev += Math.max(0, totalOf(o) - senia);
    add(o.assigned_technician_id, rev);
  }
  for (const s of sales) {
    if (!inRange(s.created_at, from, to)) continue;
    add(s.created_by, s.quantity * Number(s.unit_price || 0));
  }
  return map;
}
