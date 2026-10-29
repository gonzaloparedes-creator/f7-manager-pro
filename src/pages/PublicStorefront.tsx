import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StorefrontView from "@/components/storefront/StorefrontView";
import { StorefrontUnavailable } from "@/components/storefront/StorefrontShell";
import { DEFAULT_CURRENCY, parseCurrency, setActiveCurrency } from "@/lib/currency";
import type { StorefrontData } from "@/lib/storefront";

type State = { status: "loading" } | { status: "missing" } | { status: "error" } | { status: "ready"; data: StorefrontData };

export default function PublicStorefront() {
  const { slug } = useParams();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    if (!slug) {
      setState({ status: "missing" });
      return;
    }
    setState({ status: "loading" });
    Promise.all([
      (supabase as any).rpc("get_storefront", { _slug: slug }),
      supabase.rpc("get_storefront_currency", { _slug: slug }),
    ]).then(([{ data, error }, { data: currency }]: [{ data: StorefrontData | null; error: unknown }, { data: string | null }]) => {
      if (!active) return;
      // Los precios se muestran en la moneda del negocio (antes de dibujarlos).
      setActiveCurrency(parseCurrency(currency));
      if (error) setState({ status: "error" });
      else if (!data) setState({ status: "missing" });
      else setState({ status: "ready", data });
    });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => () => setActiveCurrency(DEFAULT_CURRENCY), []);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (state.status === "missing") {
    return <StorefrontUnavailable title="Esta vitrina no está disponible" message="El enlace puede estar mal escrito o el negocio la tiene pausada por ahora." />;
  }
  if (state.status === "error") {
    return <StorefrontUnavailable title="No pudimos cargar la vitrina" message="Revisá tu conexión y probá de nuevo en un momento." />;
  }
  return <StorefrontView store={state.data.store} items={state.data.items} />;
}
