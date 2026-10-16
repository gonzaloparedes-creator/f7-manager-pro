import { supabase } from "@/integrations/supabase/client";
import { parseBarcode } from "@/lib/barcode";

/** Pide al servidor el próximo código propio libre de esta empresa. */
export async function generateBarcode(companyId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("next_barcode", { _company_id: companyId });
  if (error) throw error;
  return data as string;
}

/** Nombre del otro artículo de la empresa que ya usa este código, o null si está libre. */
export async function barcodeOwnerName(companyId: string, code: string, exceptItemId?: string): Promise<string | null> {
  let query = (supabase as any)
    .from("inventory_items")
    .select("name")
    .eq("company_id", companyId)
    .eq("barcode", code)
    .limit(1);
  if (exceptItemId) query = query.neq("id", exceptItemId);
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0]?.name ?? null;
}

/** Valida el código que se tipeó/escaneó antes de guardar: formato y que no lo use otro artículo de la empresa. */
export async function checkBarcodeForSave(
  companyId: string,
  raw: string,
  exceptItemId?: string,
): Promise<{ value: string | null; error: string | null }> {
  const parsed = parseBarcode(raw);
  if (parsed.error || !parsed.value) return parsed;
  const owner = await barcodeOwnerName(companyId, parsed.value, exceptItemId);
  if (owner) return { value: null, error: `Ese código ya lo tiene "${owner}".` };
  return parsed;
}
