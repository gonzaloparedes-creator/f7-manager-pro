import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useAccessoryPresets } from "@/hooks/useAccessoryPresets";
import { useChecklistPresets } from "@/hooks/useChecklistPresets";
import { useProblemPresets } from "@/hooks/useProblemPresets";
import { useServiceTerms } from "@/hooks/useServiceTerms";
import { supabase } from "@/integrations/supabase/client";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { formatPYG, renderServiceTerms } from "@/lib/orders";
import WarrantySelector from "@/components/WarrantySelector";
import { Upload, X, CalendarIcon, Search, UserPlus, Check, Camera, Type, Grid3x3, Loader2, Banknote, ArrowLeftRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { PatternLock } from "@/components/PatternLock";
import { SignaturePad } from "@/components/SignaturePad";
import { CameraCapture } from "@/components/CameraCapture";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

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
type PhotoEntry = { file: File; previewUrl: string };

// Comprimir apenas se agrega la foto (no recién al enviar el formulario): una
// foto de cámara sin comprimir puede pesar varios MB, y mientras el usuario
// completa el resto del formulario esos File quedan enteros en memoria. En
// Android, justo después de volver de la app de Cámara (que ya usó memoria
// por su cuenta), esa presión extra hace que el sistema mate la pestaña y
// vuelva al dashboard — no pasa con la galería porque el picker del sistema
// es mucho más liviano que la app de Cámara.
const PHOTO_COMPRESS_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  initialQuality: 0.8,
};

