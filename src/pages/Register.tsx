import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Sparkles, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRIES, PY_DEPARTMENTS, citiesForDepartment } from "@/lib/locations";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

const REPAIRS_BUCKETS = ["1 a 5", "6 a 15", "16 a 30", "Más de 30"];

// Combobox con buscador para listas largas (departamentos/ciudades) — mismo
// patrón Popover+Command que ya usa el buscador de clientes en Modo Lote,
// pero genérico porque acá hace falta dos veces con listas distintas.
function SearchableSelect({
  value, onChange, options, placeholder, searchPlaceholder, emptyText, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-start font-normal"
        >
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          {value ? <span className="truncate">{value}</span> : <span className="truncate text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(itemValue, s) => (itemValue.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => { onChange(opt); setOpen(false); setSearch(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Register() {
  const [searchParams] = useSearchParams();
  const refSlug = searchParams.get("ref");

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [checkingPartner, setCheckingPartner] = useState(!!refSlug);

  // Preguntas del Programa Fundadores — solo cuando llega por un link de aliado.
  const [hasOwnShop, setHasOwnShop] = useState<"si" | "no" | "">("");
  const [weeklyRepairs, setWeeklyRepairs] = useState("");
  const [previousSystem, setPreviousSystem] = useState("");

  // País por geolocalización de IP (api/geo.ts) — solo pre-selecciona,
  // el usuario siempre puede cambiarlo. Departamento/ciudad solo aplican a PY.
  const [country, setCountry] = useState("PY");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const isParaguay = country === "PY";
  // react-phone-input-2 espera un código ISO2 en minúscula; "OTHER" no es un
  // país real así que cae a Paraguay (mercado principal) como default.
  const phoneCountry = (country === "OTHER" ? "PY" : country).toLowerCase();

  useEffect(() => { document.title = "Registro | F7 Manager Pro"; }, []);

  useEffect(() => {
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const detected = data?.country as string | undefined;
        if (detected && COUNTRIES.some((c) => c.code === detected)) setCountry(detected);
      })
      .catch(() => { /* sin geo, se queda en Paraguay por defecto */ });
  }, []);

  useEffect(() => {
    if (!refSlug) { setCheckingPartner(false); return; }
    supabase
      .from("referral_partners")
      .select("name")
      .eq("slug", refSlug)
      .maybeSingle()
      .then(({ data }) => {
        setPartnerName(data?.name ?? null);
        setCheckingPartner(false);
      });
  }, [refSlug]);

  const isFounderFlow = !!partnerName;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFounderFlow && (!hasOwnShop || !weeklyRepairs)) {
      toast({ title: "Faltan datos", description: "Completá las dos preguntas para continuar.", variant: "destructive" });
      return;
    }
    if (isParaguay && !department) {
      toast({ title: "Faltan datos", description: "Elegí tu departamento.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/login`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            business_name: businessName,
            phone,
            country,
            department: isParaguay ? department : "",
            city: isParaguay ? city : "",
            ...(isFounderFlow
              ? {
                  referral_slug: refSlug,
                  has_own_shop: hasOwnShop === "si" ? "true" : "false",
                  weekly_repairs_estimate: weeklyRepairs,
                  previous_system: previousSystem,
                }
              : {}),
          },
        },
      });
      setLoading(false);

      if (error) {
        let msg = error.message;
        if (error.message.includes("weak")) {
          msg = "La contraseña es muy débil. Debe incluir letras, números y símbolos.";
        } else if (error.message.includes("already registered") || error.message.includes("already exists")) {
          msg = "Este correo electrónico ya está registrado.";
        }
        toast({ title: "Error", description: msg, variant: "destructive" });
        return;
      }

      if (data?.session) {
        toast({ title: "¡Cuenta creada!", description: "Ingresando..." });
        navigate("/dashboard", { replace: true });
      } else {
        toast({
          title: "¡Cuenta creada!",
          description: "Te enviamos un correo de verificación. Por favor, revisá tu casilla (y Spam) para confirmar tu cuenta.",
        });
        navigate("/login", { replace: true });
      }
    } catch (err: any) {
      setLoading(false);
      toast({
        title: "Error",
        description: err?.message || "Ocurrió un error inesperado al registrar.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Wrench className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>Empezá a gestionar tus reparaciones</CardDescription>
        </CardHeader>
        <CardContent>
          {!checkingPartner && isFounderFlow && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Te invitó <b>{partnerName}</b> al Programa Fundadores — completá tus datos y en breve activamos tu acceso.
              </span>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">Nombre del taller</Label>
              <Input id="businessName" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <PhoneInput
                country={phoneCountry}
                value={phone}
                onChange={(value) => setPhone(value)}
                disableDropdown
                countryCodeEditable={false}
                specialLabel=""
                inputProps={{ id: "phone", name: "phone" }}
                inputClass="!h-10 !w-full !rounded-md !border-input !bg-background !text-sm !text-foreground"
                buttonClass="!rounded-l-md !border-input !bg-background"
                dropdownClass="!bg-popover !text-popover-foreground"
                containerClass="!w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>

            <div className="space-y-2">
              <Label>País</Label>
              <Select value={country} onValueChange={(v) => { setCountry(v); setDepartment(""); setCity(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isParaguay && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <SearchableSelect
                    value={department}
                    onChange={(v) => { setDepartment(v); setCity(""); }}
                    options={PY_DEPARTMENTS}
                    placeholder="Elegí uno"
                    searchPlaceholder="Buscar departamento..."
                    emptyText="Ningún departamento coincide."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <SearchableSelect
                    value={city}
                    onChange={setCity}
                    options={citiesForDepartment(department)}
                    placeholder={department ? "Elegí una ciudad" : "Elegí primero el departamento"}
                    searchPlaceholder="Buscar ciudad..."
                    emptyText="Ninguna ciudad coincide."
                    disabled={!department}
                  />
                </div>
              </div>
            )}

            {isFounderFlow && (
              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="space-y-2">
                  <Label>¿Tenés local propio?</Label>
                  <Select value={hasOwnShop} onValueChange={(v) => setHasOwnShop(v as "si" | "no")}>
                    <SelectTrigger><SelectValue placeholder="Elegí una opción" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="si">Sí</SelectItem>
                      <SelectItem value="no">No, trabajo de forma independiente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>¿Cuántas reparaciones hacés por semana, aproximadamente?</Label>
                  <Select value={weeklyRepairs} onValueChange={setWeeklyRepairs}>
                    <SelectTrigger><SelectValue placeholder="Elegí una opción" /></SelectTrigger>
                    <SelectContent>
                      {REPAIRS_BUCKETS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="previousSystem">¿Usás algún sistema hoy para gestionar tu taller? (opcional)</Label>
                  <Input
                    id="previousSystem"
                    placeholder="Ej: cuaderno, Excel, otro sistema..."
                    value={previousSystem}
                    onChange={(e) => setPreviousSystem(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || checkingPartner}>
              {loading ? "Creando..." : "Crear cuenta"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tenés cuenta?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Iniciá sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
