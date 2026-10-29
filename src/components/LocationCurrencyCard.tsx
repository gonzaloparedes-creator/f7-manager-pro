import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { COUNTRIES, PY_DEPARTMENTS, countryLabel } from "@/lib/locations";
import {
  CURRENCIES,
  CURRENCY_CODES,
  currencyForCountry,
  formatMoney,
  hasOwnCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import { openUpgradeWhatsApp } from "@/lib/upgrade";

// Si la empresa ya tiene montos cargados, cambiar la moneda cambia cómo se leen (no se convierten).
async function companyHasMoneyData(companyId: string): Promise<boolean> {
  const results = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("order_payments").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("product_sales").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("company_id", companyId),
  ]);
  // Ante la duda (un error de lectura) se avisa igual.
  return results.some((r) => r.error || (r.count ?? 0) > 0);
}

export default function LocationCurrencyCard() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const { currency: savedCurrency, setCurrency: applyCurrency } = useCurrency();
  const [country, setCountry] = useState("PY");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(savedCurrency);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isParaguay = country === "PY";
  const currencyChanged = currency !== savedCurrency;

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("country, department, city").eq("id", companyId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCountry(data.country ?? "PY");
        setDepartment(data.department ?? "");
        setCity(data.city ?? "");
      });
  }, [companyId]);

  // Al elegir el país se preselecciona su moneda (se puede cambiar a mano después).
  const onCountryChange = (next: string) => {
    setCountry(next);
    setDepartment("");
    setCity("");
    setCurrency(currencyForCountry(next));
  };

  const persist = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      country,
      department: isParaguay ? (department || null) : null,
      city: isParaguay ? (city || null) : null,
      currency,
    }).eq("id", companyId);
    setSaving(false);
    setConfirmOpen(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (currencyChanged) {
      toast({ title: "Moneda actualizada", description: `Ahora los montos se muestran en ${CURRENCIES[currency].name}.` });
      applyCurrency(currency);
    } else {
      toast({ title: "Ubicación actualizada" });
    }
  };

  const save = async () => {
    if (!companyId) return;
    if (!currencyChanged) return persist();
    setSaving(true);
    const hasData = await companyHasMoneyData(companyId);
    setSaving(false);
    if (hasData) setConfirmOpen(true);
    else await persist();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <div className="font-semibold">Ubicación y moneda</div>
          <div className="text-xs text-muted-foreground">
            Nos ayuda a entender dónde estamos creciendo. La moneda define cómo se muestran todos tus montos.
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>País</Label>
            <Select value={country} onValueChange={onCountryChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
              <SelectTrigger aria-label="Moneda"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_CODES.map((code) => (
                  <SelectItem key={code} value={code}>{CURRENCIES[code].name} ({CURRENCIES[code].symbol})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!hasOwnCurrency(country) && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground sm:col-span-2">
              La moneda de {countryLabel(country)} todavía no está disponible: mientras tanto podés usar dólares.{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() =>
                  openUpgradeWhatsApp(`¡Hola! Quiero usar F7 Manager Pro con la moneda de ${countryLabel(country)}. ¿Pueden sumarla?`)
                }
              >
                Pedir mi moneda
              </button>
            </div>
          )}
          {isParaguay && (
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="Elegí uno" /></SelectTrigger>
                <SelectContent>
                  {PY_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {isParaguay && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Ciudad</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          )}
        </div>
        <Button onClick={save} disabled={saving || !companyId}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`¿Cambiar la moneda a ${CURRENCIES[currency].name}?`}
        description={`Tu empresa ya tiene órdenes, cobros o productos cargados y sus montos NO se convierten: por ejemplo, ${formatMoney(350000, savedCurrency)} pasaría a verse como ${formatMoney(350000, currency)}. Cambiala solo si vas a trabajar en esa moneda. Podés volver a la anterior cuando quieras y todo se ve como antes.`}
        confirmLabel="Cambiar moneda"
        confirmingLabel="Cambiando..."
        loading={saving}
        destructive={false}
        onConfirm={persist}
      />
    </Card>
  );
}
