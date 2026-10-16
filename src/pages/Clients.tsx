import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { Pencil, Search, Users as UsersIcon, MessageCircle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { notifyMessageQueueChanged } from "@/lib/customerMessages";
import { clearPostSaleCache } from "@/lib/pendingMessages";
import { resolveStatusLabel } from "@/lib/orders";
import { useOrderStatusPresets } from "@/hooks/useOrderStatusPresets";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

const PAGE_SIZE = 50;

type Client = {
  id: string;
  name: string;
  phone: string | null;
  cedula: string | null;
  notify_whatsapp: boolean;
  birth_date: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  device_type: string;
  status: string;
  client_id: string | null;
  created_at: string;
};

export default function Clients() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const { presets: statusPresets } = useOrderStatusPresets();
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCedula, setEditCedula] = useState("");
  const [editNotifyWhatsapp, setEditNotifyWhatsapp] = useState(true);
  const [editBirthDate, setEditBirthDate] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user || !companyId) return;
    setLoading(true);
    const [{ data: c, error: cErr }, { data: o, error: oErr }] = await Promise.all([
      supabase.from("clients").select("id,name,phone,cedula,notify_whatsapp,birth_date,created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("orders").select("id,order_number,device_type,status,client_id,created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
    ]);
    if (cErr || oErr) {
      toast({ title: "Error al cargar clientes", description: (cErr ?? oErr)?.message, variant: "destructive" });
    }
    setClients((c ?? []) as Client[]);
    setOrders((o ?? []) as OrderRow[]);
    setLoading(false);
  };

  // user?.id (no el objeto user): ver Dashboard.tsx — evita reiniciar el
  // listado por un simple refresh de token al volver de otra pestaña.
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, companyId]);

  const ordersByClient = useMemo(() => {
    const m = new Map<string, OrderRow[]>();
    for (const o of orders) {
      if (!o.client_id) continue;
      const arr = m.get(o.client_id) ?? [];
      arr.push(o);
      m.set(o.client_id, arr);
    }
    return m;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.cedula ?? "").toLowerCase().includes(q)
    );
  }, [clients, search]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search]);
  const visible = filtered.slice(0, visibleCount);

  // orders viene ordenado de más nueva a más vieja, así que la primera de cada cliente es la última.
  const lastOrderAgo = (clientId: string) => {
    const last = ordersByClient.get(clientId)?.[0];
    return last ? formatDistanceToNowStrict(new Date(last.created_at), { locale: es, addSuffix: true }) : null;
  };

  const clientDraftKey = (cid: string) => `f7_client_draft_${cid}`;

  const openEdit = (c: Client) => {
    setEditing(c);
    // Hydrate from draft if exists, otherwise from the row
    let draft: { name?: string; phone?: string; cedula?: string; notifyWhatsapp?: boolean; birthDate?: string } | null = null;
    try {
      const raw = localStorage.getItem(clientDraftKey(c.id));
      if (raw) draft = JSON.parse(raw);
    } catch { /* ignore */ }
    setEditName(draft?.name ?? c.name);
    setEditPhone(draft?.phone ?? (c.phone ?? "").replace(/^595/, ""));
    setEditCedula(draft?.cedula ?? (c.cedula ?? ""));
    setEditNotifyWhatsapp(draft?.notifyWhatsapp ?? c.notify_whatsapp);
    setEditBirthDate(draft?.birthDate ?? c.birth_date ?? "");
  };

  // Auto-save edit-client draft on change
  useEffect(() => {
    if (!editing) return;
    try {
      localStorage.setItem(clientDraftKey(editing.id), JSON.stringify({ name: editName, phone: editPhone, cedula: editCedula, notifyWhatsapp: editNotifyWhatsapp, birthDate: editBirthDate }));
    } catch { /* ignore */ }
  }, [editing, editName, editPhone, editCedula, editNotifyWhatsapp, editBirthDate]);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const phone = editPhone.replace(/\D/g, "");
    const { error } = await supabase
      .from("clients")
      .update({
        name: editName.trim() || "Cliente",
        phone: phone ? `595${phone}` : null,
        cedula: editCedula.trim() || null,
        notify_whatsapp: editNotifyWhatsapp,
        birth_date: editBirthDate || null,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    // La lista de cumpleaños de Avisos se guarda unos minutos: se renueva para que el cambio se vea ya.
    clearPostSaleCache();
    notifyMessageQueueChanged();
    toast({ title: "Cliente actualizado" });
    try { localStorage.removeItem(clientDraftKey(editing.id)); } catch {}
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <UsersIcon className="h-6 w-6 text-primary" />
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground">Gestioná tus clientes y mirá sus órdenes.</p>
        </div>
        <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
          {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
        </Badge>
      </div>

      <Card className="border-0 bg-transparent shadow-none sm:border sm:bg-card sm:shadow-sm">
        <CardHeader className="px-0 pt-0 sm:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono, cédula o RUC…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sin clientes.</div>
          ) : (
            <>
              {/* Mobile: tarjetas apiladas — la tabla de 5 columnas no entra en un viewport chico */}
              <div className="space-y-2 sm:hidden">
                {visible.map((c) => {
                  const count = ordersByClient.get(c.id)?.length ?? 0;
                  const ago = lastOrderAgo(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClient(c)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{c.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{c.phone ?? "Sin teléfono"}</span>
                          {c.cedula && <span className="font-mono">{c.cedula}</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {count === 0 ? "Sin órdenes" : `${count} ${count === 1 ? "orden" : "órdenes"} · última ${ago}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center">
                        {c.phone && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-success hover:text-success"
                            onClick={(e) => { e.stopPropagation(); openWhatsApp(c.phone!); }}
                            aria-label="Abrir chat de WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }} aria-label={`Editar ${c.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop/tablet: tabla completa */}
              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Cédula / RUC</TableHead>
                    <TableHead className="text-center">Órdenes</TableHead>
                    <TableHead>Última orden</TableHead>
                    <TableHead className="w-[110px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((c) => {
                    const count = ordersByClient.get(c.id)?.length ?? 0;
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedClient(c)}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{c.cedula ?? "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={count > 0 ? "default" : "secondary"}>{count}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{lastOrderAgo(c.id) ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {c.phone && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-success hover:text-success"
                              onClick={(e) => { e.stopPropagation(); openWhatsApp(c.phone!); }}
                              title="Abrir chat de WhatsApp"
                              aria-label="Abrir chat de WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }} aria-label={`Editar ${c.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {filtered.length > visible.length && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                    Mostrar más ({filtered.length - visible.length} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Actualizá los datos del cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-client-name">Nombre</Label>
              <Input id="edit-client-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-phone">Teléfono (sin 595)</Label>
              <Input
                id="edit-client-phone"
                inputMode="tel"
                placeholder="981 123 456"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-cedula">Cédula de Identidad / RUC (opcional)</Label>
              <Input
                id="edit-client-cedula"
                placeholder="1.234.567 o RUC"
                value={editCedula}
                onChange={(e) => setEditCedula(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-birth">Cumpleaños (opcional)</Label>
              <Input
                id="edit-client-birth"
                type="date"
                min="1900-01-01"
                max={new Date().toISOString().slice(0, 10)}
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Si activaste el saludo de cumpleaños en Configuración, F7 te lo recuerda ese día en Avisos.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-client-notify">Notificar por WhatsApp</Label>
                <p className="text-xs text-muted-foreground">
                  Desactivalo para clientes mayoristas u otros que no quieras que reciban los avisos automáticos (cambios de estado, orden creada, respuesta a presupuesto).
                </p>
              </div>
              <Switch id="edit-client-notify" checked={editNotifyWhatsapp} onCheckedChange={setEditNotifyWhatsapp} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(o) => !o && setSelectedClient(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedClient?.name}</DialogTitle>
            <DialogDescription>{selectedClient?.phone ?? "Sin teléfono"}</DialogDescription>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-3">
              {selectedClient.phone && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-success/30 text-success hover:bg-success/10 hover:text-success"
                  onClick={() => openWhatsApp(selectedClient.phone!)}
                >
                  <MessageCircle className="h-4 w-4" /> Abrir chat de WhatsApp
                </Button>
              )}
              {selectedClient.cedula && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Cédula / RUC: </span>
                  <span className="font-mono font-medium">{selectedClient.cedula}</span>
                </div>
              )}
              <h4 className="text-sm font-semibold">Órdenes</h4>
              {(ordersByClient.get(selectedClient.id) ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Este cliente aún no tiene órdenes.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {(ordersByClient.get(selectedClient.id) ?? []).map((o) => (
                    <li key={o.id}>
                      <Link
                        to={`/ordenes/${o.id}`}
                        onClick={() => setSelectedClient(null)}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                      >
                        <div>
                          <div className="font-medium">{o.order_number}</div>
                          <div className="text-xs text-muted-foreground">{o.device_type}</div>
                        </div>
                        <StatusBadge status={o.status} label={resolveStatusLabel(o.status, statusPresets)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
