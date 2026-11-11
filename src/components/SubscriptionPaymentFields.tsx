import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Cycle, PlanType } from "@/lib/plans";
import {
  CURRENCY_LABELS,
  PAYMENT_METHODS,
  formatMoney,
  type DiscountMode,
  type ReceiptCurrency,
} from "@/lib/subscriptionReceipt";
import { cobroAmounts, type CobroState, type PaymentContext, type PaymentErrors } from "@/lib/subscriptionPayment";
import { cn } from "@/lib/utils";

const CAJA = "__caja__";
const CURRENCIES: ReceiptCurrency[] = ["PYG", "USD"];
const CURRENCY_SHORT: Record<ReceiptCurrency, string> = { PYG: "Gs.", USD: "US$" };

interface Props {
  cobro: CobroState;
  onChange: (patch: Partial<CobroState>) => void;
  plan: PlanType;
  cycle: Cycle;
  ctx: PaymentContext | null;
  errors: PaymentErrors;
  today: string;
  disabled?: boolean;
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

// Los datos del cobro de una suscripción: lo que va al recibo y al ingreso de Finanzas F7.
// Casi todo se llena solo (precio de lista, hoy, lo último que se usó): lo normal es revisar y guardar.
export default function SubscriptionPaymentFields({ cobro, onChange, plan, cycle, ctx, errors, today, disabled }: Props) {
  const amounts = cobroAmounts(cobro, plan, cycle);
  const [showDiscount, setShowDiscount] = useState(cobro.discountValue !== "");
  const [showMore, setShowMore] = useState(false);
  const usd = cobro.currency === "USD";
  const methods = (PAYMENT_METHODS as readonly string[]).includes(cobro.paymentMethod)
    ? [...PAYMENT_METHODS]
    : [cobro.paymentMethod, ...PAYMENT_METHODS];
  const partners = (ctx?.partners ?? []).filter((p) => p.active);
  const categories = (ctx?.categories ?? []).filter((c) => c.kind === "ingreso" && c.active);
  const hasDiscount = Number.isFinite(amounts.discount) && amounts.discount > 0;

  const changeCurrency = (currency: ReceiptCurrency) => {
    if (currency === cobro.currency) return;
    // El precio vuelve al de lista de la nueva moneda; un descuento fijo en una moneda no sirve en la otra.
    onChange({ currency, amountText: null, ...(cobro.discountMode === "fixed" ? { discountValue: "" } : {}) });
  };

  return (
    <div className="space-y-4" data-testid="payment-fields">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label id="cobro-currency-label">Moneda</Label>
          <div role="group" aria-labelledby="cobro-currency-label" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cobro.currency === c}
                aria-label={CURRENCY_LABELS[c]}
                disabled={disabled}
                onClick={() => changeCurrency(c)}
                className={cn(
                  "rounded-sm px-1 py-1.5 text-xs font-medium transition-colors",
                  cobro.currency === c ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {CURRENCY_SHORT[c]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cobro-date">Cobrado el</Label>
          <Input id="cobro-date" type="date" max={today} value={cobro.paymentDate} disabled={disabled} onChange={(e) => onChange({ paymentDate: e.target.value })} />
          <FieldError message={errors.paymentDate} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cobro-price">Precio</Label>
        <Input
          id="cobro-price"
          inputMode="decimal"
          value={amounts.priceText}
          disabled={disabled}
          onChange={(e) => onChange({ amountText: e.target.value })}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Precio de lista: {formatMoney(amounts.listPrice, cobro.currency)}</span>
          {cobro.amountText !== null && (
            <button type="button" className="font-medium text-primary hover:underline" disabled={disabled} onClick={() => onChange({ amountText: null })}>
              Usar el de lista
            </button>
          )}
          {!showDiscount && (
            <button type="button" className="font-medium text-primary hover:underline" disabled={disabled} onClick={() => setShowDiscount(true)}>
              Agregar descuento
            </button>
          )}
        </div>
        <FieldError message={errors.price} />
      </div>

      {showDiscount && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <div role="group" aria-label="Tipo de descuento" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {(["percent", "fixed"] as DiscountMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={cobro.discountMode === mode}
                  disabled={disabled}
                  onClick={() => onChange({ discountMode: mode, discountValue: "" })}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                    cobro.discountMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "percent" ? "%" : CURRENCY_SHORT[cobro.currency]}
                </button>
              ))}
            </div>
            <Input
              aria-label="Descuento"
              inputMode="decimal"
              placeholder={cobro.discountMode === "percent" ? "Ej.: 10" : "Monto a descontar"}
              value={cobro.discountValue}
              disabled={disabled}
              onChange={(e) => onChange({ discountValue: e.target.value })}
            />
          </div>
          <Input
            aria-label="Motivo del descuento"
            placeholder="Motivo (opcional): cliente fundador, pago anticipado…"
            maxLength={150}
            value={cobro.discountNote}
            disabled={disabled}
            onChange={(e) => onChange({ discountNote: e.target.value })}
          />
          <FieldError message={errors.discount} />
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
        <span className="text-sm text-muted-foreground">
          Total a recibir
          {hasDiscount && <span className="ml-1.5 text-xs">(descuento {formatMoney(amounts.discount, cobro.currency)})</span>}
        </span>
        <span className="text-lg font-semibold tabular-nums text-primary" data-testid="cobro-total">
          {Number.isFinite(amounts.total) ? formatMoney(amounts.total, cobro.currency) : "—"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cobro-method">Medio de pago</Label>
          <Select value={cobro.paymentMethod} onValueChange={(v) => onChange({ paymentMethod: v })} disabled={disabled}>
            <SelectTrigger id="cobro-method"><SelectValue /></SelectTrigger>
            <SelectContent>
              {methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldError message={errors.paymentMethod} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cobro-ref">Referencia (opcional)</Label>
          <Input id="cobro-ref" placeholder="N.º de transferencia" maxLength={120} value={cobro.paymentReference} disabled={disabled} onChange={(e) => onChange({ paymentReference: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cobro-collector">¿Quién cobró?</Label>
          <Select value={cobro.collectedBy || CAJA} onValueChange={(v) => onChange({ collectedBy: v === CAJA ? "" : v })} disabled={disabled}>
            <SelectTrigger id="cobro-collector"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={CAJA}>Caja F7</SelectItem>
              {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {usd && (
          <div className="space-y-1.5">
            <Label htmlFor="cobro-fx">Tipo de cambio (Gs. por US$)</Label>
            <Input id="cobro-fx" inputMode="decimal" placeholder="7.300" value={cobro.fxText} disabled={disabled} onChange={(e) => onChange({ fxText: e.target.value })} />
            <FieldError message={errors.fx} />
          </div>
        )}
      </div>

      <div>
        <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8 gap-1 text-xs text-muted-foreground" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")} />
          Más datos del recibo
        </Button>
        {showMore && (
          <div className="mt-2 space-y-4 rounded-lg border border-border bg-muted/20 p-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cobro-doc">Documento de quien paga (RUC / CI)</Label>
                <Input id="cobro-doc" maxLength={40} value={cobro.customerDocument} disabled={disabled} onChange={(e) => onChange({ customerDocument: e.target.value })} />
              </div>
              {categories.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="cobro-category">Categoría en Finanzas F7</Label>
                  <Select value={cobro.categoryId} onValueChange={(v) => onChange({ categoryId: v })} disabled={disabled}>
                    <SelectTrigger id="cobro-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.category} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cobro-issuer">Quién emite el recibo</Label>
              <Input id="cobro-issuer" maxLength={150} value={cobro.issuerName} disabled={disabled} onChange={(e) => onChange({ issuerName: e.target.value })} />
              <FieldError message={errors.issuer} />
              <Input aria-label="Datos de quien emite (RUC, dirección, contacto)" placeholder="RUC, dirección, contacto (opcional)" maxLength={500} value={cobro.issuerDetails} disabled={disabled} onChange={(e) => onChange({ issuerDetails: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cobro-notes">Notas del recibo (opcional)</Label>
              <Input id="cobro-notes" maxLength={1000} value={cobro.notes} disabled={disabled} onChange={(e) => onChange({ notes: e.target.value })} />
            </div>
          </div>
        )}
        {!showMore && errors.category && <FieldError message={errors.category} />}
        {!showMore && errors.issuer && <FieldError message={errors.issuer} />}
      </div>
    </div>
  );
}
