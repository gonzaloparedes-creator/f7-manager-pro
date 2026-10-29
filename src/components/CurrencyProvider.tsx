import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { CurrencyContext, type CurrencyContextValue } from "@/hooks/useCurrency";
import { DEFAULT_CURRENCY, parseCurrency, setActiveCurrency, type CurrencyCode } from "@/lib/currency";

// No dibuja nada hasta conocer la moneda de la empresa (así ningún monto, ni los avisos
// pendientes que se arman al cargar, sale con la moneda equivocada) y vuelve a dibujar
// todo lo de adentro cuando la moneda cambia.
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { companyId, loading: companyLoading } = useCompany();
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  // Empresa cuya moneda ya se leyó (null = no hay empresa): evita dibujar con la moneda de otra.
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (companyLoading) return;
    if (!companyId) {
      setCurrencyState(DEFAULT_CURRENCY);
      setLoadedFor(null);
      return;
    }
    let active = true;
    supabase
      .from("companies")
      .select("currency")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        // Si la lectura falla se queda en guaraníes: la pantalla no se rompe.
        setCurrencyState(parseCurrency(data?.currency));
        setLoadedFor(companyId);
      });
    return () => {
      active = false;
    };
  }, [companyId, companyLoading]);

  // Se fija ANTES de que los hijos dibujen montos (ver src/lib/currency.ts).
  setActiveCurrency(currency);

  // Al salir (cerrar sesión, ir al panel de Super Admin) vuelve a guaraníes.
  useEffect(() => () => setActiveCurrency(DEFAULT_CURRENCY), []);

  const loading = companyLoading || (companyId ? loadedFor !== companyId : false);

  const value = useMemo<CurrencyContextValue>(() => ({ currency, setCurrency: setCurrencyState }), [currency]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <CurrencyContext.Provider value={value}>
      <Fragment key={currency}>{children}</Fragment>
    </CurrencyContext.Provider>
  );
}
