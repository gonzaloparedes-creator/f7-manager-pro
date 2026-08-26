import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useProblemPresets } from "@/hooks/useProblemPresets";
import { Search, UserPlus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

type ClientLite = { id: string; name: string; phone: string | null; cedula: string | null };

// Presupuesto = una cotización sin que el cliente haya dejado el equipo
// todavía. Deliberadamente liviano: sin fotos, sin seguridad, sin firma —
// esas se completan recién al convertirlo en orden real (ver
// ConvertQuoteDialog), cuando el equipo efectivamente ingresa al taller.
export default function NewQuoteDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const { presets: problemPresets } = useProblemPresets();
  const [loading, setLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCedula, setCustomerCedula] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [problemOther, setProblemOther] = useState("");
  const [notes, setNotes] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");

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
    setDeviceType(""); setProblems([]); setProblemOther(""); setNotes(""); setQuoteAmount("");
    setSelectedClientId(null); setClientSearch("");
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

  const toggleProblem = (p: string) => {
    setProblems((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

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
    if (!deviceType.trim()) {
      toast({ title: "Faltan datos", description: "Ingresá el equipo a cotizar.", variant: "destructive" });
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
        const phoneNorm = customerPhone || null;
        const { data: created, error: cErr } = await supabase
          .from("clients")
          .insert({ company_id: resolvedCompanyId, technician_id: user.id, name: customerName, phone: phoneNorm, cedula: cedulaNorm })
          .select("id")
          .single();
        if (cErr) throw cErr;
        clientId = created.id;
      }

      const { data: numData, error: numErr } = await supabase.rpc("generate_order_number", { _company_id: resolvedCompanyId });
      if (numErr) throw numErr;
      const order_number = numData as string;

      const { data: created, error } = await supabase
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
          device_type: deviceType,
          problems,
          problem_other: problems.includes("Otro") ? problemOther : null,
          problem_description: notes || "",
          quote_amount: parseAmount(quoteAmount),
          deposit_amount: 0,
          photos: [],
          status: "presupuesto",
          terms_accepted: false,
          received_by_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("order_status_history").insert({
        order_id: created.id, status: "presupuesto", note: "Presupuesto creado",
      });

      try {
        // order_code va con el tracking_token (uuid), nunca el order_number:
        // es el único link desde el que el cliente puede aceptar/rechazar/
        // pedir cambios (ver respond-to-quote), y ese código corto es
        // adivinable/enumerable.
        await supabase.functions.invoke("send-order-notification", {
          body: {
            customer_name: customerName,
            customer_phone: customerPhone,
            device_type: deviceType,
            order_number,
            order_code: created.tracking_token,
            kind: "quote",
            quote_amount: parseAmount(quoteAmount),
            app_origin: window.location.origin,
          },
        });
      } catch (e) { console.warn("notification failed", e); }

      toast({ title: "¡Presupuesto creado!", description: `${order_number} fue registrado.` });
      reset();
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Presupuesto</DialogTitle>
          <DialogDescription>
            Cotizá sin que el cliente haya dejado el equipo todavía. Se convierte en orden real cuando lo trae.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quote_cedula">DNI / Cédula</Label>
            <div className="flex gap-2">
              <Input
                id="quote_cedula"
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
              <Label htmlFor="quote_customer_name">Cliente *</Label>
              <Input id="quote_customer_name" required value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setSelectedClientId(null); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote_customer_phone">Teléfono</Label>
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

          <div className="space-y-2">
            <Label htmlFor="quote_device">Equipo *</Label>
            <Input id="quote_device" required placeholder="iPhone 13, Apple Watch S8…" value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Problemas a cotizar</Label>
            <div className="flex flex-wrap gap-2">
              {problemPresets.map(({ label: p }) => {
                const active = problems.includes(p);
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

          {problems.includes("Otro") && (
            <div className="space-y-2">
              <Label htmlFor="quote_problem_other">Especificá "Otro"</Label>
              <Input id="quote_problem_other" value={problemOther} onChange={(e) => setProblemOther(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quote_notes">Observaciones</Label>
            <Textarea id="quote_notes" rows={2} placeholder="Detalles adicionales del pedido de cotización..."
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote_amount">Presupuesto (Gs.)</Label>
            <Input
              id="quote_amount"
              inputMode="numeric"
              placeholder="0"
              value={formatThousands(quoteAmount)}
              onChange={(e) => setQuoteAmount(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear presupuesto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
