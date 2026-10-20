/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Ban, Loader2, Printer, Receipt as ReceiptIcon, Search } from "lucide-react";
import { PLAN_LABELS, type Cycle, type PlanType } from "@/lib/plans";
import {
  CURRENCY_LABELS,
  CYCLE_LABELS,
  DEFAULT_ISSUER_NAME,
  PAYMENT_METHODS,
  buildSubscriptionReceiptHtml,
  computePeriodEnd,
  defaultAmount,
  defaultDescription,
  formatDateISO,
  formatMoney,
  parseMoneyInput,
  printSubscriptionReceipt,
  todayInAsuncion,
  validateDraft,
  type ReceiptCurrency,
  type ReceiptDraft,
  type ReceiptErrors,
  type SubscriptionReceipt,
} from "@/lib/subscriptionReceipt";

const db = supabase as any;

interface CompanyOption {
  id: string;
  name: string;
  plan_type: string;
}

interface FormState {
  company_id: string;
  customer_name: string;
  customer_document: string;
  customer_email: string;
  customer_phone: string;
  plan_type: PlanType;
  billing_cycle: Cycle;
  currency: ReceiptCurrency;
  amount: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  payment_method: string;
  payment_reference: string;
  description: string;
  notes: string;
  issuer_name: string;
  issuer_details: string;
}

// Los campos que el sistema sugiere solos (monto, vencimiento, descripción)
// dejan de seguirlo en cuanto el super admin los escribe a mano.
interface Touched {
  amount: boolean;
  period_end: boolean;
  description: boolean;
  issuer: boolean;
}

const NO_COMPANY = "none";
const PLAN_ORDER: PlanType[] = ["starter", "pro", "business", "retail"];
const CYCLES: Cycle[] = ["mensual", "semestral", "anual"];
const NO_TOUCH: Touched = { amount: false, period_end: false, description: false, issuer: false };

function amountToInput(value: number, currency: ReceiptCurrency): string {
  return currency === "PYG" ? value.toLocaleString("es-PY") : String(value).replace(".", ",");
}

