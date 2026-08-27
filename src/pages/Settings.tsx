import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, MessageCircle, Loader2, Bell, Plus, Pencil, Trash2, Building2, Users, Crown, Lock, ShieldCheck, Tags, Percent, PackageCheck, FileText, ImagePlus, ListChecks } from "lucide-react";
import imageCompression from "browser-image-compression";
import { usePlan } from "@/hooks/usePlan";
import { useCategories } from "@/hooks/useCategories";
import SubscriptionTab from "@/components/SubscriptionTab";
import WarrantyPresetsTab from "@/components/WarrantyPresetsTab";
import AccessoryPresetsTab from "@/components/AccessoryPresetsTab";
import ChecklistPresetsTab from "@/components/ChecklistPresetsTab";
import ProblemPresetsTab from "@/components/ProblemPresetsTab";
import ServiceTermsTab from "@/components/ServiceTermsTab";
import OrderStatusPresetsTab from "@/components/OrderStatusPresetsTab";
import { COUNTRIES, PY_DEPARTMENTS } from "@/lib/locations";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type NotifPrefs = {
  recibido: boolean;
  en_diagnostico: boolean;
  en_reparacion: boolean;
  listo: boolean;
  entregado: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  recibido: true, en_diagnostico: false, en_reparacion: false, listo: true, entregado: false,
};

const STATUS_LABELS: { key: keyof NotifPrefs; label: string }[] = [
  { key: "recibido", label: "Recibido" },
  { key: "en_diagnostico", label: "En diagnóstico" },
  { key: "en_reparacion", label: "En reparación" },
  { key: "listo", label: "Listo para retirar" },
  { key: "entregado", label: "Entregado" },
];

interface Profile {
  full_name: string | null; phone: string | null;
  whatsapp_connected: boolean; whatsapp_phone: string | null;
  notification_preferences: NotifPrefs;
  branch_id: string | null;
}

type Branch = { id: string; name: string; address: string | null };
type UserRow = {
  id: string; full_name: string | null; phone: string | null; branch_id: string | null;
  role: "admin" | "staff" | null;
  commission_rate: number;
};

// supabase-js no parsea el cuerpo de la respuesta cuando una Edge Function
// devuelve un status no-2xx: solo da un FunctionsHttpError genérico ("Edge
// Function returned a non-2xx status code") y deja el body real sin leer en
// error.context. Sin esto, cualquier error específico que devuelva la función
// (email duplicado, rol inválido, etc.) queda oculto detrás de ese mensaje
// genérico e imposible de diagnosticar desde la UI.
async function edgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (body?.error) return String(body.error);
    } catch { /* respuesta sin JSON */ }
  }
  return (error as Error)?.message || fallback;
}

