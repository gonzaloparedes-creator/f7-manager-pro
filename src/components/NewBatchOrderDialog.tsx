import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useServiceTerms } from "@/hooks/useServiceTerms";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { renderServiceTerms, STATUS_LABELS } from "@/lib/orders";
import { Search, UserPlus, Check, Loader2, Plus, Trash2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { SignaturePad } from "@/components/SignaturePad";
import DeviceIntakeFields, { type DeviceIntakeValue } from "@/components/DeviceIntakeFields";
import type { PhotoEntry } from "@/lib/photos";

type ClientLite = { id: string; name: string; phone: string | null; cedula: string | null };
type DeviceRow = DeviceIntakeValue & { key: string; files: PhotoEntry[] };

const newRow = (): DeviceRow => ({
  key: Math.random().toString(36).slice(2),
  device_type: "",
  imei: "",
  marca: "",
  modelo: "",
  assigned_technician_id: "",
  problems: [],
  problem_other: "",
  problem_description: "",
  accessories: [],
  checklist: {},
  quote_amount: "",
  deposit_amount: "",
  deposit_payment_method: "Efectivo",
  estimated_delivery_date: undefined,
  warranty_days: 30,
  device_pin: "",
  device_pattern: [],
  files: [],
});

function parseAmount(s: string) {
  const digits = s.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function summarizeRow(row: DeviceRow): string {
  if (!row.device_type.trim()) return "Sin completar";
  const parts = [row.device_type, [row.marca, row.modelo].filter(Boolean).join(" ")].filter(Boolean);
  const amount = parseAmount(row.quote_amount);
  const base = parts.join(" · ");
  return amount > 0 ? `${base} · Gs. ${amount.toLocaleString("es-PY")}` : base;
}

function toggleInSet<T>(set: Set<T>, item: T, active: boolean): Set<T> {
  const next = new Set(set);
  if (active) next.add(item); else next.delete(item);
  return next;
}

// Modo Lote: un mismo cliente deja varios equipos a la vez (caso típico:
// trae 3 celus de la familia el mismo día). Se completa el cliente una sola
// vez y se genera una orden real e independiente por cada equipo (cada una
// con su propio número, su propio link de seguimiento) — pero cada equipo
// tiene los mismos datos completos que Nueva Orden (accesorios, checklist,
// seña, garantía, PIN/patrón, fotos, técnico), vía el mismo
// DeviceIntakeFields que usa Nueva Orden. Firma y términos se completan una
// sola vez para todo el lote (un cliente que deja 3 equipos firma una vez,
// no tres) y se graban idénticos en cada orden creada.
export default function NewBatchOrderDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { limits, isStarter } = usePlan();
  const { template: serviceTermsTemplate } = useServiceTerms();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Cada equipo del lote es una orden independiente creada en secuencia;
  // cerrar/recargar la pestaña a mitad de camino dejaría equipos sin crear
  // sin avisar. La navegación dentro de la app (sidebar, back del router)
  // no dispara beforeunload, pero esto cubre el caso más común (cerrar
  // pestaña, refrescar, recargar el celular).
  useEffect(() => {
    if (!loading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loading]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCedula, setCustomerCedula] = useState("");
  const [rows, setRows] = useState<DeviceRow[]>(() => [newRow(), newRow()]);
  const [openRows, setOpenRows] = useState<string[]>(() => rows.map((r) => r.key));
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [clientSignature, setClientSignature] = useState("");
  // Cuántas filas tienen su cámara abierta / están comprimiendo fotos ahora
  // mismo — con más de un equipo puede haber, en teoría, más de una a la
  // vez. Mientras el set no esté vacío, el diálogo no debe cerrarse (cámara)
  // ni permitir enviar el formulario (compresión en curso).
  const [activeCameraRows, setActiveCameraRows] = useState<Set<string>>(new Set());
  const [compressingRows, setCompressingRows] = useState<Set<string>>(new Set());

  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [searchingCedula, setSearchingCedula] = useState(false);

  useEffect(() => {
    if (!open || !user || !companyId) return;
    supabase
      .from("clients")
      .select("id,name,phone,cedula")
      .eq("company_id", companyId)
      .order("name", { ascending: true })
      .then(({ data }) => setClients((data ?? []) as ClientLite[]));
  }, [open, user, companyId]);

  const reset = () => {
    setCustomerName(""); setCustomerPhone(""); setCustomerCedula("");
    setSelectedClientId(null); setClientSearch("");
    rows.forEach((r) => r.files.forEach((f) => URL.revokeObjectURL(f.previewUrl)));
    const fresh = [newRow(), newRow()];
    setRows(fresh);
    setOpenRows(fresh.map((r) => r.key));
    setTermsAccepted(false);
    setClientSignature("");
    setActiveCameraRows(new Set());
    setCompressingRows(new Set());
  };

  const searchByCedula = async () => {
    const cedula = customerCedula.trim();
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
        setCustomerName(data.name);
        setCustomerPhone(data.phone ?? "");
        toast({ title: "Cliente encontrado", description: data.name });
      } else {
        toast({ title: "No hay ningún cliente con esa cédula", description: "Completá los datos para crear uno nuevo." });
      }
    } finally {
      setSearchingCedula(false);
    }
  };

  const updateRow = (key: string, patch: Partial<DeviceRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const addRow = () => {
    const row = newRow();
    setRows((prev) => [...prev, row]);
    setOpenRows((prev) => [...prev, row.key]);
  };
  const removeRow = (key: string) => {
    setRows((prev) => {
      if (prev.length === 1) return prev;
      const row = prev.find((r) => r.key === key);
      row?.files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      return prev.filter((r) => r.key !== key);
    });
    setOpenRows((prev) => prev.filter((k) => k !== key));
    setActiveCameraRows((prev) => toggleInSet(prev, key, false));
    setCompressingRows((prev) => toggleInSet(prev, key, false));
  };

  const anyCameraActive = activeCameraRows.size > 0;
  const anyCompressing = compressingRows.size > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!customerName.trim()) {
      toast({ title: "Faltan datos", description: "Ingresá el nombre del cliente.", variant: "destructive" });
      return;
    }
    const validRows = rows.filter((r) => r.device_type.trim());
    if (validRows.length === 0) {
      toast({ title: "Faltan datos", description: "Agregá al menos un equipo con su tipo.", variant: "destructive" });
      return;
    }
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      if (row.problems.length === 0) {
        toast({ title: "Faltan datos", description: `Equipo ${i + 1}: seleccioná al menos un problema.`, variant: "destructive" });
        return;
      }
      if (row.problems.includes("Otro") && !row.problem_other.trim()) {
        toast({ title: "Faltan datos", description: `Equipo ${i + 1}: describí el problema "Otro".`, variant: "destructive" });
        return;
      }
      if (parseAmount(row.deposit_amount) > parseAmount(row.quote_amount)) {
        toast({ title: "Importes inválidos", description: `Equipo ${i + 1}: la seña no puede superar al presupuesto.`, variant: "destructive" });
        return;
      }
    }
    if (!termsAccepted) {
      toast({ title: "Faltan datos", description: "El cliente debe aceptar los términos del servicio.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: meProfile } = await supabase
        .from("profiles")
        .select("branch_id, company_id")
        .eq("id", user.id)
        .maybeSingle();
      const branchId = (meProfile as any)?.branch_id ?? null;
      const resolvedCompanyId = (meProfile as any)?.company_id as string | undefined;
      if (!resolvedCompanyId) throw new Error("Tu perfil no tiene una empresa asignada.");

      let clientId = selectedClientId;
      const cedulaNorm = customerCedula.trim() || null;
      if (!clientId) {
        const { data: created, error: cErr } = await supabase
          .from("clients")
          .insert({ company_id: resolvedCompanyId, technician_id: user.id, name: customerName, phone: customerPhone || null, cedula: cedulaNorm })
          .select("id")
          .single();
        if (cErr) throw cErr;
        clientId = created.id;
      }

      const createdNumbers: string[] = [];
      const failed: string[] = [];

      for (const row of validRows) {
        try {
          // Las fotos ya se comprimen apenas se agregan (ver DeviceIntakeFields),
          // acá solo queda subir lo que ya está en memoria en tamaño reducido.
          const photoUrls: string[] = [];
          for (const { file } of row.files) {
            const ext = file.name.split(".").pop() || "jpg";
            const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const { error: upErr } = await supabase.storage.from("order-photos").upload(path, file);
            if (upErr) throw upErr;
            const { data: pub } = supabase.storage.from("order-photos").getPublicUrl(path);
            photoUrls.push(pub.publicUrl);
          }

          const { data: numData, error: numErr } = await supabase.rpc("generate_order_number", { _company_id: resolvedCompanyId });
          if (numErr) throw numErr;
          const order_number = numData as string;

          const quote = parseAmount(row.quote_amount);
          const deposit = parseAmount(row.deposit_amount);

          const { data: order, error } = await supabase
            .from("orders")
            .insert({
              company_id: resolvedCompanyId,
              technician_id: user.id,
              assigned_technician_id: row.assigned_technician_id || user.id,
              received_branch_id: branchId,
              current_branch_id: branchId,
              order_number,
              client_id: clientId,
              customer_name: customerName,
              customer_phone: customerPhone || "",
              device_type: row.device_type,
              imei: row.imei || null,
              marca: row.marca || null,
              modelo: row.modelo || null,
              problems: row.problems,
              problem_other: row.problems.includes("Otro") ? row.problem_other : null,
              problem_description: row.problem_description || "",
              quote_amount: quote,
              deposit_amount: deposit,
              deposit_payment_method: deposit > 0 ? row.deposit_payment_method : null,
              estimated_delivery_date: row.estimated_delivery_date
                ? format(row.estimated_delivery_date, "yyyy-MM-dd")
                : null,
              photos: photoUrls,
              status: "recibido",
              device_pin: row.device_pin || null,
              device_pattern: row.device_pattern,
              terms_accepted: termsAccepted,
              client_signature: clientSignature || null,
              accessories: row.accessories,
              checklist: Object.entries(row.checklist).map(([label, status]) => ({ label, status })),
              warranty_days: row.warranty_days,
              received_by_id: user.id,
            })
            .select()
            .single();
          if (error) throw error;

          await supabase.from("order_status_history").insert({
            order_id: order.id, status: "recibido", status_label: STATUS_LABELS.recibido, note: "Orden creada (Modo Lote)",
          });

          // No se espera la notificación: con varios equipos, esperar el
          // WhatsApp de cada uno antes de pasar al siguiente multiplicaba
          // el tiempo total y ampliaba la ventana en la que salir de la
          // pantalla a mitad de camino dejaba equipos sin crear. Se dispara
          // en paralelo y no bloquea el resto del lote.
          supabase.functions.invoke("send-order-notification", {
            body: {
              customer_name: order.customer_name,
              customer_phone: order.customer_phone,
              device_type: order.device_type,
              order_number: order.order_number,
              order_code: order.tracking_token,
              app_origin: window.location.origin,
            },
          }).catch((e) => console.warn("notification failed", e));

          createdNumbers.push(order_number);
        } catch (e: any) {
          failed.push(`${row.device_type} (${e.message})`);
        }
      }

      if (createdNumbers.length > 0) {
        const title = createdNumbers.length === 1
          ? "1 orden creada"
          : `${createdNumbers.length} órdenes creadas`;
        toast({ title, description: createdNumbers.join(", ") });
      }
      if (failed.length > 0) {
        toast({ title: "Algunos equipos no se pudieron registrar", description: failed.join(" · "), variant: "destructive" });
      }
      if (createdNumbers.length > 0) {
        reset();
        onOpenChange(false);
        onCreated();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (anyCameraActive) return;
        if (!loading) { onOpenChange(o); if (!o) reset(); }
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Modo Lote</DialogTitle>
          <DialogDescription>
            Recibí varios equipos del mismo cliente de una sola vez. Cada equipo genera su propia orden, con los mismos datos que Nueva Orden.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="batch_cedula">DNI / Cédula / RUC</Label>
            <div className="flex gap-2">
              <Input
                id="batch_cedula"
                placeholder="Ingresá la cédula o RUC para buscar o crear"
                value={customerCedula}
                onChange={(e) => setCustomerCedula(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchByCedula(); } }}
              />
              <Button type="button" variant="secondary" onClick={searchByCedula} disabled={searchingCedula || !customerCedula.trim()}>
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
                    ? <span>{customerName} <span className="text-muted-foreground">· {customerPhone}</span></span>
                    : <span className="text-muted-foreground">Buscar por nombre o teléfono…</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) => {
                    const s = search.toLowerCase();
                    return value.toLowerCase().includes(s) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="Escribí nombre o teléfono…" value={clientSearch} onValueChange={setClientSearch} />
                  <CommandList>
                    <CommandEmpty>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md"
                        onClick={() => {
                          setSelectedClientId(null);
                          setCustomerName(clientSearch);
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
                            setCustomerName(c.name);
                            setCustomerPhone(c.phone ?? "");
                            setCustomerCedula(c.cedula ?? "");
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
              <Label htmlFor="batch_customer_name">Cliente *</Label>
              <Input id="batch_customer_name" required value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setSelectedClientId(null); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch_customer_phone">Teléfono</Label>
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
                  value={customerPhone.replace(/^595/, "")}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setCustomerPhone(`595${digits}`);
                    setSelectedClientId(null);
                  }}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> Equipos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="mr-1 h-4 w-4" /> Agregar equipo
              </Button>
            </div>

            <Accordion type="multiple" value={openRows} onValueChange={setOpenRows} className="space-y-2">
              {rows.map((row, idx) => (
                <AccordionItem key={row.key} value={row.key} className="rounded-lg border border-border px-3">
                  <div className="flex items-center gap-1">
                    <AccordionTrigger className="flex-1 py-3 text-left hover:no-underline">
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-sm font-medium">Equipo {idx + 1}</span>
                        <span className="text-xs font-normal text-muted-foreground">{summarizeRow(row)}</span>
                      </div>
                    </AccordionTrigger>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => { e.stopPropagation(); removeRow(row.key); }}
                      disabled={rows.length === 1}
                      aria-label={`Quitar equipo ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <AccordionContent className="pb-4 pt-1">
                    <DeviceIntakeFields
                      idPrefix={`batch_${row.key}`}
                      compact
                      value={row}
                      onChange={(patch) => updateRow(row.key, patch)}
                      files={row.files}
                      onFilesChange={(files) => updateRow(row.key, { files })}
                      photoLimit={limits.photos}
                      isStarterPlan={isStarter}
                      onCameraActiveChange={(active) => setActiveCameraRows((prev) => toggleInSet(prev, row.key, active))}
                      onCompressingChange={(c) => setCompressingRows((prev) => toggleInSet(prev, row.key, c))}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <Label className="text-sm font-semibold text-foreground">Firma y términos</Label>
            <p className="text-xs text-muted-foreground">
              Se completa una sola vez para todos los equipos de este lote.
            </p>
            <div className="space-y-2">
              <Label htmlFor="batch_terms">Términos del servicio</Label>
              <Textarea
                id="batch_terms"
                readOnly
                rows={6}
                value={renderServiceTerms(serviceTermsTemplate, rows[0]?.warranty_days ?? 30)}
                className="resize-none bg-muted/30 font-mono text-xs leading-relaxed"
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="batch_terms_accepted"
                checked={termsAccepted}
                onCheckedChange={(c) => setTermsAccepted(c === true)}
              />
              <Label htmlFor="batch_terms_accepted" className="text-sm font-normal leading-snug">
                El cliente leyó y acepta los términos y condiciones del servicio.
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Firma del cliente (opcional)</Label>
              <SignaturePad value={clientSignature} onChange={setClientSignature} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading || anyCompressing}>
              {loading
                ? "Creando..."
                : anyCompressing
                ? "Optimizando fotos..."
                : (() => {
                    const n = rows.filter((r) => r.device_type.trim()).length;
                    if (n === 0) return "Crear orden";
                    return n === 1 ? "Crear 1 orden" : `Crear ${n} órdenes`;
                  })()}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
