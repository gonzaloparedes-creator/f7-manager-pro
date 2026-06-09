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
import { Pencil, Search, Users as UsersIcon } from "lucide-react";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  cedula: string | null;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCedula, setEditCedula] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user || !companyId) return;
    setLoading(true);
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase.from("clients").select("id,name,phone,cedula,created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("orders").select("id,order_number,device_type,status,client_id,created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
    ]);
    setClients((c ?? []) as Client[]);
    setOrders((o ?? []) as OrderRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, companyId]);

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

  const clientDraftKey = (cid: string) => `f7_client_draft_${cid}`;

  const openEdit = (c: Client) => {
    setEditing(c);
    // Hydrate from draft if exists, otherwise from the row
    let draft: { name?: string; phone?: string; cedula?: string } | null = null;
    try {
      const raw = localStorage.getItem(clientDraftKey(c.id));
      if (raw) draft = JSON.parse(raw);
    } catch { /* ignore */ }
    setEditName(draft?.name ?? c.name);
    setEditPhone(draft?.phone ?? (c.phone ?? "").replace(/^595/, ""));
    setEditCedula(draft?.cedula ?? (c.cedula ?? ""));
  };

  // Auto-save edit-client draft on change
  useEffect(() => {
    if (!editing) return;
    try {
      localStorage.setItem(clientDraftKey(editing.id), JSON.stringify({ name: editName, phone: editPhone, cedula: editCedula }));
    } catch { /* ignore */ }
  }, [editing, editName, editPhone, editCedula]);

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
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente actualizado" });
    try { localStorage.removeItem(clientDraftKey(editing.id)); } catch {}
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gestioná tus clientes y mirá sus órdenes.</p>
        </div>
        <Badge variant="secondary" className="gap-1"><UsersIcon className="h-3 w-3" /> {clients.length}</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o cédula…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sin clientes.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead className="text-center">Órdenes</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const count = ordersByClient.get(c.id)?.length ?? 0;
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedClient(c)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{c.cedula ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={count > 0 ? "default" : "secondary"}>{count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
              <Label>Nombre</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono (sin 595)</Label>
              <Input
                inputMode="tel"
                placeholder="981 123 456"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label>Cédula de Identidad (opcional)</Label>
              <Input
                inputMode="numeric"
                placeholder="1.234.567"
                value={editCedula}
                onChange={(e) => setEditCedula(e.target.value)}
              />
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
              {selectedClient.cedula && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Cédula: </span>
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
                        <Badge variant="outline">{o.status}</Badge>
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