export default function Settings() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { isStarter: isStarterPlan } = usePlan();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [qr, setQr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => { document.title = "Configuración | F7 Manager Pro"; }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, whatsapp_connected, whatsapp_phone, notification_preferences, branch_id")
      .eq("id", user.id).maybeSingle();
    if (data) {
      const prefs = { ...DEFAULT_PREFS, ...((data as any).notification_preferences as Partial<NotifPrefs> ?? {}) };
      setProfile({ ...(data as any), notification_preferences: prefs });
    }
  };
  useEffect(() => { load(); }, [user]);

  const togglePref = async (key: keyof NotifPrefs, value: boolean) => {
    if (!user || !profile) return;
    const next = { ...profile.notification_preferences, [key]: value };
    setProfile({ ...profile, notification_preferences: next });
    setSavingPrefs(true);
    const { error } = await supabase.from("profiles")
      .update({ notification_preferences: next as any })
      .eq("id", user.id);
    setSavingPrefs(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setProfile({ ...profile });
    }
  };

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const saveProfile = async () => {
    if (!user || !profile) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name, phone: profile.phone,
    }).eq("id", user.id);
    setSavingProfile(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Perfil actualizado" });
  };

  const startPolling = () => {
    if (pollRef.current) return;
    setPolling(true);
    pollRef.current = window.setInterval(async () => {
      const { data, error } = await supabase.functions.invoke("check-whatsapp-status");
      if (error) return;
      if (data?.state === "open") {
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        setPolling(false); setQr(null);
        toast({ title: "¡WhatsApp conectado!" });
        load();
      }
    }, 3000);
  };

  const connect = async () => {
    setConnecting(true);
    const { data, error } = await supabase.functions.invoke("connect-whatsapp-evolution");
    setConnecting(false);
    if (error || data?.error) {
      const description = data?.error ?? await edgeFunctionErrorMessage(error, "No se pudo conectar");
      toast({ title: "Error", description, variant: "destructive" });
      return;
    }
    if (data?.qr) { setQr(data.qr); startPolling(); }
    else toast({ title: "Sin QR", description: "Revisá la configuración de Evolution API." });
  };

  const disconnect = async () => {
    await supabase.functions.invoke("disconnect-whatsapp");
    setQr(null);
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
    toast({ title: "Desconectado" });
    load();
  };

  if (roleLoading || !profile) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ADMIN-ONLY route
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const qrSrc = qr ? (qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">Gestioná tu taller, sucursales y usuarios.</p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className={`grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 ${isStarterPlan ? "lg:grid-cols-10" : "lg:grid-cols-11"}`}>
          <TabsTrigger value="perfil" className="h-9">Perfil</TabsTrigger>
          <TabsTrigger value="whatsapp" className="h-9">WhatsApp</TabsTrigger>
          <TabsTrigger value="sucursales" className="h-9"><Building2 className="mr-1 h-4 w-4" /> Sucursales</TabsTrigger>
          {!isStarterPlan && (
            <TabsTrigger value="categorias" className="h-9"><Tags className="mr-1 h-4 w-4" /> Categorías</TabsTrigger>
          )}
          <TabsTrigger value="usuarios" className="h-9"><Users className="mr-1 h-4 w-4" /> Usuarios</TabsTrigger>
          <TabsTrigger value="garantias" className="h-9"><ShieldCheck className="mr-1 h-4 w-4" /> Garantías</TabsTrigger>
          <TabsTrigger value="recepcion" className="h-9"><PackageCheck className="mr-1 h-4 w-4" /> Accesorios</TabsTrigger>
          <TabsTrigger value="estados" className="h-9"><ListChecks className="mr-1 h-4 w-4" /> Estados</TabsTrigger>
          <TabsTrigger value="terminos" className="h-9"><FileText className="mr-1 h-4 w-4" /> Términos</TabsTrigger>
          <TabsTrigger value="seguridad" className="h-9"><Lock className="mr-1 h-4 w-4" /> Seguridad</TabsTrigger>
          <TabsTrigger value="suscripcion" className="h-9"><Crown className="mr-1 h-4 w-4" /> Suscripción</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="font-semibold">Perfil</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Guardando..." : "Guardar cambios"}</Button>
            </CardContent>
          </Card>

          <BusinessIdentityCard />

          <LocationCard />

          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="font-semibold">Notificaciones Automáticas</div>
                  <div className="text-xs text-muted-foreground">
                    Elegí en qué cambios de estado se envía un mensaje de WhatsApp al cliente.
                  </div>
                </div>
                {savingPrefs && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="divide-y rounded-md border">
                {STATUS_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between px-4 py-3">
                    <Label htmlFor={`notif-${key}`} className="cursor-pointer text-sm font-medium">{label}</Label>
                    <Switch id={`notif-${key}`} checked={profile.notification_preferences[key]} onCheckedChange={(v) => togglePref(key, v)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="font-semibold">WhatsApp</div>
                  <div className="text-xs text-muted-foreground">Notificá automáticamente a tus clientes.</div>
                </div>
                {profile.whatsapp_connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--status-listo-bg))] px-2.5 py-0.5 text-xs font-medium text-[hsl(var(--status-listo))]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Desconectado
                  </span>
                )}
              </div>

              {profile.whatsapp_connected && profile.whatsapp_phone && (
                <div className="text-sm text-muted-foreground">Número: {profile.whatsapp_phone}</div>
              )}

              {qrSrc && (
                <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-6">
                  <img src={qrSrc} alt="QR de WhatsApp" className="h-56 w-56 rounded-md bg-white p-2" />
                  <p className="text-center text-sm text-muted-foreground">
                    Escaneá el código con WhatsApp → Dispositivos vinculados
                  </p>
                  {polling && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Esperando conexión...
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {profile.whatsapp_connected ? (
                  <Button variant="outline" onClick={disconnect}>Desconectar</Button>
                ) : (
                  <Button onClick={connect} disabled={connecting}>
                    {connecting ? "Generando QR..." : "Conectar WhatsApp"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sucursales">
          <BranchesTab />
        </TabsContent>

        {!isStarterPlan && (
          <TabsContent value="categorias">
            <CategoryManagerTab />
          </TabsContent>
        )}

        <TabsContent value="usuarios">
          <UsersTab />
        </TabsContent>

        <TabsContent value="garantias">
          <WarrantyPresetsTab />
        </TabsContent>

        <TabsContent value="recepcion" className="space-y-6">
          <ProblemPresetsTab />
          <AccessoryPresetsTab />
          <ChecklistPresetsTab />
        </TabsContent>

        <TabsContent value="estados">
          <OrderStatusPresetsTab />
        </TabsContent>

        <TabsContent value="terminos">
          <ServiceTermsTab />
        </TabsContent>

        <TabsContent value="seguridad">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="suscripcion">
          <SubscriptionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Identidad del taller (nombre + logo) ---------- */
// companies.name es la fuente correcta para lo que el CLIENTE ve (WhatsApp,
// preview del link, página de seguimiento) — es de toda la empresa, no de
// un usuario particular. profiles.business_name (usado antes acá) nunca
// llegó a alimentar esas pantallas, quedaba desincronizado.
function BusinessIdentityCard() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("companies").select("name, logo_url").eq("id", companyId)
      .maybeSingle<{ name: string | null; logo_url: string | null }>();
    if (data) { setName(data.name ?? ""); setLogoUrl(data.logo_url ?? null); }
  };
  useEffect(() => { load(); }, [companyId]);

  const saveName = async () => {
    if (!companyId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({ name: name.trim() }).eq("id", companyId);
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Nombre del taller actualizado" });
  };

  const uploadLogo = async (file: File) => {
    if (!companyId) return;
    setUploading(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 512, useWebWorker: true });
      const path = `${companyId}/${crypto.randomUUID()}-${compressed.name}`;
      const { error: upErr } = await supabase.storage.from("company-logos").upload(path, compressed, { contentType: compressed.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
      const { error } = await supabase.from("companies").update({ logo_url: data.publicUrl }).eq("id", companyId);
      if (error) throw error;
      setLogoUrl(data.publicUrl);
      toast({ title: "Logo actualizado" });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo subir el logo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Identidad del taller</div>
            <div className="text-xs text-muted-foreground">
              El nombre y el logo que ven tus clientes en el WhatsApp y en el link de seguimiento.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo del taller" className="h-full w-full object-contain" />
            ) : (
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="logo_upload" className="cursor-pointer text-sm font-medium text-primary hover:underline">
              {uploading ? "Subiendo..." : logoUrl ? "Cambiar logo" : "Subir logo"}
            </Label>
            <input
              id="logo_upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }}
            />
            <p className="text-xs text-muted-foreground">Si no subís uno, se usa el logo de F7 Manager Pro.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_name">Nombre del taller</Label>
          <Input id="company_name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button onClick={saveName} disabled={saving || !companyId}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
      </CardContent>
    </Card>
  );
}

/* ---------- Ubicación del taller ---------- */
function LocationCard() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [country, setCountry] = useState("PY");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const isParaguay = country === "PY";

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("country, department, city").eq("id", companyId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCountry(data.country ?? "PY");
        setDepartment(data.department ?? "");
        setCity(data.city ?? "");
      });
  }, [companyId]);

  const save = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      country,
      department: isParaguay ? (department || null) : null,
      city: isParaguay ? (city || null) : null,
    }).eq("id", companyId);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Ubicación actualizada" });
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <div className="font-semibold">Ubicación del taller</div>
          <div className="text-xs text-muted-foreground">Nos ayuda a entender dónde estamos creciendo.</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="Elegí uno" /></SelectTrigger>
                <SelectContent>
                  {PY_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {isParaguay && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Ciudad</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          )}
        </div>
        <Button onClick={save} disabled={saving || !companyId}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
      </CardContent>
    </Card>
  );
}

