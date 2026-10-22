import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PERIOD_OPTIONS,
  describePeriod,
  formatGs,
  parseFxInput,
  toPyg,
  type Currency,
  type F7Category,
  type F7Partner,
  type PeriodKey,
} from "@/lib/f7Finance";
import { PAYMENT_METHODS, parseMoneyInput } from "@/lib/subscriptionReceipt";
import { NONE, type PeriodControl } from "./helpers";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <p className="mx-auto max-w-prose text-sm text-muted-foreground">{children}</p>
    </Card>
  );
}

export type Tone = "good" | "bad" | "warn";

const TONE_TEXT: Record<Tone, string> = {
  good: "text-primary",
  bad: "text-destructive",
  warn: "text-secondary",
};

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 px-2.5 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("truncate text-sm font-semibold tabular-nums", tone && TONE_TEXT[tone])}>{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

const ACCENT: Record<"primary" | "secondary" | "destructive" | "neutral", string> = {
  primary: "border-l-primary",
  secondary: "border-l-secondary",
  destructive: "border-l-destructive",
  neutral: "border-l-border",
};

// Tarjeta de cifra grande, con una franja de color a la izquierda.
export function Kpi({
  label,
  value,
  hint,
  accent = "neutral",
  tone,
  className,
  testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: keyof typeof ACCENT;
  tone?: Tone;
  className?: string;
  testId?: string;
}) {
  return (
    <Card className={cn("min-w-0 overflow-hidden border-l-4 p-3 sm:p-4", ACCENT[accent], className)} data-testid={testId}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 break-words text-lg font-bold tabular-nums sm:text-xl", tone && TONE_TEXT[tone])}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

export interface ChipOption<K extends string> {
  key: K;
  label: string;
  count?: number;
  countClass?: string;
}

export function ChipBar<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent/40",
            value === o.key ? "border-primary bg-primary/10" : "border-border"
          )}
        >
          <span className="font-medium">{o.label}</span>
          {o.count != null ? <span className={cn("font-bold tabular-nums", o.countClass)}>{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar"
        className="pl-9 pr-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Borrar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function PeriodPicker({ control }: { control: PeriodControl }) {
  const { key: periodKey, custom, period, setKey: onKeyChange, setCustom: onCustomChange } = control;
  const incomplete = periodKey === "personalizado" && period.from == null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={periodKey} onValueChange={(v) => onKeyChange(v as PeriodKey)}>
        <SelectTrigger className="h-9 w-[190px]" aria-label="Período" data-testid="finance-period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {periodKey === "personalizado" ? (
        <>
          <Input
            type="date"
            aria-label="Desde"
            value={custom.from}
            max={custom.to || undefined}
            onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            className="h-9 w-[150px]"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <Input
            type="date"
            aria-label="Hasta"
            value={custom.to}
            min={custom.from || undefined}
            onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            className="h-9 w-[150px]"
          />
        </>
      ) : null}
      <span className="text-xs text-muted-foreground">
        {incomplete ? "Elegí las dos fechas (la segunda no puede ser anterior)." : describePeriod(period)}
      </span>
    </div>
  );
}

export function Segmented<K extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className="grid gap-1 rounded-md bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            value === o.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// `emptyLabel` agrega la opción "sin socio" (por ejemplo "Caja F7"); sin él, hay que elegir un socio.
export function PartnerSelect({
  id,
  value,
  onChange,
  partners,
  emptyLabel,
  excludeId,
  disabled,
  testId,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  partners: F7Partner[];
  emptyLabel?: string;
  excludeId?: string;
  disabled?: boolean;
  testId?: string;
}) {
  const options = partners.filter((p) => p.id !== excludeId && (p.active || p.id === value));
  return (
    <Select value={value || (emptyLabel ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} data-testid={testId}>
        <SelectValue placeholder="Elegí un socio" />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel ? <SelectItem value={NONE}>{emptyLabel}</SelectItem> : null}
        {options.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.active ? p.name : `${p.name} (inactivo)`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CategorySelect({
  id,
  value,
  onChange,
  categories,
  kind,
  testId,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  categories: F7Category[];
  kind: "ingreso" | "gasto";
  testId?: string;
}) {
  const options = categories.filter((c) => c.kind === kind && (c.active || c.id === value));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} data-testid={testId}>
        <SelectValue placeholder="Elegí una categoría" />
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.active ? c.name : `${c.name} (inactiva)`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PaymentMethodSelect({
  id,
  value,
  onChange,
  disabled,
  testId,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const known: readonly string[] = PAYMENT_METHODS;
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sin especificar</SelectItem>
        {value && !known.includes(value) ? <SelectItem value={value}>{value}</SelectItem> : null}
        {PAYMENT_METHODS.map((m) => (
          <SelectItem key={m} value={m}>
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Monto + moneda (+ tipo de cambio cuando es en dólares, con la conversión a guaraníes a la vista).
export function MoneyFields({
  idPrefix,
  amount,
  currency,
  fxRate,
  onAmount,
  onCurrency,
  onFx,
  errors,
  disabled,
  fxHint,
}: {
  idPrefix: string;
  amount: string;
  currency: Currency;
  fxRate: string;
  onAmount: (value: string) => void;
  onCurrency: (value: Currency) => void;
  onFx: (value: string) => void;
  errors: { amount?: string; fx_rate?: string };
  disabled?: boolean;
  fxHint?: string;
}) {
  const usd = currency === "USD";
  const parsed = usd ? parseMoneyInput(amount, "USD") : NaN;
  const fx = usd ? parseFxInput(fxRate) : NaN;
  const preview = usd && Number.isFinite(parsed) && parsed > 0 && Number.isFinite(fx) ? formatGs(toPyg(parsed, "USD", fx)) : null;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-amount`}>Monto</Label>
          <Input
            id={`${idPrefix}-amount`}
            data-testid={`${idPrefix}-amount`}
            inputMode={usd ? "decimal" : "numeric"}
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
            placeholder={usd ? "25" : "150.000"}
            disabled={disabled}
            aria-invalid={!!errors.amount}
          />
          <FieldError message={errors.amount} />
        </div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Segmented
            label="Moneda"
            testId={`${idPrefix}-currency`}
            value={currency}
            onChange={onCurrency}
            disabled={disabled}
            options={[
              { key: "PYG", label: "Guaraníes" },
              { key: "USD", label: "Dólares" },
            ]}
          />
        </div>
      </div>
      {usd ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-fx`}>Tipo de cambio (Gs. por US$)</Label>
          <Input
            id={`${idPrefix}-fx`}
            data-testid={`${idPrefix}-fx`}
            inputMode="decimal"
            value={fxRate}
            onChange={(e) => onFx(e.target.value)}
            placeholder="7.300"
            disabled={disabled}
            aria-invalid={!!errors.fx_rate}
          />
          <p className="text-xs text-muted-foreground">
            {preview ? `Equivale a ${preview}.` : (fxHint ?? "Usá el cambio del día en que se cobró o se pagó.")}
          </p>
          <FieldError message={errors.fx_rate} />
        </div>
      ) : null}
    </div>
  );
}
