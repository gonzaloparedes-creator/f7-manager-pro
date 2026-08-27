import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useProblemPresets } from "@/hooks/useProblemPresets";
import { useDeviceTypePresets } from "@/hooks/useDeviceTypePresets";
import { STATUS_LABELS } from "@/lib/orders";
import { Search, UserPlus, Check, Loader2, Plus, Trash2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

type ClientLite = { id: string; name: string; phone: string | null; cedula: string | null };
type DeviceRow = { key: string; device_type: string; device_otro: boolean; problems: string[]; problem_other: string; quote_amount: string };

const newRow = (): DeviceRow => ({
  key: Math.random().toString(36).slice(2),
  device_type: "",
  device_otro: false,
  problems: [],
  problem_other: "",
  quote_amount: "",
});

// Modo Lote: un mismo cliente deja varios equipos a la vez (caso típico:
// trae 3 celus de la familia el mismo día). Se completa el cliente una
// sola vez y se genera una orden real e independiente por cada equipo
// (cada una con su propio número, su propio link de seguimiento). A
// propósito no pide accesorios/checklist/garantía/seña/firma por equipo
// acá — eso se completa después desde el detalle de cada orden si hace
// falta; el objetivo de este modo es entrada rápida, no reemplazar Nueva
// Orden.
export default function NewBatchOrderDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const { presets: problemPresets } = useProblemPresets();
  const { presets: deviceTypePresets, selectionMode: deviceTypeSelectionMode } = useDeviceTypePresets();
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
  const [rows, setRows] = useState<DeviceRow[]>([newRow(), newRow()]);

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
    setRows([newRow(), newRow()]);
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
  const toggleRowProblem = (key: string, p: string) => {
    setRows((prev) => prev.map((r) => (r.key === key
      ? { ...r, problems: r.problems.includes(p) ? r.problems.filter((x) => x !== p) : [...r.problems, p] }
      : r)));
  };
  const selectRowDeviceType = (key: string, label: string) => {
    if (label === "Otro") {
      updateRow(key, { device_otro: true, device_type: "" });
    } else {
      updateRow(key, { device_otro: false, device_type: label });
    }
  };
  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (key: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));

  const parseAmount = (s: string) => {
    const digits = s.replace(/\D/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };
  const formatThousands = (s: string) => {
    const n = parseAmount(s);
    return n ? n.toLocaleString("es-PY") : "";
  };

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
          const { data: numData, error: numErr } = await supabase.rpc("generate_order_number", { _company_id: resolvedCompanyId });
          if (numErr) throw numErr;
          const order_number = numData as string;

          const { data: order, error } = await supabase
            .from("orders")
            .insert({
              company_id: resolvedCompanyId,
              technician_id: user.id,
              assigned_technician_id: user.id,
              received_branch_id: branchId,
              current_branch_id: branchId,
              order_number,
              client_id: clientId,
              customer_name: customerName,
              customer_phone: customerPhone || "",
              device_type: row.device_type,
              problems: row.problems,
              problem_other: row.problems.includes("Otro") ? row.problem_other : null,
              quote_amount: parseAmount(row.quote_amount),
              deposit_amount: 0,
              photos: [],
              status: "recibido",
              terms_accepted: false,
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
    <Dialog open={open} onOpenChange={(o) => { if (!loading) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Modo Lote</DialogTitle>
          <DialogDescription>
            Recibí varios equipos del mismo cliente de una sola vez. Cada equipo genera su propia orden.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="batch_cedula">DNI / Cédula</Label>
            <div className="flex gap-2">
              <Input
                id="batch_cedula"
                inputMode="numeric"
                placeholder="Ingresá la cédula para buscar o crear"
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

            {rows.map((row, idx) => (
              <div key={row.key} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Equipo {idx + 1}</span>
                  <Button
                    type="button" variant="ghost" size="icon" className="h-9 w-9"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    aria-label={`Quitar equipo ${idx + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`batch_device_${row.key}`} className="text-xs">Equipo *</Label>
                    {deviceTypeSelectionMode && deviceTypePresets.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {deviceTypePresets.map((p) => {
                            const active = p.label === "Otro" ? row.device_otro : (!row.device_otro && row.device_type === p.label);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => selectRowDeviceType(row.key, p.label)}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                  active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                        {row.device_otro && (
                          <Input
                            id={`batch_device_${row.key}`}
                            placeholder="Especificá el equipo…"
                            value={row.device_type}
                            onChange={(e) => updateRow(row.key, { device_type: e.target.value })}
                          />
                        )}
                      </div>
                    ) : (
                      <Input
                        id={`batch_device_${row.key}`}
                        placeholder="iPhone 13, Apple Watch S8…"
                        value={row.device_type}
                        onChange={(e) => updateRow(row.key, { device_type: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`batch_quote_${row.key}`} className="text-xs">Presupuesto (Gs.)</Label>
                    <Input
                      id={`batch_quote_${row.key}`}
                      inputMode="numeric"
                      placeholder="0"
                      value={formatThousands(row.quote_amount)}
                      onChange={(e) => updateRow(row.key, { quote_amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Problemas</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {problemPresets.map(({ label: p }) => {
                      const active = row.problems.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => toggleRowProblem(row.key, p)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
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

                {row.problems.includes("Otro") && (
                  <div className="space-y-1.5">
                    <Label htmlFor={`batch_other_${row.key}`} className="text-xs">Especificá "Otro"</Label>
                    <Input
                      id={`batch_other_${row.key}`}
                      value={row.problem_other}
                      onChange={(e) => updateRow(row.key, { problem_other: e.target.value })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Accesorios, checklist, garantía, seña y firma se completan después, individualmente, desde el detalle de cada orden.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Creando..."
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
