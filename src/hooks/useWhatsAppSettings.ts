import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { DEFAULT_POST_SALE_SETTINGS, type PostSaleSettings } from "@/lib/postSale";

export interface WhatsAppSettings {
  prefs: Record<string, boolean>;
  queueSince: string | null;
  // true si algún usuario de la empresa todavía tiene Evolution conectado:
  // en ese caso el servidor sigue avisando solo y no se ofrece el diálogo
  // nuevo (evita mandarle dos veces el mismo aviso al cliente).
  evolutionActive: boolean;
  postSale: PostSaleSettings;
  // Post-venta es de los planes Pro, Business y Retail (no Starter).
  postSaleAvailable: boolean;
}

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
  prefs: {},
  queueSince: null,
  evolutionActive: false,
  postSale: DEFAULT_POST_SALE_SETTINGS,
  postSaleAvailable: false,
};

export async function fetchWhatsAppSettings(companyId: string): Promise<WhatsAppSettings> {
  const [companyRes, connectedRes] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "whatsapp_notify_prefs, whatsapp_queue_since, plan_type, postsale_review_enabled, postsale_warranty_enabled, postsale_birthday_enabled, review_url"
      )
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("whatsapp_connected", true),
  ]);
  if (companyRes.error) throw companyRes.error;
  if (connectedRes.error) throw connectedRes.error;
  const rawPrefs = companyRes.data?.whatsapp_notify_prefs;
  const prefs =
    rawPrefs && typeof rawPrefs === "object" && !Array.isArray(rawPrefs)
      ? (rawPrefs as Record<string, boolean>)
      : {};
  return {
    prefs,
    queueSince: companyRes.data?.whatsapp_queue_since ?? null,
    evolutionActive: (connectedRes.count ?? 0) > 0,
    postSale: {
      review: companyRes.data?.postsale_review_enabled ?? false,
      warranty: companyRes.data?.postsale_warranty_enabled ?? false,
      birthday: companyRes.data?.postsale_birthday_enabled ?? false,
      reviewUrl: companyRes.data?.review_url ?? null,
    },
    postSaleAvailable: (companyRes.data?.plan_type ?? "starter") !== "starter",
  };
}

export function useWhatsAppSettings() {
  const { companyId } = useCompany();
  const [settings, setSettings] = useState<WhatsAppSettings>(DEFAULT_WHATSAPP_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setSettings(await fetchWhatsAppSettings(companyId));
    } catch (e) {
      console.error("No se pudieron cargar los ajustes de WhatsApp:", e);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { ...settings, loading, reload: load, companyId };
}
