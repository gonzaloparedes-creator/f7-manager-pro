import { useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

const runs = new Map<string, Promise<number>>();

/**
 * Pide a la base que cree los gastos recurrentes que ya vencieron (la función
 * solo toca la empresa de quien llama y no duplica fechas). Se comparte una
 * sola llamada por empresa y día, para que AppLayout y la pantalla de Gastos
 * no la repitan; `force` la vuelve a correr, p. ej. tras crear una regla.
 */
export function generateRecurringExpenses(companyId: string, force = false): Promise<number> {
  const key = `${companyId}:${format(new Date(), "yyyy-MM-dd")}`;
  const existing = runs.get(key);
  if (existing && !force) return existing;
  const run = (async () => {
    const { data, error } = await supabase.rpc("generate_recurring_expenses");
    if (error) {
      console.error("No se pudieron generar los gastos recurrentes:", error.message);
      return 0;
    }
    return data ?? 0;
  })();
  runs.set(key, run);
  return run;
}

export function useGenerateRecurringExpenses(enabled: boolean) {
  const { companyId } = useCompany();
  useEffect(() => {
    if (!enabled || !companyId) return;
    void generateRecurringExpenses(companyId);
  }, [enabled, companyId]);
}
