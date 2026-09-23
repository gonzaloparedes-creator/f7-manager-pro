import { supabase } from "@/integrations/supabase/client";

// Un teléfono con muy pocos dígitos (ej. "000", "1111", dejado así por el
// staff para completar el campo rápido cuando el cliente no quiso dar su
// número real) casi seguro no es un número real — tratarlo como
// identificador confiable causó que pedidos de clientes totalmente
// distintos terminaran fusionados bajo un mismo registro de cliente
// (confirmado en producción: varios "Cliente Mayorista" con más de 10
// pedidos de personas distintas mezclados en una sola ficha). 6 dígitos
// después del 595 es más corto que cualquier número paraguayo real
// (móviles tienen 9), así que sirve de piso seguro sin rechazar ningún
// teléfono legítimo.
const MIN_REAL_PHONE_DIGITS = 6;

function normalizedRealPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/^595/, "");
  return digits.length >= MIN_REAL_PHONE_DIGITS ? phone : null;
}

/**
 * Resuelve el client_id a usar para una orden/presupuesto nuevo: si hay un
 * teléfono real, busca un cliente existente de este mismo técnico con ese
 * teléfono (evita duplicar al mismo cliente recurrente) y si no existe, o
 * si no hay un teléfono real, crea un cliente nuevo. Centralizado acá para
 * no repetir esta lógica (y su corrección) en cada diálogo de creación.
 */
export async function resolveClientId(params: {
  companyId: string;
  technicianId: string;
  customerName: string;
  customerPhone: string | null;
  customerCedula: string | null;
}): Promise<string> {
  const cedulaNorm = params.customerCedula?.trim() || null;
  const phoneNorm = normalizedRealPhone(params.customerPhone);

  if (phoneNorm) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id,cedula")
      .eq("technician_id", params.technicianId)
      .eq("phone", phoneNorm)
      .maybeSingle();
    if (existing?.id) {
      if (cedulaNorm && !existing.cedula) {
        await supabase.from("clients").update({ cedula: cedulaNorm }).eq("id", existing.id);
      }
      return existing.id;
    }
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      company_id: params.companyId,
      technician_id: params.technicianId,
      name: params.customerName || "Cliente",
      phone: phoneNorm,
      cedula: cedulaNorm,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}
