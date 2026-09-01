import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useServiceTerms } from "@/hooks/useServiceTerms";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { renderServiceTerms, STATUS_LABELS } from "@/lib/orders";
import { X, Search, UserPlus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { SignaturePad } from "@/components/SignaturePad";
import { Checkbox } from "@/components/ui/checkbox";
import DeviceIntakeFields, { type DeviceIntakeValue } from "@/components/DeviceIntakeFields";
import type { PhotoEntry } from "@/lib/photos";

const SECTIONS = [
  { key: "cliente", label: "Cliente" },
  { key: "equipo", label: "Equipo" },
  { key: "accesorios", label: "Accesorios" },
  { key: "checklist", label: "Checklist" },
  { key: "financiero", label: "Financiero" },
  { key: "seguridad", label: "Seguridad" },
  { key: "firma", label: "Firma" },
] as const;

type ClientLite = { id: string; name: string; phone: string | null; cedula: string | null };

type FormState = DeviceIntakeValue & {
  customer_name: string;
  customer_phone: string;
  secondary_phone: string;
  secondary_contact_name: string;
  customer_cedula: string;
  terms_accepted: boolean;
  client_signature: string;
};

const INITIAL_STATE: FormState = {
  customer_name: "",
  customer_phone: "",
  secondary_phone: "",
  secondary_contact_name: "",
  customer_cedula: "",
  device_type: "",
  imei: "",
  marca: "",
  modelo: "",
  assigned_technician_id: "",
  problems: [],
  problem_other: "",
  problem_description: "",
  quote_amount: "",
  deposit_amount: "",
  deposit_payment_method: "Efectivo",
  estimated_delivery_date: undefined,
  device_pin: "",
  device_pattern: [],
  terms_accepted: false,
  client_signature: "",
  accessories: [],
  checklist: {},
  warranty_days: 30,
};

export default function NewOrderDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { limits, isStarter } = usePlan();
  const { template: serviceTermsTemplate } = useServiceTerms();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  // DeviceIntakeFields maneja internamente su propio estado de UI (chips
  // "Otro" activos, modo PIN/patrón) — cambiar esta key fuerza un remount
  // limpio de esa parte cuando se resetea el formulario o se recarga un
  // borrador, sin tener que levantar ese estado hasta acá.
  const [formKey, setFormKey] = useState(0);
  // Radix monta el contenido del Dialog un tick después de que `open` pasa a
  // true (para permitir la animación de entrada) — un useRef normal quedaría
  // en null en el momento en que corre el efecto de abajo, y como no es
  // reactivo, el efecto nunca se reintenta. Con estado, el efecto vuelve a
  // correr apenas el nodo real aparece.
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].key);
  // Si la sección activa cambia a una cuyo chip quedó fuera de vista en la
  // fila horizontal (ej. "Firma" cuando arrancaste viendo "Cliente"), lo
  // centra solo — sin esto el usuario pierde de vista cuál está resaltada.
  // Ojo: NO usar scrollIntoView acá — afecta el scroll de CUALQUIER
  // ancestro scrolleable, y como el chip vive dentro del mismo diálogo que
  // scrollea verticalmente hacia la sección, terminaba interrumpiendo a
  // mitad de camino ese scroll vertical (confirmado: el tap en "Firma"
  // dejaba el scroll trabado a los ~500px de los ~2500px necesarios).
  // Seteando scrollLeft a mano en el contenedor de los chips, el ajuste
  // queda 100% acotado al scroll horizontal, sin tocar nada más.
  useEffect(() => {
    const chip = chipRefs.current[activeSection];
    const row = chip?.parentElement;
    if (!chip || !row) return;
    const target = chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2;
    row.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeSection]);
  // Al tocar un chip, llevar esa sección al tope del área que scrollea
  // (contentEl). Iguales razones que arriba: scrollIntoView() sube por
  // TODO ancestro scrolleable, no solo el que nos importa — y DialogContent,
  // aunque tiene overflow-hidden, sigue contando como uno para la API (solo
  // bloquea el scroll manual del usuario, no el programático). El resultado
  // era que además de scrollear contentEl, tambien scrolleaba DialogContent
  // por la altura del header, empujando el header entero fuera de pantalla
  // (confirmado: dialogContent.scrollTop terminaba en 119px, justo la altura
  // del header, tras tocar "Firma"). Calculando el offset a mano y usando
  // scrollTo() directo sobre contentEl, el ajuste queda 100% acotado a ese
  // único contenedor.
  const scrollToSection = (key: string) => {
    const section = sectionRefs.current[key];
    if (!section || !contentEl) return;
    const top = section.getBoundingClientRect().top - contentEl.getBoundingClientRect().top + contentEl.scrollTop;
    contentEl.scrollTo({ top, behavior: "smooth" });
  };
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
  const [files, setFiles] = useState<PhotoEntry[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialDraft?.selectedClientId ?? null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showSecondaryContact, setShowSecondaryContact] = useState(() => {
    const d = loadDraft();
    return !!(d?.form?.secondary_phone || d?.form?.secondary_contact_name);
  });
  const [searchingCedula, setSearchingCedula] = useState(false);

  const searchByCedula = async () => {
    const cedula = form.customer_cedula.trim();
    if (!cedula || !companyId) return;
    setSearchingCedula(true);
    try {
      const { data } = await supabase
        .from("clients")
        .select("id,name,phone,cedula")
        .eq("company_id", companyId)
        .eq("cedula", cedula)
        .maybeSingle();
      if (data) {
        setSelectedClientId(data.id);
        setForm((f) => ({ ...f, customer_name: data.name, customer_phone: data.phone ?? "", customer_cedula: data.cedula ?? cedula }));
        toast({ title: "Cliente encontrado", description: data.name });
      } else {
        toast({ title: "No hay ningún cliente con esa cédula", description: "Completá los datos para crear uno nuevo." });
      }
    } finally {
      setSearchingCedula(false);
    }
  };

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
      setFormKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Resalta en la navegación por secciones cuál está a la vista, observando
  // contra el propio DialogContent (que scrollea internamente), no la ventana.
  useEffect(() => {
    if (!open) return;
    const root = contentEl;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        // Entre las secciones que tocan la franja superior, la "actual" es la
        // que tiene el top más alto (la que acaba de entrar desde abajo) — no
        // la que tiene el top más negativo, que suele ser una sección larga
        // que ya casi se scrolleó por completo.
        const topmost = visible.reduce((a, b) => (a.boundingClientRect.top > b.boundingClientRect.top ? a : b));
        const key = (topmost.target as HTMLElement).dataset.section;
        if (key) setActiveSection(key);
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [open, contentEl]);

  const reset = (clearDraft = false) => {
    setForm(INITIAL_STATE);
    setFiles((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.previewUrl)); return []; });
    setSelectedClientId(null);
    setClientSearch("");
    setShowSecondaryContact(false);
    setFormKey((k) => k + 1);
    if (clearDraft) {
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    }
  };

  const parseAmount = (s: string) => {
    const digits = s.replace(/\D/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };

  const quote = useMemo(() => parseAmount(form.quote_amount), [form.quote_amount]);
  const deposit = useMemo(() => parseAmount(form.deposit_amount), [form.deposit_amount]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.device_type.trim()) {
      toast({ title: "Faltan datos", description: "Indicá el equipo recibido.", variant: "destructive" });
      return;
    }
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
      // Las fotos ya se comprimen apenas se agregan (ver addFiles), así que
      // acá solo queda subir lo que ya está en memoria en tamaño reducido.
      const photoUrls: string[] = [];
      for (const { file } of files) {
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

      // Get next ORD-XXXX number from DB (correlativo por empresa)
      const { data: numData, error: numErr } = await supabase.rpc("generate_order_number", { _company_id: companyId });
      if (numErr) throw numErr;
      const order_number = numData as string;

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          company_id: companyId,
          technician_id: user.id,
          assigned_technician_id: form.assigned_technician_id || user.id,
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

      toast({ title: "¡Orden creada!", description: `${order_number} fue registrada.` });
      reset(true);
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCompressing(false);
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // El overlay de cámara vive en su propio portal fuera del DOM del
        // Dialog; Radix lo trata como "click afuera" y pide cerrar el
        // Dialog. Mientras la cámara esté abierta (o recién se cerró), ese
        // pedido se ignora por completo.
        if (cameraActive) return;
        if (!loading) { onOpenChange(o); if (!o) reset(); }
      }}
    >
      <DialogContent
        hideClose
        className={cn(
          // Mobile: pantalla completa, se siente como una página nativa en vez
          // de un modal flotando con scroll interno recortado. flex-col con
          // el header y el body como dos hijos separados (en vez de "todo
          // scrollea, el header se sticky-pega") porque position:sticky dentro
          // de un contenedor afectado por la barra dinámica de Safari en iOS
          // (100dvh) puede desalinearse durante el scroll y dejar contenido
          // asomando por encima del header un instante — con el header afuera
          // del área que realmente scrollea, ese desfasaje no puede pasar.
          "flex inset-0 left-0 top-0 h-[100dvh] max-h-[100dvh] w-full max-w-full translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 p-0",
          // Desktop: el diálogo centrado de siempre.
          "sm:inset-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border"
        )}
      >
        {/* Header + nav de secciones: hijo fijo (shrink-0), no sticky — ver
            comentario arriba sobre por qué. Además de verse mejor que el
            título "flotando" scrolleable de antes, esto resuelve que el botón
            de cerrar (que Radix posiciona "absolute" dentro del contenedor
            con scroll) se perdiera scrolleando hacia abajo: ahora vive acá,
            siempre visible. */}
        <div className="shrink-0 border-b border-border bg-background sm:rounded-t-lg">
          <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base sm:text-lg">Nueva orden</DialogTitle>
              <DialogDescription className="sr-only">Registrá un nuevo equipo para reparación.</DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              aria-label="Cerrar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-70 transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-6 pb-3">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                ref={(el) => { chipRefs.current[s.key] = el; }}
                type="button"
                onClick={() => scrollToSection(s.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  activeSection === s.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {/* Único contenedor que scrollea de verdad — el header ya no es parte
            de este mismo box, así que las secciones no necesitan scroll-margin
            para no quedar tapadas por él. */}
        <div ref={setContentEl} className="flex-1 overflow-y-auto p-6 pt-4">
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Sección: Cliente */}
          <section
            ref={(el) => { sectionRefs.current.cliente = el; }}
            data-section="cliente"
            className="space-y-3"
          >
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
              <Label htmlFor="customer_cedula">DNI / Cédula / RUC</Label>
              <div className="flex gap-2">
                <Input
                  id="customer_cedula"
                  placeholder="Ingresá la cédula o RUC para buscar o crear"
                  value={form.customer_cedula}
                  onChange={(e) => setForm({ ...form, customer_cedula: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); searchByCedula(); }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={searchByCedula}
                  disabled={searchingCedula || !form.customer_cedula.trim()}
                >
                  {searchingCedula ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
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
          </section>

          <DeviceIntakeFields
            key={formKey}
            idPrefix="order"
            value={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            files={files}
            onFilesChange={setFiles}
            photoLimit={limits.photos}
            isStarterPlan={isStarter}
            registerSectionRef={(key, el) => { sectionRefs.current[key] = el; }}
            onCameraActiveChange={setCameraActive}
            onCompressingChange={setCompressing}
          />

          {/* Sección: Términos y firma */}
          <section
            ref={(el) => { sectionRefs.current.firma = el; }}
            data-section="firma"
            className="space-y-3 border-t border-border pt-4"
          >
            <h3 className="text-sm font-semibold text-foreground">Términos y firma del cliente</h3>
            <div className="space-y-2">
              <Label htmlFor="terms">Términos del servicio</Label>
              <Textarea
                id="terms"
                readOnly
                rows={8}
                value={renderServiceTerms(serviceTermsTemplate, form.warranty_days)}
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
            <Button type="submit" disabled={loading || compressing}>
              {compressing ? "Optimizando fotos..." : loading ? "Creando..." : "Crear orden"}
            </Button>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