/* ---------- Sucursales ---------- */
function BranchesTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [items, setItems] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase.from("branches").select("id, name, address").eq("company_id", companyId).order("name");
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setItems((data ?? []) as Branch[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const openNew = () => { setEditing(null); setName(""); setAddress(""); setOpen(true); };
  const openEdit = (b: Branch) => { setEditing(b); setName(b.name); setAddress(b.address ?? ""); setOpen(true); };

  const save = async () => {
    if (!name.trim()) return;
    if (!editing && !companyId) {
      return toast({ title: "Error", description: "No se pudo determinar la empresa.", variant: "destructive" });
    }
    setSaving(true);
    const { error } = editing
      ? await supabase.from("branches").update({ name: name.trim(), address: address.trim() || null }).eq("id", editing.id)
      : await supabase.from("branches").insert({ company_id: companyId!, name: name.trim(), address: address.trim() || null });
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setOpen(false);
    toast({ title: editing ? "Sucursal actualizada" : "Sucursal creada" });
    load();
  };

  const remove = async (b: Branch) => {
    setDeleting(true);
    const { error } = await supabase.from("branches").delete().eq("id", b.id);
    setDeleting(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setPendingDelete(null);
    load();
  };

  const { isStarter, limits } = usePlan();
  const atBranchLimit = isStarter && items.length >= limits.branches;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Sucursales</div>
            <div className="text-xs text-muted-foreground">Locales o puntos de atención de tu taller.</div>
          </div>
          <Button onClick={openNew} disabled={atBranchLimit}><Plus className="mr-2 h-4 w-4" /> Nueva sucursal</Button>
        </div>
        {isStarter && (
          <div className="text-xs text-muted-foreground">
            El plan <span className="font-semibold text-secondary">Starter</span> permite 1 sucursal y 1 usuario. Pásate a <span className="font-semibold text-secondary">PRO</span> para expandir tu equipo.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aún no creaste sucursales.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.address ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label={`Editar ${b.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setPendingDelete(b)} aria-label={`Eliminar ${b.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
              <DialogDescription>Datos del local de atención.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sucursal Centro" />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Principal 123" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : editing ? "Guardar" : "Crear"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="¿Eliminar sucursal?"
        description={pendingDelete ? `Se eliminará la sucursal "${pendingDelete.name}". Esta acción no se puede deshacer.` : ""}
        loading={deleting}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />
    </Card>
  );
}

/* ---------- Categorías ---------- */
function CategoryManagerTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const { categories, subcategoriesFor, loading, reload } = useCategories();

  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  const [subFor, setSubFor] = useState<{ id: string; name: string } | null>(null);
  const [subName, setSubName] = useState("");
  const [savingSub, setSavingSub] = useState(false);

  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<{ id: string; name: string } | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [pendingDeleteSubcategory, setPendingDeleteSubcategory] = useState<{ id: string; name: string } | null>(null);
  const [deletingSubcategory, setDeletingSubcategory] = useState(false);

  const createCategory = async () => {
    if (!catName.trim() || !companyId) return;
    setSavingCat(true);
    const { error } = await supabase.from("inventory_categories").insert({ company_id: companyId, name: catName.trim() });
    setSavingCat(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setCatOpen(false);
    setCatName("");
    toast({ title: "Categoría creada" });
    reload();
  };

  const removeCategory = async (id: string) => {
    setDeletingCategory(true);
    const { error } = await supabase.from("inventory_categories").delete().eq("id", id);
    setDeletingCategory(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setPendingDeleteCategory(null);
    reload();
  };

  const openNewSub = (cat: { id: string; name: string }) => { setSubFor(cat); setSubName(""); };

  const createSubcategory = async () => {
    if (!subName.trim() || !companyId || !subFor) return;
    setSavingSub(true);
    const { error } = await supabase.from("inventory_subcategories").insert({
      company_id: companyId, category_id: subFor.id, name: subName.trim(),
    });
    setSavingSub(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setSubFor(null);
    setSubName("");
    toast({ title: "Subcategoría creada" });
    reload();
  };

  const removeSubcategory = async (id: string) => {
    setDeletingSubcategory(true);
    const { error } = await supabase.from("inventory_subcategories").delete().eq("id", id);
    setDeletingSubcategory(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setPendingDeleteSubcategory(null);
    reload();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Categorías</div>
            <div className="text-xs text-muted-foreground">
              Organizá tu inventario y catálogo de venta por categoría y subcategoría (ej: Accesorios → Auriculares). Compartidas entre Inventario y Productos.
            </div>
          </div>
          <Button onClick={() => setCatOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nueva categoría</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : categories.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Todavía no creaste categorías. Categorizar es opcional, pero ayuda a ordenar el inventario y a ver mejores métricas en Reportes.
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-foreground">{cat.name}</div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openNewSub(cat)} className="gap-1 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Subcategoría
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setPendingDeleteCategory(cat)} aria-label={`Eliminar categoría ${cat.name}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {subcategoriesFor(cat.id).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {subcategoriesFor(cat.id).map((sub) => (
                      <span key={sub.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                        {sub.name}
                        <button
                          type="button"
                          onClick={() => setPendingDeleteSubcategory(sub)}
                          aria-label={`Eliminar subcategoría ${sub.name}`}
                          className="rounded-full text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Dialog open={catOpen} onOpenChange={setCatOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva categoría</DialogTitle>
              <DialogDescription>Ej: Repuestos, Accesorios, Herramientas, Celulares...</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Accesorios" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCatOpen(false)} disabled={savingCat}>Cancelar</Button>
              <Button onClick={createCategory} disabled={savingCat || !catName.trim()}>
                {savingCat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!subFor} onOpenChange={(o) => !o && setSubFor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva subcategoría de "{subFor?.name}"</DialogTitle>
              <DialogDescription>Ej: Auriculares, Cargadores, Fundas...</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Auriculares" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubFor(null)} disabled={savingSub}>Cancelar</Button>
              <Button onClick={createSubcategory} disabled={savingSub || !subName.trim()}>
                {savingSub && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>

      <ConfirmDialog
        open={!!pendingDeleteCategory}
        onOpenChange={(o) => !o && setPendingDeleteCategory(null)}
        title="¿Eliminar categoría?"
        description={pendingDeleteCategory ? `Se eliminará "${pendingDeleteCategory.name}" y sus subcategorías. Los artículos que la usan quedarán sin categoría.` : ""}
        loading={deletingCategory}
        onConfirm={() => pendingDeleteCategory && removeCategory(pendingDeleteCategory.id)}
      />
      <ConfirmDialog
        open={!!pendingDeleteSubcategory}
        onOpenChange={(o) => !o && setPendingDeleteSubcategory(null)}
        title="¿Eliminar subcategoría?"
        description={pendingDeleteSubcategory ? `Se eliminará "${pendingDeleteSubcategory.name}".` : ""}
        loading={deletingSubcategory}
        onConfirm={() => pendingDeleteSubcategory && removeSubcategory(pendingDeleteSubcategory.id)}
      />
    </Card>
  );
}

/* ---------- Usuarios ---------- */
function UsersTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const { isStarter, isRetail, limits } = usePlan();
  const canUseCommissions = !isStarter && !isRetail;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [savingCommissionToggle, setSavingCommissionToggle] = useState(false);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", phone: "",
    role: "staff" as "admin" | "staff",
    branch_id: "" as string,
  });

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: profs }, { data: brs }, { data: company }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, branch_id, commission_rate").eq("company_id", companyId),
      supabase.from("branches").select("id, name, address").eq("company_id", companyId).order("name"),
      supabase.from("companies").select("commission_enabled").eq("id", companyId).maybeSingle(),
    ]);
    const userIds = (profs ?? []).map((p: any) => p.id);
    let roles: any[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
      roles = data ?? [];
    }
    const roleMap = new Map<string, "admin" | "staff">();
    roles.forEach((r: any) => {
      const cur = roleMap.get(r.user_id);
      if (cur === "admin") return;
      roleMap.set(r.user_id, r.role);
    });
    setUsers(((profs ?? []) as any[]).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null })));
    setBranches((brs ?? []) as Branch[]);
    setCommissionEnabled(!!company?.commission_enabled);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const toggleCommissionEnabled = async (value: boolean) => {
    if (!companyId) return;
    setSavingCommissionToggle(true);
    setCommissionEnabled(value);
    const { error } = await supabase.from("companies").update({ commission_enabled: value }).eq("id", companyId);
    setSavingCommissionToggle(false);
    if (error) {
      setCommissionEnabled(!value);
      return toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    toast({ title: value ? "Comisiones habilitadas" : "Comisiones deshabilitadas" });
  };

  const updateUserCommissionRate = async (userId: string, rate: number) => {
    const clamped = Math.max(0, Math.min(100, rate));
    const { error } = await supabase.from("profiles").update({ commission_rate: clamped }).eq("id", userId);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, commission_rate: clamped } : u)));
  };

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—";

  const createUser = async () => {
    if (!form.email || !form.password) {
      return toast({ title: "Faltan datos", description: "Email y contraseña son obligatorios.", variant: "destructive" });
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone,
        role: form.role,
        branch_id: form.branch_id || null,
      },
    });
    setCreating(false);
    if (error || data?.error) {
      const description = data?.error ?? await edgeFunctionErrorMessage(error, "No se pudo crear");
      return toast({ title: "Error", description, variant: "destructive" });
    }
    toast({ title: "Usuario creado" });
    setOpen(false);
    setForm({ email: "", password: "", full_name: "", phone: "", role: "staff", branch_id: "" });
    load();
  };

  const updateUserRole = async (userId: string, newRole: "admin" | "staff") => {
    // Replace all existing roles with the chosen one
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Rol actualizado" });
    load();
  };

  const updateUserBranch = async (userId: string, branch_id: string) => {
    const { error } = await supabase.from("profiles")
      .update({ branch_id: branch_id || null })
      .eq("id", userId);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Sucursal actualizada" });
    load();
  };

  const atUserLimit = isStarter && users.length >= limits.users;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Usuarios</div>
            <div className="text-xs text-muted-foreground">Personal con acceso al sistema. Asigná rol y sucursal.</div>
          </div>
          <Button onClick={() => setOpen(true)} disabled={atUserLimit}><Plus className="mr-2 h-4 w-4" /> Nuevo usuario</Button>
        </div>
        {isStarter && (
          <div className="text-xs text-muted-foreground">
            El plan <span className="font-semibold text-secondary">Starter</span> permite 1 sucursal y 1 usuario. Pásate a <span className="font-semibold text-secondary">PRO</span> para expandir tu equipo.
          </div>
        )}

        {canUseCommissions && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              <div>
                <Label htmlFor="commission-toggle" className="cursor-pointer text-sm font-medium">Comisiones por venta/reparación</Label>
                <div className="text-xs text-muted-foreground">Si tu negocio paga comisión al personal, habilitala y asigná un % por persona.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savingCommissionToggle && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch id="commission-toggle" checked={commissionEnabled} onCheckedChange={toggleCommissionEnabled} />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Mobile: tarjetas — 2 selects a ancho fijo no entran junto al nombre en un viewport chico */}
            <div className="space-y-3 sm:hidden">
              {users.map((u) => (
                <div key={u.id} className="space-y-3 rounded-lg border border-border bg-card p-3">
                  <div>
                    <div className="font-medium text-foreground">{u.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.phone || "Sin teléfono"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Rol</Label>
                      <Select value={u.role ?? "staff"} onValueChange={(v) => updateUserRole(u.id, v as any)}>
                        <SelectTrigger aria-label={`Rol de ${u.full_name || "usuario"}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Sucursal</Label>
                      <Select value={u.branch_id ?? ""} onValueChange={(v) => updateUserBranch(u.id, v)}>
                        <SelectTrigger aria-label={`Sucursal de ${u.full_name || "usuario"}`}><SelectValue placeholder="Sin sucursal" /></SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {commissionEnabled && canUseCommissions && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Comisión</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          defaultValue={u.commission_rate}
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value);
                            if (Number.isFinite(v) && v !== u.commission_rate) updateUserCommissionRate(u.id, v);
                          }}
                          className="w-20"
                          aria-label={`Comisión de ${u.full_name || "usuario"}`}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop/tablet: tabla completa */}
            <div className="hidden rounded-md border overflow-x-auto sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Sucursal</TableHead>
                    {commissionEnabled && canUseCommissions && <TableHead>Comisión</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                      <TableCell>
                        <Select value={u.role ?? "staff"} onValueChange={(v) => updateUserRole(u.id, v as any)}>
                          <SelectTrigger className="w-32" aria-label={`Rol de ${u.full_name || "usuario"}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={u.branch_id ?? ""} onValueChange={(v) => updateUserBranch(u.id, v)}>
                          <SelectTrigger className="w-48" aria-label={`Sucursal de ${u.full_name || "usuario"}`}><SelectValue placeholder="Sin sucursal" /></SelectTrigger>
                          <SelectContent>
                            {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {commissionEnabled && canUseCommissions && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              defaultValue={u.commission_rate}
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value);
                                if (Number.isFinite(v) && v !== u.commission_rate) updateUserCommissionRate(u.id, v);
                              }}
                              className="w-20"
                              aria-label={`Comisión de ${u.full_name || "usuario"}`}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo usuario</DialogTitle>
              <DialogDescription>Creá una cuenta y asigná rol y sucursal.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Contraseña temporal</Label>
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sucursal</Label>
                  <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={createUser} disabled={creating}>
                {creating ? "Creando..." : "Crear usuario"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ---------- Seguridad ---------- */
function SecurityTab() {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      return toast({ title: "Contraseña muy corta", description: "Debe tener al menos 6 caracteres.", variant: "destructive" });
    }
    if (newPassword !== confirmPassword) {
      return toast({ title: "No coinciden", description: "Las contraseñas no coinciden.", variant: "destructive" });
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: "Contraseña actualizada", description: "Tu contraseña se cambió correctamente." });
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Seguridad</div>
            <div className="text-xs text-muted-foreground">Actualizá la contraseña de tu cuenta.</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nueva contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? "Actualizando..." : "Actualizar Contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
