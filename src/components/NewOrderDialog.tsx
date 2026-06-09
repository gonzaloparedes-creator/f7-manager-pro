import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { PROBLEM_OPTIONS, formatPYG, DEFAULT_SERVICE_TERMS } from "@/lib/orders";
import WarrantySelector from "@/components/WarrantySelector";
import { Upload, X, CalendarIcon, Search, UserPlus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { PatternLock } from "@/components/PatternLock";
import { SignaturePad } from "@/components/SignaturePad";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

type ClientLite = { id: string; name: string; phone: string | null; cedula: string | null };


type FormState = {
  customer_name: string;
  customer_phone: string;
  secondary_phone: string;
  secondary_contact_name: string;
  customer_cedula: string;
  device_type: string;
  imei: string;
  problems: string[];
  problem_other: string;
  problem_description: string; // observaciones iniciales
  quote_amount: string;
  deposit_amount: string;
  estimated_delivery_date: Date | undefined;
  device_pin: string;
  device_pattern: number[];
  terms_accepted: boolean;
  client_signature: string;
  has_sim: boolean;
  has_sd: boolean;
  has_esim: boolean;
  has_case: boolean;
  warranty_days: number;
};

const INITIAL_STATE: FormState = {
  customer_name: "",
  customer_phone: "",
  secondary_phone: "",
  secondary_contact_name: "",
  customer_cedula: "",
  device_type: "",
  imei: "",
  problems: [],
  problem_other: "",
  problem_description: "",
  quote_amount: "",
  deposit_amount: "",
  estimated_delivery_date: undefined,
  device_pin: "",
  device_pattern: [],
  terms_accepted: false,
  client_signature: "",
  has_sim: false,
  has_sd: false,
  has_esim: false,
  has_case: false,
  warranty_days: 30,
};

export default function NewOrderDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const DRAFT_KEY = "f7_order_draft";
  const loadDraft = (): { form: FormState; selectedClientId: string | null } | null => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const f = parsed.form as FormState;
      if (f && f.estimated_delivery_date) {
        f.estimated_delivery_date = new Date(f.estimated_delivery_date as any);
      }
      return { form: { ...INITIAL_STATE, ...f }, selectedClientId: parsed.selectedClientId ?? null };
    } catch {
      return null;
    }
  };
  const initialDraft = loadDraft();
  const [form, setForm] = useState<FormState>(initialDraft?.form ?? INITIAL_STATE);
  const [files, setFiles] = useState<File[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialDraft?.selectedClientId ?? null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showSecondaryContact, setShowSecondaryContact] = useState(() => {
    const d = loadDraft();
    return !!(d?.form?.secondary_phone || d?.form?.secondary_contact_name);
  });

  useEffect(() => {
    if (!open || !user || !companyId) return;
    supabase
      .from("clients")
      .select("id,name,phone,cedula")
      .eq("company_id", companyId)
      .order("name", { ascending: true })
      .then(({ data }) => setClients((data ?? []) as ClientLite[]));
  }, [open, user, companyId]);

  // Auto-save draft to localStorage on every form change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, selectedClientId }));
    } catch {
      // ignore quota / serialization errors
    }
  }, [form, selectedClientId]);

  // Reload draft when modal is reopened (covers tab switches that don't unmount)
  useEffect(() => {
    if (!open) return;
    const d = loadDraft();
    if (d) {
      setForm(d.form);
      setSelectedClientId(d.selectedClientId);
      setShowSecondaryContact(!!(d.form.secondary_phone || d.form.secondary_contact_name));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = (clearDraft = false) => {
    setForm(INITIAL_STATE);
    setFiles([]);
    setSelectedClientId(null);
    setClientSearch("");
    setShowSecondaryContact(false);
    if (clearDraft) {
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    }
  };


  const toggleProblem = (p: string) => {
    setForm((f) => ({
      ...f,
      problems: f.problems.includes(p) ? f.problems.filter((x) => x !== p) : [...f.problems, p],
    }));
  };

  const parseAmount = (s: string) => {
    const digits = s.replace(/\D/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };

  const quote = useMemo(() => parseAmount(form.quote_amount), [form.quote_amount]);
  const deposit = useMemo(() => parseAmount(form.deposit_amount), [form.deposit_amount]);
  const balance = Math.max(0, quote - deposit);

  const formatThousands = (s: string) => {
    const n = parseAmount(s);
    return n ? n.toLocaleString("es-PY") : "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (form.problems.length === 0) {
      toast({ title: "Faltan datos", description: "Seleccioná al menos un problema.", variant: "destructive" });
      return;
    }
    if (form.problems.includes("Otro") && !form.problem_other.trim()) {
      toast({ title: "Faltan datos", description: "Describí el problema 'Otro'.", variant: "destructive" });
      return;
    }
    if (deposit > quote) {
      toast({ title: "Importes inválidos", description: "La seña no puede superar al presupuesto.", variant: "destructive" });
      return;
    }
    if (!form.terms_accepted) {
      toast({ title: "Faltan datos", description: "El cliente debe aceptar los términos del servicio.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Upload photos
      const photoUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("order-photos").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("order-photos").getPublicUrl(path);
        photoUrls.push(pub.publicUrl);
      }

      // Resolve creator's company + branch (needed for tenant-scoped inserts)
      const { data: meProfile } = await supabase
        .from("profiles")
        .select("branch_id, company_id")
        .eq("id", user.id)
        .maybeSingle();
      const branchId = (meProfile as any)?.branch_id ?? null;
      const companyId = (meProfile as any)?.company_id as string | undefined;
      if (!companyId) throw new Error("Tu perfil no tiene una empresa asignada.");

      // Resolve client: use selected, otherwise upsert by phone
      let clientId = selectedClientId;
      const cedulaNorm = form.customer_cedula.trim() || null;
      if (!clientId) {
        const phoneNorm = form.customer_phone || null;
        if (phoneNorm) {
          const { data: existing } = await supabase
            .from("clients")
            .select("id,cedula")
            .eq("technician_id", user.id)
            .eq("phone", phoneNorm)
            .maybeSingle();
          if (existing?.id) {
            clientId = existing.id;
            // Backfill cedula if newly provided and not already set
            if (cedulaNorm && !existing.cedula) {
              await supabase.from("clients").update({ cedula: cedulaNorm }).eq("id", clientId);
            }
          } else {
            const { data: created, error: cErr } = await supabase
              .from("clients")
              .insert({ company_id: companyId, technician_id: user.id, name: form.customer_name || "Cliente", phone: phoneNorm, cedula: cedulaNorm })
              .select("id")
              .single();
            if (cErr) throw cErr;
            clientId = created.id;
          }
        } else {
          const { data: created, error: cErr } = await supabase
            .from("clients")
            .insert({ company_id: companyId, technician_id: user.id, name: form.customer_name || "Cliente", phone: null, cedula: cedulaNorm })
            .select("id")
            .single();
          if (cErr) throw cErr;
          clientId = created.id;
        }
      } else if (cedulaNorm) {
        // Selected existing client — update cedula if provided/changed
        await supabase.from("clients").update({ cedula: cedulaNorm }).eq("id", clientId);
      }

      // Get next ORD-XXXX number from DB
      const { data: numData, error: numErr } = await supabase.rpc("generate_order_number");
      if (numErr) throw numErr;
      const order_number = numData as string;

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          company_id: companyId,
          technician_id: user.id,
          assigned_technician_id: user.id,
          received_branch_id: branchId,
          current_branch_id: branchId,
          order_number,
          client_id: clientId,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          secondary_phone: form.secondary_phone || null,
          secondary_contact_name: form.secondary_contact_name || null,
          alternative_phone: form.secondary_phone || null, // Guardamos también en alternative para compatibilidad
          device_type: form.device_type,
          imei: form.imei || null,
          problems: form.problems,
          problem_other: form.problems.includes("Otro") ? form.problem_other : null,
          problem_description: form.problem_description || "",
          quote_amount: quote,
          deposit_amount: deposit,
          estimated_delivery_date: form.estimated_delivery_date
            ? format(form.estimated_delivery_date, "yyyy-MM-dd")
            : null,
          photos: photoUrls,
          status: "recibido",
          device_pin: form.device_pin || null,
          device_pattern: form.device_pattern,
          terms_accepted: form.terms_accepted,
          client_signature: form.client_signature || null,
          has_sim: form.has_sim,
          has_sd: form.has_sd,
          has_esim: form.has_esim,
          has_case: form.has_case,
          received_by_id: user.id,
          warranty_days: form.warranty_days,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("order_status_history").insert({
        order_id: order.id, status: "recibido", note: "Orden creada",
      });

      try {
        const notificationPhone = order.secondary_phone ? order.secondary_phone : order.customer_phone;
        await supabase.functions.invoke("send-order-notification", {
          body: {
            customer_name: order.customer_name,
            customer_phone: notificationPhone,
            device_type: order.device_type,
            order_number: order.order_number,
            order_code: order.order_number,
            app_origin: window.location.origin,
          },
        });
      } catch (e) { console.warn("notification failed", e); }

      toast({ title: "¡Orden creada!", description: `${order_number} fue registrada.` });
      reset(true);
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva orden</DialogTitle>
          <DialogDescription>Registrá un nuevo equipo para reparación.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Sección: Cliente */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Datos del cliente</h3>
              {selectedClientId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedClientId(null);
                    setForm((f) => ({ ...f, customer_name: "", customer_phone: "", customer_cedula: "" }));
                  }}
                >
                  <X className="mr-1 h-3 w-3" /> Cambiar
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Buscar cliente existente o crear nuevo</Label>
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start font-normal">
                    <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                    {selectedClientId
                      ? <span>{form.customer_name} <span className="text-muted-foreground">· {form.customer_phone}</span></span>
                      : <span className="text-muted-foreground">Buscar por nombre o teléfono…</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      // value is "name|phone" lowercased; search is what the user types
                      const s = search.toLowerCase();
                      return value.toLowerCase().includes(s) ? 1 : 0;
                    }}
                  >
                    <CommandInput
                      placeholder="Escribí nombre o teléfono…"
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md"
                          onClick={() => {
                            const isPhone = /^\d+$/.test(clientSearch.replace(/\D/g, "")) && clientSearch.replace(/\D/g, "").length >= 6;
                            const digits = clientSearch.replace(/\D/g, "");
                            setSelectedClientId(null);
                            setForm((f) => ({
                              ...f,
                              customer_name: isPhone ? "" : clientSearch,
                              customer_phone: isPhone ? `595${digits.replace(/^595/, "")}` : "",
                            }));
                            setClientSearchOpen(false);
                          }}
                        >
                          <UserPlus className="h-4 w-4" />
                          Crear nuevo cliente: <strong>{clientSearch || "…"}</strong>
                        </button>
                      </CommandEmpty>
                      <CommandGroup heading="Clientes">
                        {clients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name}|${c.phone ?? ""}`}
                            onSelect={() => {
                              setSelectedClientId(c.id);
                              setForm((f) => ({
                                ...f,
                                customer_name: c.name,
                                customer_phone: c.phone ?? "",
                                customer_cedula: c.cedula ?? "",
                              }));
                              setClientSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span>{c.name}</span>
                              <span className="text-xs text-muted-foreground">{c.phone ?? "Sin teléfono"}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Cliente *</Label>
                <Input id="customer_name" required value={form.customer_name}
                  onChange={(e) => { setForm({ ...form, customer_name: e.target.value }); setSelectedClientId(null); }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_phone">Teléfono *</Label>
                <div className="flex gap-2">
                  <PhoneInput
                    country={"py"}
                    value={"595"}
                    onChange={() => {}}
                    inputProps={{ readOnly: true, tabIndex: -1, "aria-hidden": true }}
                    specialLabel=""
                    disableDropdown={false}
                    countryCodeEditable={false}
                    inputClass="!w-24 !h-10 !text-sm !bg-background !text-foreground !border-input !rounded-md !pl-14 !cursor-default"
                    buttonClass="!bg-background !border-input !rounded-l-md"
                    dropdownClass="!bg-popover !text-popover-foreground"
                    containerClass="!w-auto"
                  />
                  <Input
                    type="tel"
                    placeholder="981 123 456"
                    value={form.customer_phone.replace(/^595/, "")}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      setForm({ ...form, customer_phone: `595${digits}` });
                      setSelectedClientId(null);
                    }}
                    className="flex-1"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  const next = !showSecondaryContact;
                  setShowSecondaryContact(next);
                  if (!next) {
                    setForm((f) => ({ ...f, secondary_phone: "", secondary_contact_name: "" }));
                  }
                }}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1.5"
              >
                {showSecondaryContact ? "- Quitar contacto secundario" : "+ Enviar notificaciones a contacto secundario"}
              </button>
            </div>

            {showSecondaryContact && (
              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="secondary_phone">Teléfono de notificaciones (Opcional)</Label>
                  <div className="flex gap-2">
                    <PhoneInput
                      country={"py"}
                      value={"595"}
                      onChange={() => {}}
                      inputProps={{ readOnly: true, tabIndex: -1, "aria-hidden": true }}
                      specialLabel=""
                      disableDropdown={false}
                      countryCodeEditable={false}
                      inputClass="!w-24 !h-10 !text-sm !bg-background !text-foreground !border-input !rounded-md !pl-14 !cursor-default"
                      buttonClass="!bg-background !border-input !rounded-l-md"
                      dropdownClass="!bg-popover !text-popover-foreground"
                      containerClass="!w-auto"
                    />
                    <Input
                      id="secondary_phone"
                      type="tel"
                      placeholder="981 123 456"
                      value={form.secondary_phone.replace(/^595/, "")}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setForm({ ...form, secondary_phone: digits ? `595${digits}` : "" });
                      }}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Recibirá los mensajes de estado.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_contact_name">Titular del número</Label>
                  <Input
                    id="secondary_contact_name"
                    placeholder="Ej. Esposa, Hermano"
                    value={form.secondary_contact_name}
                    onChange={(e) => setForm({ ...form, secondary_contact_name: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="customer_cedula">Cédula de Identidad (opcional)</Label>
              <Input
                id="customer_cedula"
                inputMode="numeric"
                placeholder="1.234.567"
                value={form.customer_cedula}
                onChange={(e) => setForm({ ...form, customer_cedula: e.target.value })}
              />
            </div>
          </section>

          {/* Sección: Equipo y problemas */}
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Equipo y problemas</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="device_type">Equipo *</Label>
                <Input id="device_type" required placeholder="iPhone 13, Apple Watch S8…" value={form.device_type}
                  onChange={(e) => setForm({ ...form, device_type: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imei">IMEI / Nº de Serie</Label>
                <Input id="imei" placeholder="356938035643809" value={form.imei}
                  onChange={(e) => setForm({ ...form, imei: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Problemas detectados *</Label>
              <div className="flex flex-wrap gap-2">
                {PROBLEM_OPTIONS.map((p) => {
                  const active = form.problems.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleProblem(p)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.problems.includes("Otro") && (
              <div className="space-y-2">
                <Label htmlFor="problem_other">Especificá "Otro" *</Label>
                <Input id="problem_other" placeholder="Describí el problema..." value={form.problem_other}
                  onChange={(e) => setForm({ ...form, problem_other: e.target.value })} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="problem">Observaciones iniciales</Label>
              <Textarea id="problem" rows={3}
                placeholder="Estado estético, accesorios entregados, contraseña, etc."
                value={form.problem_description}
                onChange={(e) => setForm({ ...form, problem_description: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Fotos</Label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-4 text-sm text-muted-foreground hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  Galería
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/gif,image/bmp,image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      setFiles([...files, ...Array.from(e.target.files ?? [])]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-4 text-sm text-muted-foreground hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  Cámara
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      setFiles([...files, ...Array.from(e.target.files ?? [])]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="relative">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 rounded-md object-cover" />
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Sección: Accesorios y Componentes */}
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Accesorios y Componentes</h3>
            <p className="text-xs text-muted-foreground">
              Marcá lo que el cliente entrega junto al equipo.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                { key: "has_sim", label: "SIM Card" },
                { key: "has_sd", label: "Micro SD" },
                { key: "has_esim", label: "eSIM" },
                { key: "has_case", label: "Funda/Carcasa" },
              ] as const).map((acc) => (
                <div
                  key={acc.key}
                  className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2"
                >
                  <Label htmlFor={acc.key} className="text-sm font-normal cursor-pointer">
                    {acc.label}
                  </Label>
                  <Switch
                    id={acc.key}
                    checked={form[acc.key]}
                    onCheckedChange={(c) => setForm({ ...form, [acc.key]: c === true })}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Sección: Financiero */}
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Información financiera</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="quote_amount">Presupuesto (Gs.)</Label>
                <Input
                  id="quote_amount"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatThousands(form.quote_amount)}
                  onChange={(e) => setForm({ ...form, quote_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit_amount">Seña (Gs.)</Label>
                <Input
                  id="deposit_amount"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatThousands(form.deposit_amount)}
                  onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Saldo</Label>
                <div className={cn(
                  "flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold",
                  balance > 0 ? "text-foreground" : "text-muted-foreground"
                )}>
                  {formatPYG(balance)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fecha estimada de entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal sm:w-[280px]",
                      !form.estimated_delivery_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.estimated_delivery_date
                      ? format(form.estimated_delivery_date, "PPP", { locale: es })
                      : <span>Elegí una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.estimated_delivery_date}
                    onSelect={(d) => setForm({ ...form, estimated_delivery_date: d })}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    locale={es}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Tiempo de garantía</Label>
              <WarrantySelector
                value={form.warranty_days}
                onChange={(d) => setForm({ ...form, warranty_days: d })}
              />
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Seguridad del equipo</h3>
            <p className="text-xs text-muted-foreground">
              Datos opcionales para que el técnico pueda acceder al equipo durante la reparación.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="device_pin">PIN / Contraseña</Label>
                <Input
                  id="device_pin"
                  type="text"
                  autoComplete="off"
                  placeholder="Ej: 1234 o contraseña"
                  value={form.device_pin}
                  onChange={(e) => setForm({ ...form, device_pin: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Se guarda asociado a la orden y solo es visible para el técnico.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Patrón de desbloqueo (Android)</Label>
                <div className="flex flex-col items-start gap-2">
                  <PatternLock
                    value={form.device_pattern}
                    onChange={(p) => setForm({ ...form, device_pattern: p })}
                    size={200}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm({ ...form, device_pattern: [] })}
                    disabled={form.device_pattern.length === 0}
                  >
                    Borrar patrón
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Sección: Términos y firma */}
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Términos y firma del cliente</h3>
            <div className="space-y-2">
              <Label htmlFor="terms">Términos del servicio</Label>
              <Textarea
                id="terms"
                readOnly
                rows={8}
                value={DEFAULT_SERVICE_TERMS}
                className="resize-none bg-muted/30 font-mono text-xs leading-relaxed"
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms_accepted"
                checked={form.terms_accepted}
                onCheckedChange={(c) => setForm({ ...form, terms_accepted: c === true })}
              />
              <Label htmlFor="terms_accepted" className="text-sm font-normal leading-snug">
                El cliente leyó y acepta los términos y condiciones del servicio.
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Firma del cliente (opcional)</Label>
              <SignaturePad
                value={form.client_signature}
                onChange={(sig) => setForm({ ...form, client_signature: sig })}
              />
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creando..." : "Crear orden"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