async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const compressed = await imageCompression(file, PHOTO_COMPRESS_OPTIONS);
    return new File([compressed], file.name, { type: compressed.type || file.type });
  } catch {
    return file;
  }
}


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
  deposit_payment_method: string;
  estimated_delivery_date: Date | undefined;
  device_pin: string;
  device_pattern: number[];
  terms_accepted: boolean;
  client_signature: string;
  accessories: string[];
  checklist: Record<string, "ok" | "fail">;
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
  const { presets: accessoryPresets } = useAccessoryPresets();
  const { presets: checklistPresets } = useChecklistPresets();
  const { presets: problemPresets } = useProblemPresets();
  const { template: serviceTermsTemplate } = useServiceTerms();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraTriggerRef = useRef<HTMLButtonElement>(null);
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
  // El botón "Listo"/"Cerrar" de la cámara vive en un portal aparte y tiene
  // el foco al desmontarse. Devolver el foco al botón "Cámara" evita el
  // primer intento de cierre, pero en touch real de Android Radix dispara
  // un SEGUNDO onOpenChange(false) unos instantes después (confirmado con
  // pruebas), ya con cameraOpen=false en el closure — un ref, que no
  // depende de un re-render, mantiene el bloqueo durante ese margen.
  const suppressCloseRef = useRef(false);
  const closeCamera = () => {
    suppressCloseRef.current = true;
    cameraTriggerRef.current?.focus();
    setCameraOpen(false);
    window.setTimeout(() => { suppressCloseRef.current = false; }, 600);
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
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showSecondaryContact, setShowSecondaryContact] = useState(() => {
    const d = loadDraft();
    return !!(d?.form?.secondary_phone || d?.form?.secondary_contact_name);
  });
  // Un equipo tiene un solo método de desbloqueo — mostrar PIN y patrón a la
  // vez siempre desperdicia espacio en mobile. Se alterna cuál se ve, sin
  // borrar el dato del que queda oculto.
  const [lockInputMode, setLockInputMode] = useState<"text" | "pattern">(() => {
    const d = loadDraft();
    return d?.form?.device_pattern && d.form.device_pattern.length > 0 ? "pattern" : "text";
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
      setLockInputMode(d.form.device_pattern && d.form.device_pattern.length > 0 ? "pattern" : "text");
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
    setLockInputMode("text");
    setShowSecondaryContact(false);
    if (clearDraft) {
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    }
  };


  const addFiles = async (incoming: File[]) => {
    if (incoming.length === 0) return;
    const remaining = limits.photos - files.length;
    if (remaining <= 0) {
      toast({
        title: `Límite de ${limits.photos} fotos alcanzado${isStarter ? " (plan Starter)" : ""}`,
        variant: "destructive",
      });
      return;
    }
    const accepted = incoming.slice(0, remaining);
    if (incoming.length > remaining) {
      toast({ title: `Solo se agregaron ${accepted.length} de ${incoming.length} fotos (máximo ${limits.photos}).` });
    }
    setCompressing(true);
    try {
      const entries: PhotoEntry[] = [];
      for (const file of accepted) {
        const compressed = await compressPhoto(file);
        entries.push({ file: compressed, previewUrl: URL.createObjectURL(compressed) });
      }
      setFiles((prev) => [...prev, ...entries]);
    } finally {
      setCompressing(false);
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
        if (cameraOpen || suppressCloseRef.current) return;
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
              <Label htmlFor="customer_cedula">DNI / Cédula</Label>
              <div className="flex gap-2">
                <Input
                  id="customer_cedula"
                  inputMode="numeric"
                  placeholder="Ingresá la cédula para buscar o crear"
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

          {/* Sección: Equipo y problemas */}
          <section
            ref={(el) => { sectionRefs.current.equipo = el; }}
            data-section="equipo"
            className="space-y-3 border-t border-border pt-4"
          >
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
                {problemPresets.map(({ label: p }) => {
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
                      addFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  ref={cameraTriggerRef}
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-4 text-sm text-muted-foreground hover:bg-muted"
                >
                  <Camera className="h-4 w-4" />
                  Cámara
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {files.length} / {limits.photos} fotos{isStarter ? " (plan Starter)" : ""}
              </p>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={f.previewUrl} className="relative">
                      <img src={f.previewUrl} alt={f.file.name} className="h-16 w-16 rounded-md object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(f.previewUrl);
                          setFiles(files.filter((_, j) => j !== i));
                        }}
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
          <section
            ref={(el) => { sectionRefs.current.accesorios = el; }}
            data-section="accesorios"
            className="space-y-3 border-t border-border pt-4"
          >
            <h3 className="text-sm font-semibold text-foreground">Accesorios y Componentes</h3>
            <p className="text-xs text-muted-foreground">
              Marcá lo que el cliente entrega junto al equipo.
            </p>
            {accessoryPresets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay accesorios configurados. Agregalos en Configuración → Accesorios.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {accessoryPresets.map((acc) => {
                  const checked = form.accessories.includes(acc.label);
                  return (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2"
                    >
                      <Label htmlFor={`acc_${acc.id}`} className="text-sm font-normal cursor-pointer">
                        {acc.label}
                      </Label>
                      <Switch
                        id={`acc_${acc.id}`}
                        checked={checked}
                        onCheckedChange={(c) => setForm({
                          ...form,
                          accessories: c
                            ? [...form.accessories, acc.label]
                            : form.accessories.filter((x) => x !== acc.label),
                        })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sección: Checklist de recepción */}
          <section
            ref={(el) => { sectionRefs.current.checklist = el; }}
            data-section="checklist"
            className="space-y-3 border-t border-border pt-4"
          >
            <h3 className="text-sm font-semibold text-foreground">Checklist de Recepción</h3>
            <p className="text-xs text-muted-foreground">
              Dejá constancia del estado del equipo al recibirlo (opcional, item por item).
            </p>
            {checklistPresets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay ítems configurados. Agregalos en Configuración → Accesorios.
              </p>
            ) : (
              <div className="space-y-2">
                {checklistPresets.map((c) => {
                  const status = form.checklist[c.label];
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2"
                    >
                      <span className="text-sm">{c.label}</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...form.checklist };
                            if (next[c.label] === "ok") delete next[c.label]; else next[c.label] = "ok";
                            setForm({ ...form, checklist: next });
                          }}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                            status === "ok"
                              ? "border-transparent bg-[hsl(var(--status-listo-bg))] text-[hsl(var(--status-listo))]"
                              : "border-input text-muted-foreground hover:text-foreground"
                          )}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...form.checklist };
                            if (next[c.label] === "fail") delete next[c.label]; else next[c.label] = "fail";
                            setForm({ ...form, checklist: next });
                          }}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                            status === "fail"
                              ? "border-transparent bg-destructive/10 text-destructive"
                              : "border-input text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Falla
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sección: Financiero */}
          <section
            ref={(el) => { sectionRefs.current.financiero = el; }}
            data-section="financiero"
            className="space-y-3 border-t border-border pt-4"
          >
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

            {deposit > 0 && (
              <div className="space-y-2">
                <Label>Método de pago de la seña</Label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "Efectivo", label: "Efectivo", icon: Banknote },
                    { value: "Transferencia", label: "Transferencia", icon: ArrowLeftRight },
                    { value: "Otro", label: "Otro", icon: MoreHorizontal },
                  ] as const).map((m) => {
                    const active = form.deposit_payment_method === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setForm({ ...form, deposit_payment_method: m.value })}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <m.icon className="h-3.5 w-3.5" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Fecha estimada de entrega</Label>
              <Popover open={deliveryDateOpen} onOpenChange={setDeliveryDateOpen}>
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
                    onSelect={(d) => { setForm({ ...form, estimated_delivery_date: d }); setDeliveryDateOpen(false); }}
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

          <section
            ref={(el) => { sectionRefs.current.seguridad = el; }}
            data-section="seguridad"
            className="space-y-3 border-t border-border pt-4"
          >
            <h3 className="text-sm font-semibold text-foreground">Seguridad del equipo</h3>
            <p className="text-xs text-muted-foreground">
              Datos opcionales para que el técnico pueda acceder al equipo durante la reparación.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={lockInputMode === "text" ? "device_pin" : undefined}>
                  {lockInputMode === "text" ? "PIN / Contraseña" : "Patrón de desbloqueo (Android)"}
                </Label>
                <div className="flex rounded-md border border-input p-0.5">
                  <button
                    type="button"
                    onClick={() => setLockInputMode("text")}
                    aria-label="Usar PIN o contraseña"
                    aria-pressed={lockInputMode === "text"}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
                      lockInputMode === "text" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    <Type className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLockInputMode("pattern")}
                    aria-label="Usar patrón de desbloqueo"
                    aria-pressed={lockInputMode === "pattern"}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
                      lockInputMode === "pattern" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {lockInputMode === "text" ? (
                <>
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
                </>
              ) : (
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
              )}
            </div>
          </section>

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
      {cameraOpen && (
        <CameraCapture onClose={closeCamera} onCapture={(fs) => addFiles(fs)} />
      )}
    </Dialog>
  );
}