function emptyForm(today: string): FormState {
  return {
    company_id: NO_COMPANY,
    customer_name: "",
    customer_document: "",
    customer_email: "",
    customer_phone: "",
    plan_type: "pro",
    billing_cycle: "mensual",
    currency: "PYG",
    amount: "",
    period_start: today,
    period_end: "",
    payment_date: today,
    payment_method: PAYMENT_METHODS[0],
    payment_reference: "",
    description: "",
    notes: "",
    issuer_name: DEFAULT_ISSUER_NAME,
    issuer_details: "",
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

function ReceiptPreview({ html }: { html: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / 794));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrap} className="w-full overflow-hidden rounded-md border bg-white" style={{ height: 1123 * scale }}>
      <iframe
        title="Vista previa del recibo"
        srcDoc={html}
        sandbox=""
        data-testid="receipt-preview"
        style={{ width: 794, height: 1123, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}
      />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export default function SuperAdminReceipts() {
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const today = useMemo(() => todayInAsuncion(), []);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [receipts, setReceipts] = useState<SubscriptionReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(() => emptyForm(todayInAsuncion()));
  const [touched, setTouched] = useState<Touched>(NO_TOUCH);
  const [errors, setErrors] = useState<ReceiptErrors>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [voidTarget, setVoidTarget] = useState<SubscriptionReceipt | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  useEffect(() => { document.title = "Recibos de pagos — F7 Manager Pro"; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [companiesRes, receiptsRes] = await Promise.all([
      db.from("companies").select("id, name, plan_type").order("name"),
      db.from("subscription_receipts").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (companiesRes.error) toast.error("No se pudieron cargar las empresas");
    if (receiptsRes.error) toast.error("No se pudieron cargar los recibos", { description: receiptsRes.error.message });
    setCompanies((companiesRes.data ?? []) as CompanyOption[]);
    const rows = ((receiptsRes.data ?? []) as SubscriptionReceipt[]).map((r) => ({ ...r, amount: Number(r.amount) }));
    setReceipts(rows);
    // El emisor se hereda del último recibo para no volver a escribirlo.
    const last = rows[0];
    if (last) {
      setForm((prev) => (touched.issuer ? prev : { ...prev, issuer_name: last.issuer_name, issuer_details: last.issuer_details ?? "" }));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void load();
  }, [isSuperAdmin, load]);

  const suggestedAmount = defaultAmount(form.plan_type, form.billing_cycle, form.currency);
  const amountText = touched.amount ? form.amount : amountToInput(suggestedAmount, form.currency);
  const periodEnd = touched.period_end
    ? form.period_end
    : form.period_start
      ? computePeriodEnd(form.period_start, form.billing_cycle)
      : "";
  const description = touched.description ? form.description : defaultDescription(form.plan_type, form.billing_cycle);

  const draft: ReceiptDraft = useMemo(
    () => ({
      company_id: form.company_id === NO_COMPANY ? null : form.company_id,
      customer_name: form.customer_name,
      customer_document: orNull(form.customer_document),
      customer_email: orNull(form.customer_email),
      customer_phone: orNull(form.customer_phone),
      plan_type: form.plan_type,
      billing_cycle: form.billing_cycle,
      period_start: form.period_start,
      period_end: periodEnd,
      payment_date: form.payment_date,
      amount: parseMoneyInput(amountText, form.currency),
      currency: form.currency,
      payment_method: form.payment_method,
      payment_reference: orNull(form.payment_reference),
      description,
      notes: orNull(form.notes),
      issuer_name: form.issuer_name,
      issuer_details: orNull(form.issuer_details),
    }),
    [form, amountText, periodEnd, description]
  );

  const previewHtml = useMemo(
    () =>
      buildSubscriptionReceiptHtml(
        {
          ...draft,
          amount: Number.isFinite(draft.amount) ? draft.amount : 0,
          id: "preview",
          receipt_number: "F7-____",
          created_at: new Date().toISOString(),
          voided_at: null,
          void_reason: null,
        },
        { logoUrl: `${window.location.origin}/f7-logo.png` }
      ),
    [draft]
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const pickCompany = (id: string) => {
    if (id === NO_COMPANY) {
      set("company_id", NO_COMPANY);
      return;
    }
    const company = companies.find((c) => c.id === id);
    if (!company) return;
    const plan = PLAN_ORDER.includes(company.plan_type as PlanType) ? (company.plan_type as PlanType) : form.plan_type;
    setForm((prev) => ({ ...prev, company_id: id, customer_name: company.name, plan_type: plan }));
  };

  const changeCurrency = (currency: ReceiptCurrency) => {
    setForm((prev) => ({ ...prev, currency }));
    setTouched((prev) => ({ ...prev, amount: false }));
  };

  const submit = async () => {
    const found = validateDraft(draft, today);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Revisá los datos marcados en rojo");
      return;
    }
    setSaving(true);
    const { data, error } = await db.from("subscription_receipts").insert(draft).select("*").single();
    setSaving(false);
    if (error || !data) {
      toast.error("No se pudo generar el recibo", { description: error?.message });
      return;
    }
    const saved: SubscriptionReceipt = { ...data, amount: Number(data.amount) };
    setReceipts((prev) => [saved, ...prev]);
    toast.success(`Recibo ${saved.receipt_number} generado`);
    printSubscriptionReceipt(saved);
    setForm((prev) => ({ ...emptyForm(todayInAsuncion()), issuer_name: prev.issuer_name, issuer_details: prev.issuer_details }));
    setTouched((prev) => ({ ...NO_TOUCH, issuer: prev.issuer }));
    setErrors({});
  };

  const confirmVoid = async () => {
    if (!voidTarget) return;
    const reason = voidReason.trim();
    if (!reason) {
      toast.error("Escribí el motivo de la anulación");
      return;
    }
    setVoiding(true);
    const { data, error } = await db
      .from("subscription_receipts")
      .update({ voided_at: new Date().toISOString(), void_reason: reason })
      .eq("id", voidTarget.id)
      .select("*")
      .single();
    setVoiding(false);
    if (error || !data) {
      toast.error("No se pudo anular el recibo", { description: error?.message });
      return;
    }
    setReceipts((prev) => prev.map((r) => (r.id === data.id ? { ...data, amount: Number(data.amount) } : r)));
    toast.success(`Recibo ${voidTarget.receipt_number} anulado`);
    setVoidTarget(null);
    setVoidReason("");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) =>
      [r.receipt_number, r.customer_name, r.customer_document ?? "", PLAN_LABELS[r.plan_type] ?? r.plan_type]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [receipts, search]);

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const listPrice = amountToInput(suggestedAmount, form.currency);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ReceiptIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Recibos de pagos</h1>
            <p className="text-sm text-muted-foreground">
              Generá el recibo de lo que te paga cada negocio por su plan de F7 Manager Pro. Queda guardado con número
              correlativo y se puede volver a imprimir o guardar como PDF.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Nuevo recibo</CardTitle>
              <CardDescription>
                El plan, el monto, el vencimiento y la descripción se completan solos con la lista de precios; podés
                cambiarlos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quién pagó</h2>
                <div>
                  <Label htmlFor="rc-company">Negocio en F7 Manager</Label>
                  <Select value={form.company_id} onValueChange={pickCompany}>
                    <SelectTrigger id="rc-company" data-testid="rc-company"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_COMPANY}>Sin cuenta todavía / otro</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rc-name">Nombre o razón social</Label>
                  <Input id="rc-name" data-testid="rc-name" value={form.customer_name} maxLength={150} onChange={(e) => set("customer_name", e.target.value)} />
                  <FieldError message={errors.customer_name} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="rc-doc">RUC / Cédula</Label>
                    <Input id="rc-doc" value={form.customer_document} maxLength={40} onChange={(e) => set("customer_document", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="rc-email">Correo</Label>
                    <Input id="rc-email" type="email" value={form.customer_email} maxLength={150} onChange={(e) => set("customer_email", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="rc-phone">Teléfono</Label>
                    <Input id="rc-phone" value={form.customer_phone} maxLength={40} onChange={(e) => set("customer_phone", e.target.value)} />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan y monto</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="rc-plan">Plan</Label>
                    <Select value={form.plan_type} onValueChange={(v) => set("plan_type", v as PlanType)}>
                      <SelectTrigger id="rc-plan" data-testid="rc-plan"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLAN_ORDER.map((p) => (
                          <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rc-cycle">Ciclo</Label>
                    <Select value={form.billing_cycle} onValueChange={(v) => set("billing_cycle", v as Cycle)}>
                      <SelectTrigger id="rc-cycle" data-testid="rc-cycle"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CYCLES.map((c) => (
                          <SelectItem key={c} value={c}>{CYCLE_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rc-currency">Moneda</Label>
                    <Select value={form.currency} onValueChange={(v) => changeCurrency(v as ReceiptCurrency)}>
                      <SelectTrigger id="rc-currency" data-testid="rc-currency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CURRENCY_LABELS) as ReceiptCurrency[]).map((c) => (
                          <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="rc-amount">Monto recibido</Label>
                  <Input
                    id="rc-amount"
                    data-testid="rc-amount"
                    inputMode="decimal"
                    value={amountText}
                    onChange={(e) => {
                      set("amount", e.target.value);
                      setTouched((prev) => ({ ...prev, amount: true }));
                    }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Precio de lista: {formatMoney(suggestedAmount, form.currency)}
                    {touched.amount && amountText !== listPrice && (
                      <button
                        type="button"
                        className="ml-2 font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => setTouched((prev) => ({ ...prev, amount: false }))}
                      >
                        Usar el de lista
                      </button>
                    )}
                  </p>
                  <FieldError message={errors.amount} />
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fechas</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="rc-start">Adquirió el plan</Label>
                    <Input id="rc-start" data-testid="rc-start" type="date" value={form.period_start} onChange={(e) => set("period_start", e.target.value)} />
                    <FieldError message={errors.period_start} />
                  </div>
                  <div>
                    <Label htmlFor="rc-end">Vigente hasta</Label>
                    <Input
                      id="rc-end"
                      data-testid="rc-end"
                      type="date"
                      value={periodEnd}
                      onChange={(e) => {
                        set("period_end", e.target.value);
                        setTouched((prev) => ({ ...prev, period_end: true }));
                      }}
                    />
                    <FieldError message={errors.period_end} />
                  </div>
                  <div>
                    <Label htmlFor="rc-paid">Fecha de pago</Label>
                    <Input id="rc-paid" data-testid="rc-paid" type="date" max={today} value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} />
                    <FieldError message={errors.payment_date} />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pago</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rc-method">Medio de pago</Label>
                    <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                      <SelectTrigger id="rc-method" data-testid="rc-method"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={errors.payment_method} />
                  </div>
                  <div>
                    <Label htmlFor="rc-ref">N° de comprobante o referencia</Label>
                    <Input id="rc-ref" value={form.payment_reference} maxLength={120} onChange={(e) => set("payment_reference", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="rc-desc">Descripción</Label>
                  <Input
                    id="rc-desc"
                    data-testid="rc-desc"
                    value={description}
                    maxLength={500}
                    onChange={(e) => {
                      set("description", e.target.value);
                      setTouched((prev) => ({ ...prev, description: true }));
                    }}
                  />
                  <FieldError message={errors.description} />
                </div>
                <div>
                  <Label htmlFor="rc-notes">Observaciones (opcional)</Label>
                  <Textarea id="rc-notes" rows={2} value={form.notes} maxLength={1000} onChange={(e) => set("notes", e.target.value)} />
                </div>
              </section>

              <details className="rounded-md border p-3" data-testid="rc-issuer">
                <summary className="cursor-pointer text-sm font-medium">Datos de quien emite (F7)</summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <Label htmlFor="rc-issuer-name">Nombre</Label>
                    <Input
                      id="rc-issuer-name"
                      value={form.issuer_name}
                      maxLength={150}
                      onChange={(e) => {
                        set("issuer_name", e.target.value);
                        setTouched((prev) => ({ ...prev, issuer: true }));
                      }}
                    />
                    <FieldError message={errors.issuer_name} />
                  </div>
                  <div>
                    <Label htmlFor="rc-issuer-details">RUC, dirección, contacto (una línea por dato)</Label>
                    <Textarea
                      id="rc-issuer-details"
                      rows={3}
                      value={form.issuer_details}
                      maxLength={500}
                      onChange={(e) => {
                        set("issuer_details", e.target.value);
                        setTouched((prev) => ({ ...prev, issuer: true }));
                      }}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Se recuerda para los próximos recibos.</p>
                  </div>
                </div>
              </details>

              <Button className="w-full" size="lg" onClick={() => void submit()} disabled={saving} data-testid="rc-submit">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Generar recibo e imprimir
              </Button>
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-2 lg:sticky lg:top-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Vista previa</h2>
              <span className="text-xs text-muted-foreground">El número se asigna al generar</span>
            </div>
            <ReceiptPreview html={previewHtml} />
          </div>
        </div>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div>
              <CardTitle>Recibos emitidos</CardTitle>
              <CardDescription>{receipts.length} en total. Un recibo no se edita: si hay un error, se anula y se emite otro.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por número, cliente o plan" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="rc-search" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {receipts.length === 0 ? "Todavía no emitiste ningún recibo." : "Ningún recibo coincide con la búsqueda."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table data-testid="rc-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Vigente hasta</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id} data-testid={`rc-row-${r.receipt_number}`} className={r.voided_at ? "text-muted-foreground" : undefined}>
                        <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateISO(r.payment_date)}</TableCell>
                        <TableCell className="max-w-[16rem] truncate" title={r.customer_name}>{r.customer_name}</TableCell>
                        <TableCell className="whitespace-nowrap">{PLAN_LABELS[r.plan_type] ?? r.plan_type} · {CYCLE_LABELS[r.billing_cycle] ?? r.billing_cycle}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateISO(r.period_end)}</TableCell>
                        <TableCell className={`whitespace-nowrap text-right font-medium ${r.voided_at ? "line-through" : ""}`}>{formatMoney(r.amount, r.currency)}</TableCell>
                        <TableCell>
                          {r.voided_at ? (
                            <Badge variant="destructive" title={r.void_reason ?? undefined}>Anulado</Badge>
                          ) : (
                            <Badge variant="outline">Emitido</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button size="sm" variant="outline" onClick={() => printSubscriptionReceipt(r)} data-testid={`rc-print-${r.receipt_number}`}>
                            <Printer className="mr-1.5 h-3.5 w-3.5" /> Imprimir
                          </Button>
                          {!r.voided_at && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-1 text-destructive hover:text-destructive"
                              onClick={() => { setVoidTarget(r); setVoidReason(""); }}
                              data-testid={`rc-void-${r.receipt_number}`}
                            >
                              <Ban className="mr-1.5 h-3.5 w-3.5" /> Anular
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!voidTarget} onOpenChange={(open) => { if (!open && !voiding) setVoidTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular el recibo {voidTarget?.receipt_number}</DialogTitle>
            <DialogDescription>
              Queda en el historial marcado como anulado y su número no se vuelve a usar. Si el pago sí existió, emití un recibo nuevo con los datos correctos.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="rc-void-reason">Motivo</Label>
            <Textarea id="rc-void-reason" data-testid="rc-void-reason" rows={3} maxLength={300} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={voiding}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void confirmVoid()} disabled={voiding || !voidReason.trim()} data-testid="rc-void-confirm">
              {voiding ? "Anulando..." : "Anular recibo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
