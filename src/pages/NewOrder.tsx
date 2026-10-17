import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppOffer } from "@/hooks/useWhatsAppOffer";
import { Button } from "@/components/ui/button";
import DeviceIntakeFields from "@/components/DeviceIntakeFields";
import StepClient from "@/components/new-order/StepClient";
import StepBudget from "@/components/new-order/StepBudget";
import StepReview from "@/components/new-order/StepReview";
import OrderCreated, { type CreatedOrder } from "@/components/new-order/OrderCreated";
import {
  INITIAL_STATE,
  STEPS,
  clearDraft,
  draftHasContent,
  loadDraft,
  parseAmount,
  saveDraft,
  stepBlocker,
  type ClientLite,
  type OrderFormState,
} from "@/components/new-order/state";
import { resolveClientId } from "@/lib/clients";
import { logOrderPayment, STATUS_LABELS } from "@/lib/orders";
import type { PhotoEntry } from "@/lib/photos";
import { cn } from "@/lib/utils";

const LAST_STEP = STEPS.length - 1;
const INGRESO_STEP = 2;

export default function NewOrder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { limits, isStarter } = usePlan();
  const { toast } = useToast();
  const { offerCreation } = useWhatsAppOffer();

  const [initialDraft] = useState(() => {
    const d = loadDraft();
    return d && draftHasContent(d.form) ? d : null;
  });
  const [form, setForm] = useState<OrderFormState>(initialDraft?.form ?? INITIAL_STATE);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialDraft?.selectedClientId ?? null);
  const [showSecondary, setShowSecondary] = useState(
    !!(initialDraft?.form.secondary_phone || initialDraft?.form.secondary_contact_name)
  );
  const [restoredDraft, setRestoredDraft] = useState(!!initialDraft);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [files, setFiles] = useState<PhotoEntry[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  // DeviceIntakeFields guarda estado de UI propio (chips "Otro", PIN/patrón);
  // cambiar esta key lo reinicia limpio al empezar una orden nueva.
  const [formKey, setFormKey] = useState(0);
  const [created, setCreated] = useState<{
    order: CreatedOrder;
    customerCedula: string | null;
    receivedByName: string | null;
  } | null>(null);

  const patch = (p: Partial<OrderFormState>) => setForm((f) => ({ ...f, ...p }));

  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("clients")
      .select("id,name,phone,cedula")
      .eq("company_id", companyId)
      .order("name", { ascending: true })
      .then(({ data }) => setClients((data ?? []) as ClientLite[]));
  }, [companyId]);

  useEffect(() => {
    if (created) return;
    if (draftHasContent(form)) saveDraft(form, selectedClientId);
    else clearDraft();
  }, [form, selectedClientId, created]);

  const resetAll = () => {
    setForm(INITIAL_STATE);
    setFiles((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.previewUrl)); return []; });
    setSelectedClientId(null);
    setShowSecondary(false);
    setNotifyWhatsapp(true);
    setRestoredDraft(false);
    setStep(0);
    setVisited(new Set([0]));
    setFormKey((k) => k + 1);
    clearDraft();
  };

  const goTo = (n: number) => {
    setStep(n);
    setVisited((prev) => (prev.has(n) ? prev : new Set(prev).add(n)));
    if (n > 0) setRestoredDraft(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const canGoTo = (n: number) => {
    if (n <= step) return true;
    for (let i = 0; i < n; i++) if (stepBlocker(i, form)) return false;
    return true;
  };

  const blocker = stepBlocker(step, form);
  const ingresoEmpty =
    files.length === 0 &&
    form.accessories.length === 0 &&
    Object.keys(form.checklist).length === 0 &&
    !form.device_pin &&
    form.device_pattern.length === 0;

  const exit = () => {
    if (!created && draftHasContent(form)) {
      toast({ title: "Guardamos tu borrador", description: "Podés retomar esta orden cuando quieras." });
    }
    navigate("/dashboard");
  };

  const submit = async () => {
    if (!user || loading) return;
    for (const i of [0, 1, 3, 4]) {
      const msg = stepBlocker(i, form);
      if (msg) {
        goTo(i);
        toast({ title: "Faltan datos", description: msg, variant: "destructive" });
        return;
      }
    }

    const quote = parseAmount(form.quote_amount);
    const deposit = parseAmount(form.deposit_amount);

    setLoading(true);
    try {
      const photoUrls: string[] = [];
      for (const { file } of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("order-photos").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("order-photos").getPublicUrl(path);
        photoUrls.push(pub.publicUrl);
      }

      const { data: meProfile } = await supabase
        .from("profiles")
        .select("branch_id, company_id, full_name")
        .eq("id", user.id)
        .maybeSingle();
      const branchId = (meProfile as any)?.branch_id ?? null;
      const profileCompanyId = (meProfile as any)?.company_id as string | undefined;
      const receivedByName = ((meProfile as any)?.full_name as string | null) ?? null;
      if (!profileCompanyId) throw new Error("Tu perfil no tiene una empresa asignada.");

      let clientId = selectedClientId;
      const cedulaNorm = form.customer_cedula.trim() || null;
      if (!clientId) {
        clientId = await resolveClientId({
          companyId: profileCompanyId,
          technicianId: user.id,
          customerName: form.customer_name,
          customerPhone: form.customer_phone || null,
          customerCedula: cedulaNorm,
          notifyWhatsapp,
        });
      } else if (cedulaNorm) {
        await supabase.from("clients").update({ cedula: cedulaNorm }).eq("id", clientId);
      }

      const { data: numData, error: numErr } = await supabase.rpc("generate_order_number", { _company_id: profileCompanyId });
      if (numErr) throw numErr;
      const order_number = numData as string;

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          company_id: profileCompanyId,
          technician_id: user.id,
          assigned_technician_id: form.assigned_technician_id || user.id,
          priority: form.priority ?? "normal",
          received_branch_id: branchId,
          current_branch_id: branchId,
          order_number,
          client_id: clientId,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          secondary_phone: form.secondary_phone || null,
          secondary_contact_name: form.secondary_contact_name || null,
          alternative_phone: form.secondary_phone || null,
          device_type: form.device_type,
          imei: form.imei || null,
          marca: form.marca || null,
          modelo: form.modelo || null,
          problems: form.problems,
          problem_other: form.problems.includes("Otro") ? form.problem_other : null,
          problem_description: form.problem_description || "",
          quote_amount: quote,
          deposit_amount: deposit,
          deposit_payment_method: deposit > 0 ? form.deposit_payment_method : null,
          estimated_delivery_date: form.estimated_delivery_date
            ? format(form.estimated_delivery_date, "yyyy-MM-dd")
            : null,
          photos: photoUrls,
          status: "recibido",
          device_pin: form.device_pin || null,
          device_pattern: form.device_pattern,
          terms_accepted: form.terms_accepted,
          client_signature: form.client_signature || null,
          accessories: form.accessories,
          checklist: Object.entries(form.checklist).map(([label, status]) => ({ label, status })),
          received_by_id: user.id,
          warranty_days: form.warranty_days,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("order_status_history").insert({
        order_id: order.id, status: "recibido", status_label: STATUS_LABELS.recibido, note: "Orden creada",
      });
      if (deposit > 0) {
        logOrderPayment({ orderId: order.id, companyId: profileCompanyId, amount: deposit, method: form.deposit_payment_method || null, userId: user.id });
      }

      try {
        const notificationPhone = order.secondary_phone ? order.secondary_phone : order.customer_phone;
        await supabase.functions.invoke("send-order-notification", {
          body: {
            customer_name: order.customer_name,
            customer_phone: notificationPhone,
            device_type: order.device_type,
            order_number: order.order_number,
            order_code: order.tracking_token,
            app_origin: window.location.origin,
          },
        });
      } catch (e) { console.warn("notification failed", e); }

      if (order.assigned_technician_id && order.assigned_technician_id !== user.id) {
        supabase.functions.invoke("send-technician-notification", {
          body: {
            order_number: order.order_number,
            technician_id: order.assigned_technician_id,
            customer_name: order.customer_name,
            device_type: order.device_type,
          },
        }).catch((e) => console.warn("technician notification failed", e));
      }

      toast({ title: "¡Orden creada!", description: `${order_number} fue registrada.` });
      offerCreation([order.id], "orden_creada");
      setCreated({ order: order as unknown as CreatedOrder, customerCedula: cedulaNorm, receivedByName });
      resetAll();
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCompressing(false);
      setLoading(false);
    }
  };

  const onContinue = () => {
    if (blocker) return;
    if (step === LAST_STEP) submit();
    else goTo(step + 1);
  };

  const isDone = (i: number) => i !== step && visited.has(i) && !(i <= 3 && stepBlocker(i, form));
  const intakeShared = useMemo(
    () => ({
      files,
      onFilesChange: setFiles,
      photoLimit: limits.photos,
      isStarterPlan: isStarter,
    }),
    [files, limits.photos, isStarter]
  );
  const onIntakeChange = (p: Partial<OrderFormState>) => setForm((f) => ({ ...f, ...p }));

  if (created) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              aria-label="Cerrar"
              className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold text-foreground">Nueva orden</h1>
          </div>
        </header>
        <OrderCreated
          order={created.order}
          companyId={companyId}
          customerCedula={created.customerCedula}
          receivedByName={created.receivedByName}
          onView={() => navigate(`/ordenes/${created.order.id}`)}
          onNew={() => { setCreated(null); window.scrollTo({ top: 0, behavior: "auto" }); }}
        />
      </div>
    );
  }

  const continueLabel =
    step === LAST_STEP
      ? loading ? "Creando…" : "Crear orden"
      : step === INGRESO_STEP && ingresoEmpty
        ? "Omitir"
        : "Continuar";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={exit}
            aria-label="Cerrar"
            className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Nueva orden</h1>
        </div>
        <nav aria-label="Pasos" className="mx-auto max-w-3xl px-4 pb-3">
          <ol className="flex items-center">
            {STEPS.map((s, i) => {
              const current = i === step;
              const done = isDone(i);
              const reachable = canGoTo(i);
              return (
                <li key={s.key} className={cn("flex items-center", i < LAST_STEP && "flex-1")}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => goTo(i)}
                    aria-current={current ? "step" : undefined}
                    aria-label={`Paso ${i + 1}: ${s.label}${done ? " (completo)" : ""}`}
                    className="flex shrink-0 items-center gap-2 disabled:cursor-not-allowed"
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                        current || done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground"
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        "hidden text-sm font-medium sm:inline",
                        current ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </span>
                  </button>
                  {i < LAST_STEP && (
                    <span className={cn("mx-2 h-px flex-1 sm:mx-3", done ? "bg-primary" : "bg-border")} />
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground sm:hidden">
            Paso {step + 1} de {STEPS.length} · {STEPS[step].label}
          </p>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-44 pt-6 sm:pt-10">
        <h2 className="text-2xl font-bold text-foreground">{STEPS[step].title}</h2>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{STEPS[step].subtitle}</p>

        {step === 0 && restoredDraft && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Retomamos el borrador de tu última orden sin terminar.</span>
            <button type="button" onClick={resetAll} className="shrink-0 font-medium text-primary hover:underline">
              Empezar de cero
            </button>
          </div>
        )}

        {step === 0 && (
          <StepClient
            form={form}
            patch={patch}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            clients={clients}
            companyId={companyId}
            notifyWhatsapp={notifyWhatsapp}
            setNotifyWhatsapp={setNotifyWhatsapp}
            showSecondary={showSecondary}
            setShowSecondary={setShowSecondary}
          />
        )}

        {visited.has(1) && (
          <div hidden={step !== 1}>
            <DeviceIntakeFields
              key={`equipo-${formKey}`}
              idPrefix="order"
              value={form}
              onChange={onIntakeChange}
              sections={["equipo"]}
              bare
              {...intakeShared}
            />
          </div>
        )}

        {visited.has(2) && (
          <div hidden={step !== 2}>
            <DeviceIntakeFields
              key={`ingreso-${formKey}`}
              idPrefix="order_ingreso"
              value={form}
              onChange={onIntakeChange}
              sections={["fotos", "accesorios", "checklist", "seguridad"]}
              bare
              onCompressingChange={setCompressing}
              {...intakeShared}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <StepBudget form={form} patch={patch} />
            <DeviceIntakeFields
              key={`asignacion-${formKey}`}
              idPrefix="order_asig"
              value={form}
              onChange={onIntakeChange}
              sections={["asignacion"]}
              bare
              {...intakeShared}
            />
          </div>
        )}

        {step === 4 && <StepReview form={form} patch={patch} photoCount={files.length} goTo={goTo} />}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {blocker && <p className="mb-2 text-center text-xs text-muted-foreground">{blocker}</p>}
          <div className="flex gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" className="h-12 flex-1 sm:flex-none sm:px-8" onClick={() => goTo(step - 1)} disabled={loading}>
                Volver
              </Button>
            )}
            <Button
              type="button"
              className="h-12 flex-[2] sm:flex-1"
              onClick={onContinue}
              disabled={!!blocker || loading || compressing}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {compressing ? "Optimizando fotos…" : continueLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
