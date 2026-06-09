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
import { CheckCircle2, MessageCircle, Loader2, Bell, Plus, Pencil, Trash2, Building2, Users, Crown, Lock, ShieldCheck } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import SubscriptionTab from "@/components/SubscriptionTab";
import WarrantyPresetsTab from "@/components/WarrantyPresetsTab";

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
  full_name: string | null; business_name: string | null; phone: string | null;
  whatsapp_connected: boolean; whatsapp_phone: string | null;
  notification_preferences: NotifPrefs;
  branch_id: string | null;
}

type Branch = { id: string; name: string; address: string | null };
type UserRow = {
  id: string; full_name: string | null; phone: string | null; branch_id: string | null;
  role: "admin" | "staff" | null;
};

export default function Settings() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
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
      .select("full_name, business_name, phone, whatsapp_connected, whatsapp_phone, notification_preferences, branch_id")
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
      full_name: profile.full_name, business_name: profile.business_name, phone: profile.phone,
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
      toast({ title: "Error", description: data?.error ?? error?.message ?? "No se pudo conectar", variant: "destructive" });
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
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="perfil" className="h-9">Perfil</TabsTrigger>
          <TabsTrigger value="whatsapp" className="h-9">WhatsApp</TabsTrigger>
          <TabsTrigger value="sucursales" className="h-9"><Building2 className="mr-1 h-4 w-4" /> Sucursales</TabsTrigger>
          <TabsTrigger value="usuarios" className="h-9"><Users className="mr-1 h-4 w-4" /> Usuarios</TabsTrigger>
          <TabsTrigger value="garantias" className="h-9"><ShieldCheck className="mr-1 h-4 w-4" /> Garantías</TabsTrigger>
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
                  <Label>Nombre del taller</Label>
                  <Input value={profile.business_name ?? ""} onChange={(e) => setProfile({ ...profile, business_name: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Teléfono</Label>
                  <Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Guardando..." : "Guardar cambios"}</Button>
            </CardContent>
          </Card>

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

        <TabsContent value="usuarios">
          <UsersTab />
        </TabsContent>

        <TabsContent value="garantias">
          <WarrantyPresetsTab />
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
    const { error } = editing
      ? await supabase.from("branches").update({ name: name.trim(), address: address.trim() || null }).eq("id", editing.id)
      : await supabase.from("branches").insert({ company_id: companyId!, name: name.trim(), address: address.trim() || null });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setOpen(false);
    toast({ title: editing ? "Sucursal actualizada" : "Sucursal creada" });
    load();
  };

  const remove = async (b: Branch) => {
    if (!confirm(`¿Eliminar la sucursal "${b.name}"?`)) return;
    const { error } = await supabase.from("branches").delete().eq("id", b.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
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
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(b)}><Trash2 className="h-4 w-4" /></Button>
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
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? "Guardar" : "Crear"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ---------- Usuarios ---------- */
function UsersTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [{ data: profs }, { data: brs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, branch_id").eq("company_id", companyId),
      supabase.from("branches").select("id, name, address").eq("company_id", companyId).order("name"),
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
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

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
      return toast({ title: "Error", description: data?.error ?? error?.message ?? "No se pudo crear", variant: "destructive" });
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

  const { isStarter, limits } = usePlan();
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

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Sucursal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                    <TableCell>
                      <Select value={u.role ?? "staff"} onValueChange={(v) => updateUserRole(u.id, v as any)}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={u.branch_id ?? ""} onValueChange={(v) => updateUserBranch(u.id, v)}>
                        <SelectTrigger className="w-48"><SelectValue placeholder="Sin sucursal" /></SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
