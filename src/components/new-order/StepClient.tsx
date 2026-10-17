import { useState } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { Check, Loader2, Search, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { ClientLite, OrderFormState } from "./state";

interface Props {
  form: OrderFormState;
  patch: (p: Partial<OrderFormState>) => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  clients: ClientLite[];
  companyId: string | null;
  notifyWhatsapp: boolean;
  setNotifyWhatsapp: (v: boolean) => void;
  showSecondary: boolean;
  setShowSecondary: (v: boolean) => void;
}

const phoneCountryProps = {
  country: "py",
  value: "595",
  onChange: () => {},
  inputProps: { readOnly: true, tabIndex: -1, "aria-hidden": true },
  specialLabel: "",
  disableDropdown: false,
  countryCodeEditable: false,
  inputClass: "!w-24 !h-10 !text-sm !bg-background !text-foreground !border-input !rounded-md !pl-14 !cursor-default",
  buttonClass: "!bg-background !border-input !rounded-l-md",
  dropdownClass: "!bg-popover !text-popover-foreground",
  containerClass: "!w-auto",
};

export default function StepClient({
  form, patch, selectedClientId, setSelectedClientId, clients, companyId,
  notifyWhatsapp, setNotifyWhatsapp, showSecondary, setShowSecondary,
}: Props) {
  const { toast } = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
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
        patch({ customer_name: data.name, customer_phone: data.phone ?? "", customer_cedula: data.cedula ?? cedula });
        toast({ title: "Cliente encontrado", description: data.name });
      } else {
        toast({ title: "No hay ningún cliente con esa cédula", description: "Completá los datos para crear uno nuevo." });
      }
    } finally {
      setSearchingCedula(false);
    }
  };

  const clearClient = () => {
    setSelectedClientId(null);
    patch({ customer_name: "", customer_phone: "", customer_cedula: "" });
  };

  return (
    <div className="space-y-5">
      {selectedClientId && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{form.customer_name}</p>
              <p className="truncate text-xs text-muted-foreground">Cliente existente · {form.customer_phone || "sin teléfono"}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clearClient}>
            <X className="mr-1 h-3 w-3" /> Cambiar
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label>Buscar cliente existente</Label>
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-11 w-full justify-start font-normal">
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Buscar por nombre o teléfono…</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command
              filter={(value, q) => (value.toLowerCase().includes(q.toLowerCase()) ? 1 : 0)}
            >
              <CommandInput placeholder="Escribí nombre o teléfono…" value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => {
                      const digits = search.replace(/\D/g, "");
                      const isPhone = digits.length >= 6;
                      setSelectedClientId(null);
                      patch({
                        customer_name: isPhone ? "" : search,
                        customer_phone: isPhone ? `595${digits.replace(/^595/, "")}` : "",
                      });
                      setSearchOpen(false);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    Crear nuevo cliente: <strong>{search || "…"}</strong>
                  </button>
                </CommandEmpty>
                <CommandGroup heading="Clientes">
                  {clients.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name}|${c.phone ?? ""}`}
                      onSelect={() => {
                        setSelectedClientId(c.id);
                        patch({ customer_name: c.name, customer_phone: c.phone ?? "", customer_cedula: c.cedula ?? "" });
                        setSearchOpen(false);
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

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {selectedClientId ? "Datos del cliente" : "o cargá los datos"}
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customer_name">Nombre *</Label>
          <Input
            id="customer_name"
            className="h-11"
            value={form.customer_name}
            onChange={(e) => { patch({ customer_name: e.target.value }); setSelectedClientId(null); }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer_phone">Teléfono *</Label>
          <div className="flex gap-2">
            <PhoneInput {...phoneCountryProps} />
            <Input
              id="customer_phone"
              type="tel"
              inputMode="tel"
              placeholder="981 123 456"
              className="h-11 flex-1"
              value={form.customer_phone.replace(/^595/, "")}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                patch({ customer_phone: digits ? `595${digits}` : "" });
                setSelectedClientId(null);
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer_cedula">DNI / Cédula / RUC</Label>
        <div className="flex gap-2">
          <Input
            id="customer_cedula"
            className="h-11"
            placeholder="Opcional"
            value={form.customer_cedula}
            onChange={(e) => patch({ customer_cedula: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); searchByCedula(); }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="h-11"
            aria-label="Buscar por cédula"
            title="Buscar por cédula"
            onClick={searchByCedula}
            disabled={searchingCedula || !form.customer_cedula.trim()}
          >
            {searchingCedula ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!selectedClientId && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="notify_whatsapp_new_client" className="cursor-pointer text-sm font-medium">Notificar por WhatsApp</Label>
            <p className="text-xs text-muted-foreground">
              Aplica solo si este es un cliente nuevo — desactivalo para mayoristas u otros que no quieras que reciban avisos automáticos.
            </p>
          </div>
          <Switch id="notify_whatsapp_new_client" checked={notifyWhatsapp} onCheckedChange={setNotifyWhatsapp} />
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => {
            const next = !showSecondary;
            setShowSecondary(next);
            if (!next) patch({ secondary_phone: "", secondary_contact_name: "" });
          }}
          className="text-sm font-medium text-primary hover:underline"
        >
          {showSecondary ? "− Quitar contacto secundario" : "+ Enviar notificaciones a un contacto secundario"}
        </button>
      </div>

      {showSecondary && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="secondary_phone">Teléfono de notificaciones</Label>
            <div className="flex gap-2">
              <PhoneInput {...phoneCountryProps} />
              <Input
                id="secondary_phone"
                type="tel"
                inputMode="tel"
                placeholder="981 123 456"
                className="h-11 flex-1"
                value={form.secondary_phone.replace(/^595/, "")}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  patch({ secondary_phone: digits ? `595${digits}` : "" });
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Recibirá los mensajes de estado.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary_contact_name">Titular del número</Label>
            <Input
              id="secondary_contact_name"
              className="h-11"
              placeholder="Ej. Esposa, Hermano"
              value={form.secondary_contact_name}
              onChange={(e) => patch({ secondary_contact_name: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
