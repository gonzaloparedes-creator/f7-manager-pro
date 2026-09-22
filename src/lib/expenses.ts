import { supabase } from "@/integrations/supabase/client";

/**
 * Registra un pago real en expense_payments (una fila por pago, con su
 * propio medio y fecha) — mismo rol que logOrderPayment para las órdenes:
 * expenses.amount_paid es el total corriente que se muestra en la UI,
 * mientras que este ledger es lo que le permite al Cierre de Caja saber
 * cuánto salió realmente en efectivo por gastos en un día puntual.
 *
 * Deliberadamente "best effort": si el gasto (o el abono de cuota) ya se
 * guardó bien, un fallo acá no debe hacer parecer que la operación
 * principal falló — solo se pierde precisión en el Cierre de Caja.
 */
export async function logExpensePayment(
  params: { expenseId: string; companyId: string; amount: number; method: string | null; userId: string }
) {
  if (params.amount <= 0) return;
  const { error } = await (supabase as any).from("expense_payments").insert({
    expense_id: params.expenseId,
    company_id: params.companyId,
    amount: params.amount,
    payment_method: params.method,
    created_by: params.userId,
  });
  if (error) console.error("No se pudo registrar el pago del gasto en el historial:", error.message);
}
