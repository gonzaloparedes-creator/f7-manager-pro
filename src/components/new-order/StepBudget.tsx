import { useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { usePaymentMethodPresets } from "@/hooks/usePaymentMethodPresets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import WarrantySelector from "@/components/WarrantySelector";
import { currencySymbol, formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { formatThousands, parseAmount, type OrderFormState } from "./state";

interface Props {
  form: OrderFormState;
  patch: (p: Partial<OrderFormState>) => void;
}

const chipClass = (active: boolean) =>
  cn(
    "rounded-full border px-3.5 py-2 text-sm transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-muted-foreground hover:text-foreground"
  );

const QUICK_DAYS = [3, 7, 15];

export default function StepBudget({ form, patch }: Props) {
  const { presets: paymentMethodPresets } = usePaymentMethodPresets();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const quote = parseAmount(form.quote_amount);
  const deposit = parseAmount(form.deposit_amount);
  const balance = quote - deposit;
  const depositTooHigh = deposit > quote;
  const today = new Date();
  const date = form.estimated_delivery_date;
  const isQuickDate = date ? QUICK_DAYS.some((d) => isSameDay(date, addDays(today, d))) : false;

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="order_quote_amount">Presupuesto ({currencySymbol()})</Label>
            <Input
              id="order_quote_amount"
              className="h-11 text-base"
              inputMode="numeric"
              placeholder="0"
              value={formatThousands(form.quote_amount)}
              onChange={(e) => patch({ quote_amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order_deposit_amount">Seña ({currencySymbol()})</Label>
            <Input
              id="order_deposit_amount"
              className={cn("h-11 text-base", depositTooHigh && "border-destructive focus-visible:ring-destructive")}
              inputMode="numeric"
              placeholder="0"
              value={formatThousands(form.deposit_amount)}
              onChange={(e) => patch({ deposit_amount: e.target.value })}
            />
          </div>
        </div>

        {deposit > 0 && (
          <div className="space-y-2">
            <Label>Método de pago de la seña</Label>
            <div className="flex flex-wrap gap-2">
              {paymentMethodPresets.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => patch({ deposit_payment_method: m.label })}
                  className={chipClass(form.deposit_payment_method === m.label)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex items-center justify-between rounded-lg border px-4 py-3 text-sm",
            depositTooHigh
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : balance > 0
                ? "border-secondary/40 bg-secondary/10"
                : "border-border bg-muted/40 text-muted-foreground"
          )}
        >
          {depositTooHigh ? (
            <span className="font-medium">La seña no puede superar al presupuesto.</span>
          ) : (
            <>
              <span>Saldo a cobrar al retirar</span>
              <span className={cn("text-base font-semibold", balance > 0 && "text-secondary")}>{formatMoney(balance)}</span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <Label>Fecha estimada de entrega</Label>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_DAYS.map((d) => {
            const target = addDays(today, d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => patch({ estimated_delivery_date: target })}
                className={chipClass(!!date && isSameDay(date, target))}
              >
                En {d} días
              </button>
            );
          })}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={chipClass(!!date && !isQuickDate)}>
                <CalendarIcon className="mr-1.5 inline h-3.5 w-3.5" />
                {date && !isQuickDate ? format(date, "PPP", { locale: es }) : "Elegir fecha"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { patch({ estimated_delivery_date: d }); setCalendarOpen(false); }}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                locale={es}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
          {date && (
            <button
              type="button"
              onClick={() => patch({ estimated_delivery_date: undefined })}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Quitar
            </button>
          )}
        </div>
        {date && isQuickDate && (
          <p className="text-xs text-muted-foreground">{format(date, "PPPP", { locale: es })}</p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <Label>Tiempo de garantía</Label>
        <WarrantySelector value={form.warranty_days} onChange={(d) => patch({ warranty_days: d })} />
      </div>
    </div>
  );
}
