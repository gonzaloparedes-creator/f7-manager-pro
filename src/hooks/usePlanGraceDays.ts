import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_GRACE_DAYS } from "@/lib/planExpiry";

let cached: number | null = null;
let inflight: Promise<number> | null = null;

function loadGraceDays(): Promise<number> {
  if (!inflight) {
    inflight = Promise.resolve(supabase.rpc("plan_grace_days")).then(({ data, error }) => {
      if (!error && typeof data === "number") cached = data;
      inflight = null;
      return cached ?? DEFAULT_GRACE_DAYS;
    });
  }
  return inflight;
}

// Días de gracia después del vencimiento, tal como los define la base de datos
// (para las pantallas de Super Admin, que muestran las fechas de varias empresas).
export function usePlanGraceDays(): number {
  const [days, setDays] = useState<number>(cached ?? DEFAULT_GRACE_DAYS);

  useEffect(() => {
    let active = true;
    loadGraceDays().then((value) => {
      if (active) setDays(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return days;
}
