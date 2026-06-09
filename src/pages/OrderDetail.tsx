import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";
import { WarrantyBadge } from "@/components/WarrantyBadge";
import { STATUS_LABELS, STATUS_ORDER, formatPYG, type OrderStatus } from "@/lib/orders";
import { ArrowLeft, Copy, Phone, Smartphone, FileText, ChevronLeft, ChevronRight, X, Hash, Wallet, CalendarDays, Wrench, Trash2, Plus, Printer, Camera, ImagePlus, Building2, UserCheck, Package, Pencil, Lock } from "lucide-react";
import { PatternLock } from "@/components/PatternLock";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { toast as sonnerToast } from "sonner";
import { OrderQRCode } from "@/components/OrderQRCode";
import { PrintReceipt } from "@/components/PrintReceipt";
import OrderActionsMenu from "@/components/OrderActionsMenu";
import OrderPartsSection from "@/components/OrderPartsSection";
import imageCompression from "browser-image-compression";

interface Order {
  id: string; order_number: string; customer_name: string; customer_phone: string;
  alternative_phone?: string | null;
  secondary_phone?: string | null;
  secondary_contact_name?: string | null;
  device_type: string; problem_description: string; photos: string[]; status: string;
  technician_notes: string | null; tracking_token: string; created_at: string;
  imei: string | null; problems: string[]; problem_other: string | null;
  quote_amount: number; deposit_amount: number; estimated_delivery_date: string | null;
  device_pin: string | null; device_pattern: number[] | null; client_signature: string | null;
  cargos_adicionales: CargoAdicional[];
  client_id: string | null;
  customer_cedula?: string | null;
  assigned_technician_id?: string | null;
  current_branch_id?: string | null;
  has_sim?: boolean; has_sd?: boolean; has_esim?: boolean; has_case?: boolean;
  received_by_id?: string | null;
  received_by_name?: string | null;
  warranty_days?: number | null;
  delivered_at?: string | null;
}
interface CargoAdicional { motivo: string; monto: number; }
interface History { id: string; status: string; note: string | null; created_at: string; is_internal?: boolean; image_urls?: string[] | null; }
interface TechNote { id: string; note: string; created_at: string; technician_id: string; }
interface StaffUser { id: string; full_name: string | null }
interface Branch { id: string; name: string }

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { isStarter, limits } = usePlan();
  const photoLimit = limits.photos;
  const { isAdmin } = useUserRole();
  const [editingFinance, setEditingFinance] = useState(false);
  const [editQuote, setEditQuote] = useState<string>("");
  const [editDeposit, setEditDeposit] = useState<string>("");
  const [savingFinance, setSavingFinance] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [techNotes, setTechNotes] = useState<TechNote[]>([]);
  const [newTechNote, setNewTechNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const STATUS_DRAFT_KEY = `f7_status_update_draft_${id ?? "new"}`;
  const loadStatusDraft = () => {
    try {
      const raw = localStorage.getItem(STATUS_DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { newStatus?: OrderStatus; note?: string; noteVisible?: boolean };
    } catch { return null; }
  };
  const _statusDraft = loadStatusDraft();
  const [newStatus, setNewStatus] = useState<OrderStatus>(_statusDraft?.newStatus ?? "recibido");
  const [note, setNote] = useState(_statusDraft?.note ?? "");
  const [noteVisible, setNoteVisible] = useState(_statusDraft?.noteVisible ?? true);
  const [updating, setUpdating] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [chargeMotivo, setChargeMotivo] = useState("");
  const [chargeMonto, setChargeMonto] = useState<string>("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string>("");
  const [transferring, setTransferring] = useState(false);

  const handleEvidenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = photoLimit - evidenceFiles.length;
    if (remaining <= 0) {
      sonnerToast.error(`Límite de ${photoLimit} fotos alcanzado${isStarter ? " (plan Starter)" : ""}.`);
      e.target.value = "";
      return;
    }
    const accepted = files.slice(0, remaining);
    if (files.length > remaining) {
      sonnerToast.warning(`Solo se agregaron ${accepted.length} de ${files.length} fotos (máximo ${photoLimit}).`);
    }
    setEvidenceFiles((prev) => [...prev, ...accepted]);
    setEvidencePreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeEvidence = (idx: number) => {
    setEvidencePreviews((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    return () => {
      evidencePreviews.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openLightbox = (i: number) => setLightboxIndex(i);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => {
    if (!order || lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + order.photos.length) % order.photos.length);
  };
  const nextPhoto = () => {
    if (!order || lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % order.photos.length);
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevPhoto();
      else if (e.key === "ArrowRight") nextPhoto();
      else if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, order]);

  const load = async () => {
    const { data: o } = await supabase.from("orders").select("*").eq("id", id!).maybeSingle();
    if (o) {
      let cedula: string | null = null;
      if ((o as any).client_id) {
        const { data: cli } = await supabase
          .from("clients")
          .select("cedula")
          .eq("id", (o as any).client_id)
          .maybeSingle();
        cedula = cli?.cedula ?? null;
      }
      let receivedByName: string | null = null;
      if ((o as any).received_by_id) {
        const { data: rp } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", (o as any).received_by_id)
          .maybeSingle();
        receivedByName = rp?.full_name ?? null;
      }
      const normalized: Order = {
        ...(o as any),
        cargos_adicionales: Array.isArray((o as any).cargos_adicionales)
          ? ((o as any).cargos_adicionales as CargoAdicional[])
          : [],
        customer_cedula: cedula,
        received_by_name: receivedByName,
      };
      setOrder(normalized);
      // Only adopt server status if user has no in-progress draft
      if (!loadStatusDraft()) setNewStatus(o.status as OrderStatus);
      document.title = `${o.order_number} | F7 Manager Pro`;
    }
    const { data: h } = await supabase
      .from("order_status_history").select("*").eq("order_id", id!).order("created_at", { ascending: true });
    setHistory((h ?? []) as History[]);
    const { data: tn } = await supabase
      .from("order_technical_notes").select("*").eq("order_id", id!).order("created_at", { ascending: false });
    setTechNotes((tn ?? []) as TechNote[]);
  };

  useEffect(() => { load(); }, [id]);

  // Auto-save 'Actualizar estado' draft on every change (per-order key)
  useEffect(() => {
    try {
      localStorage.setItem(STATUS_DRAFT_KEY, JSON.stringify({ newStatus, note, noteVisible }));
    } catch { /* ignore */ }
  }, [newStatus, note, noteVisible, STATUS_DRAFT_KEY]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("business_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setBusinessName(data?.business_name ?? null));
  }, [user]);

  // Load staff users (for "Técnico Asignado" dropdown) — scoped to company
  useEffect(() => {
    if (!companyId) return;
    const loadStaff = async () => {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", companyId);
      const ids = (profs ?? []).map((p: any) => p.id);
      if (ids.length === 0) { setStaffUsers([]); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff")
        .in("user_id", ids);
      const staffIds = new Set((roles ?? []).map((r: any) => r.user_id));
      setStaffUsers(((profs ?? []) as any[]).filter((p) => staffIds.has(p.id)) as StaffUser[]);
    };
    loadStaff();
  }, [companyId]);

  // Load all branches (for transfer modal)
  useEffect(() => {
    if (!companyId) return;
    supabase.from("branches").select("id, name").eq("company_id", companyId).order("name").then(({ data }) => {
      setBranches((data ?? []) as Branch[]);
    });
  }, [companyId]);

  const logSystemHistory = async (orderId: string, status: string, note: string) => {
    try {
      await supabase.from("order_status_history").insert({
        order_id: orderId,
        status,
        note,
        is_internal: true,
        image_urls: [],
      } as any);
    } catch (e) {
      console.warn("Failed to log system history", e);
    }
  };

  const assignTechnician = async (value: string) => {
    if (!order) return;
    const newId = value === "__none__" ? null : value;
    if (newId === (order.assigned_technician_id ?? null)) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ assigned_technician_id: newId })
        .eq("id", order.id);
      if (error) throw error;
      const techName = newId
        ? (staffUsers.find((s) => s.id === newId)?.full_name || "Técnico")
        : null;
      const noteText = techName
        ? `Asignado a ${techName}`
        : "Asignación de técnico removida";
      await logSystemHistory(order.id, order.status, noteText);
      setOrder({ ...order, assigned_technician_id: newId });
      toast({ title: "Técnico actualizado", description: newId ? "Asignación guardada." : "Asignación removida." });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const transferToBranch = async () => {
    if (!order || !transferTargetId) return;
    if (transferTargetId === order.current_branch_id) {
      toast({ title: "Sin cambios", description: "Ya está en esa sucursal.", variant: "destructive" });
      return;
    }
    setTransferring(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ current_branch_id: transferTargetId })
        .eq("id", order.id);
      if (error) throw error;
      const branchName = branches.find((b) => b.id === transferTargetId)?.name || "otra sucursal";
      await logSystemHistory(order.id, order.status, `Equipo derivado a ${branchName}`);
      setOrder({ ...order, current_branch_id: transferTargetId });
      toast({ title: "Derivación realizada", description: `Equipo enviado a ${branchName}.` });
      setTransferOpen(false);
      setTransferTargetId("");
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  const handlePrint = () => window.print();

  const addTechNote = async () => {
    if (!order || !user || !newTechNote.trim()) return;
    setAddingNote(true);
    try {
      const { error } = await supabase.from("order_technical_notes").insert({
        order_id: order.id,
        technician_id: user.id,
        note: newTechNote.trim(),
      });
      if (error) throw error;
      setNewTechNote("");
      toast({ title: "Nota agregada", description: "La actualización técnica fue registrada." });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  };

  const deleteTechNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from("order_technical_notes").delete().eq("id", noteId);
      if (error) throw error;
      toast({ title: "Nota eliminada" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const updateStatus = async () => {
    if (!order || !user) return;
    if (newStatus === order.status && !note && evidenceFiles.length === 0) {
      toast({ title: "Sin cambios", description: "Cambiá el estado, agregá una nota o subí fotos." });
      return;
    }
    setUpdating(true);
    try {
      // Upload evidence images first (only relevant for en_reparacion, but support any status)
      let imageUrls: string[] = [];
      if (evidenceFiles.length > 0) {
        setCompressing(true);
        const compressOptions = {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
          initialQuality: 0.8,
        };
        const compressedFiles: File[] = [];
        try {
          for (const file of evidenceFiles) {
            if (file.type.startsWith("image/")) {
              try {
                const compressed = await imageCompression(file, compressOptions);
                compressedFiles.push(
                  new File([compressed], file.name, { type: compressed.type || file.type })
                );
              } catch {
                compressedFiles.push(file);
              }
            } else {
              compressedFiles.push(file);
            }
          }
        } finally {
          setCompressing(false);
        }

        for (const file of compressedFiles) {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${user.id}/${order.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("repair-evidence")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("repair-evidence").getPublicUrl(path);
          imageUrls.push(pub.publicUrl);
        }
      }

      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus, technician_notes: note && noteVisible ? note : order.technician_notes })
        .eq("id", order.id);
      if (error) throw error;
      await supabase.from("order_status_history").insert({
        order_id: order.id, status: newStatus, note: note || null, is_internal: !noteVisible,
        image_urls: imageUrls,
      } as any);

      if (newStatus !== order.status) {
        try {
          await supabase.functions.invoke("send-status-notification", {
            body: {
              customer_name: order.customer_name,
              customer_phone: order.alternative_phone || order.customer_phone,
              device_type: order.device_type,
              order_number: order.order_number,
              order_code: order.order_number,
              new_status: newStatus,
              app_origin: window.location.origin,
            },
          });
        } catch (e) { console.warn(e); }
      }

      toast({ title: "Actualizado", description: "El estado fue actualizado." });
      setNote("");
      setNoteVisible(true);
      try { localStorage.removeItem(STATUS_DRAFT_KEY); } catch {}
      evidencePreviews.forEach((u) => URL.revokeObjectURL(u));
      setEvidenceFiles([]);
      setEvidencePreviews([]);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const addCharge = async () => {
    if (!order) return;
    const monto = Number(chargeMonto);
    if (!chargeMotivo.trim() || !Number.isFinite(monto) || monto <= 0) {
      toast({ title: "Datos inválidos", description: "Ingresá un motivo y un monto mayor a 0.", variant: "destructive" });
      return;
    }
    const updated: CargoAdicional[] = [
      ...(order.cargos_adicionales ?? []),
      { motivo: chargeMotivo.trim(), monto },
    ];
    try {
      const { error } = await supabase
        .from("orders")
        .update({ cargos_adicionales: updated as any })
        .eq("id", order.id);
      if (error) throw error;
      setChargeMotivo("");
      setChargeMonto("");
      setShowChargeForm(false);
      toast({ title: "Cargo agregado", description: "El cargo adicional fue registrado." });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const removeCharge = async (idx: number) => {
    if (!order) return;
    const updated = (order.cargos_adicionales ?? []).filter((_, i) => i !== idx);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ cargos_adicionales: updated as any })
        .eq("id", order.id);
      if (error) throw error;
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyTracking = () => {
    if (!order) return;
    const url = `${window.location.origin}/tracking/${order.order_number}`;
    navigator.clipboard.writeText(url);
    toast({ title: "¡Copiado!", description: "Link de seguimiento copiado al portapapeles." });
  };

  const startEditFinance = () => {
    if (!order) return;
    setEditQuote(String(order.quote_amount ?? 0));
    setEditDeposit(String(order.deposit_amount ?? 0));
    setEditingFinance(true);
  };

  const saveFinance = async () => {
    if (!order) return;
    const q = Number(editQuote);
    const d = Number(editDeposit);
    if (!Number.isFinite(q) || q < 0 || !Number.isFinite(d) || d < 0) {
      toast({ title: "Valores inválidos", description: "Ingresá montos válidos (≥ 0).", variant: "destructive" });
      return;
    }
    setSavingFinance(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ quote_amount: q, deposit_amount: d })
        .eq("id", order.id);
      if (error) throw error;
      toast({ title: "Información financiera actualizada" });
      setEditingFinance(false);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingFinance(false);
    }
  };

  if (!order) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-mono text-sm text-muted-foreground">{order.order_number}</div>
          <h1 className="text-2xl font-bold">{order.customer_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" />{order.device_type}</span>
            <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{order.customer_phone}</span>
            {order.alternative_phone && (
              <span className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">
                <Phone className="h-4 w-4" />Notificaciones a: +{order.alternative_phone} {order.secondary_contact_name ? `(${order.secondary_contact_name})` : ""}
              </span>
            )}
            {order.customer_cedula && (
              <span className="flex items-center gap-1.5"><Hash className="h-4 w-4" />C.I. {order.customer_cedula}</span>
            )}
            {order.received_by_name && (
              <span className="flex items-center gap-1.5"><UserCheck className="h-4 w-4" />Recepcionado por: {order.received_by_name}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} className="text-sm" />
          <WarrantyBadge deliveredAt={order.delivered_at} warrantyDays={order.warranty_days} />
          <Button variant="outline" size="sm" onClick={copyTracking} className="gap-2">
            <Copy className="h-4 w-4" /> Link tracking
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <OrderActionsMenu
            orderId={order.id}
            orderNumber={order.order_number}
            variant="buttons"
            onUpdated={load}
            onDeleted={() => navigate("/dashboard")}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="assigned-tech" className="flex items-center gap-2 text-sm font-semibold">
                  <Wrench className="h-4 w-4 text-primary" /> Técnico Asignado
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setTransferTargetId("");
                    setTransferOpen(true);
                  }}
                >
                  <Building2 className="h-4 w-4" />
                  Derivar a otra sucursal
                </Button>
              </div>
              <Select
                value={order.assigned_technician_id ?? "__none__"}
                onValueChange={assignTechnician}
                disabled={assigning}
              >
                <SelectTrigger id="assigned-tech">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  {staffUsers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || "Técnico sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {order.current_branch_id && (
                <p className="text-xs text-muted-foreground">
                  Sucursal actual:{" "}
                  <span className="font-medium text-foreground">
                    {branches.find((b) => b.id === order.current_branch_id)?.name ?? "—"}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Derivar a otra sucursal</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label htmlFor="transfer-branch">Seleccioná la sucursal de destino</Label>
                <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                  <SelectTrigger id="transfer-branch">
                    <SelectValue placeholder="Elegí una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter((b) => b.id !== order.current_branch_id)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transferring}>
                  Cancelar
                </Button>
                <Button onClick={transferToBranch} disabled={!transferTargetId || transferring}>
                  {transferring ? "Derivando..." : "Confirmar derivación"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-primary" /> Equipo y problemas
              </div>

              {order.imei && (
                <div className="flex items-start gap-2 text-sm">
                  <Hash className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">IMEI / Nº de Serie</div>
                    <div className="font-mono">{order.imei}</div>
                  </div>
                </div>
              )}

              {order.problems && order.problems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Problemas detectados</div>
                  <div className="flex flex-wrap gap-1.5">
                    {order.problems.map((p) => (
                      <span key={p} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                        {p === "Otro" && order.problem_other ? `Otro: ${order.problem_other}` : p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {order.problem_description && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Observaciones iniciales</div>
                  <p className="text-sm whitespace-pre-wrap">{order.problem_description}</p>
                </div>
              )}

              {(() => {
                const accs: string[] = [];
                if (order.has_sim) accs.push("SIM");
                if (order.has_sd) accs.push("Micro SD");
                if (order.has_esim) accs.push("eSIM");
                if (order.has_case) accs.push("Funda/Carcasa");
                if (accs.length === 0) return null;
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Package className="h-3.5 w-3.5" /> Accesorios entregados
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {accs.map((a) => (
                        <span key={a} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {(order.device_pin || (order.device_pattern && order.device_pattern.length > 0)) && (
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Lock className="h-4 w-4 text-primary" /> Seguridad y Desbloqueo
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {order.device_pin && (
                      <div className="space-y-1 rounded-md border border-dashed border-border p-3 bg-muted/20">
                        <div className="text-xs text-muted-foreground">PIN / Contraseña</div>
                        <div className="font-mono text-sm font-semibold select-all text-primary bg-background px-2 py-1 rounded border inline-block">
                          {order.device_pin}
                        </div>
                      </div>
                    )}
                    {order.device_pattern && order.device_pattern.length > 0 && (
                      <div className="space-y-2 rounded-md border border-dashed border-border p-3 bg-muted/20">
                        <div className="text-xs text-muted-foreground">Patrón de desbloqueo</div>
                        <div className="pointer-events-none select-none opacity-90 scale-90 origin-top-left">
                          <PatternLock value={order.device_pattern} onChange={() => {}} size={140} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {order.client_signature && (
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">Firma del cliente</div>
                  <div className="inline-block rounded-md border bg-white p-2">
                    <img src={order.client_signature} alt="Firma del cliente" className="max-h-24 w-auto dark:invert" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <OrderPartsSection orderId={order.id} branchId={order.current_branch_id ?? null} />

          {(isAdmin || order.quote_amount > 0 || order.deposit_amount > 0 || order.estimated_delivery_date || (order.cargos_adicionales?.length ?? 0) > 0) && (() => {
            const cargos = order.cargos_adicionales ?? [];
            const cargosTotal = cargos.reduce((s, c) => s + Number(c.monto || 0), 0);
            const totalAjustado = Number(order.quote_amount ?? 0) + cargosTotal;
            const saldo = Math.max(0, totalAjustado - Number(order.deposit_amount ?? 0));
            return (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Wallet className="h-4 w-4 text-primary" /> Información financiera
                  </div>
                  {isAdmin && !editingFinance && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={startEditFinance}
                      aria-label="Editar información financiera"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {editingFinance ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-quote" className="text-xs text-muted-foreground">Presupuesto inicial (Gs.)</Label>
                      <Input
                        id="edit-quote"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={editQuote}
                        onChange={(e) => setEditQuote(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-deposit" className="text-xs text-muted-foreground">Seña (Gs.)</Label>
                      <Input
                        id="edit-deposit"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={editDeposit}
                        onChange={(e) => setEditDeposit(e.target.value)}
                      />
                    </div>
                    {(() => {
                      const q = Number(editQuote) || 0;
                      const d = Number(editDeposit) || 0;
                      const tAdj = q + cargosTotal;
                      const sal = Math.max(0, tAdj - d);
                      return (
                        <div className="space-y-1 rounded-md border border-dashed border-border p-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total ajustado</span>
                            <span className="font-semibold">{formatPYG(tAdj)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Saldo</span>
                            <span className="font-bold text-primary">{formatPYG(sal)}</span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingFinance(false)}
                        disabled={savingFinance}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveFinance}
                        disabled={savingFinance}
                      >
                        {savingFinance ? "Guardando..." : "Guardar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Presupuesto inicial</span>
                        <span className="font-medium">{formatPYG(order.quote_amount)}</span>
                      </div>

                      {cargos.length > 0 && (
                        <div className="space-y-1.5 rounded-md border border-dashed border-border p-2">
                          <div className="text-xs font-medium text-muted-foreground">Cargos adicionales</div>
                          {cargos.map((c, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate">{c.motivo}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{formatPYG(c.monto)}</span>
                                <button
                                  type="button"
                                  onClick={() => removeCharge(i)}
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label="Eliminar cargo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-border pt-2">
                        <span className="text-muted-foreground">Total ajustado</span>
                        <span className="font-semibold">{formatPYG(totalAjustado)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Seña</span>
                        <span className="font-medium">- {formatPYG(order.deposit_amount)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-2">
                        <span className="text-sm font-semibold">Saldo</span>
                        <span className="text-base font-bold text-primary">{formatPYG(saldo)}</span>
                      </div>
                    </div>

                    {order.estimated_delivery_date && (
                      <div className="flex items-center gap-2 border-t border-border pt-3 text-sm">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Entrega estimada:</span>
                        <span className="font-medium">
                          {format(new Date(order.estimated_delivery_date + "T00:00:00"), "PPP", { locale: es })}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            );
          })()}

          {order.photos.length > 0 && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="text-sm font-semibold">Fotos</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {order.photos.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => openLightbox(i)}
                      className="group relative overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <img
                        src={p}
                        alt={`Foto ${i + 1}`}
                        className="aspect-square w-full object-cover transition group-hover:opacity-80"
                      />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="text-sm font-semibold">Actualizar estado</div>
              <div className="space-y-2">
                <Label>Nuevo estado</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nota (opcional)</Label>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={noteVisible ? "Detalle visible en el seguimiento..." : "Nota interna del taller (no visible para el cliente)..."}
                />
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      {noteVisible ? "Visible para el cliente" : "Nota interna (Solo taller)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {noteVisible
                        ? "El cliente verá esta nota en el seguimiento."
                        : "Solo el equipo del taller verá esta nota."}
                    </div>
                  </div>
                  <Switch checked={noteVisible} onCheckedChange={setNoteVisible} />
                </div>
              </div>

              {(newStatus === "en_diagnostico" || newStatus === "en_reparacion") && (
                <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                  {!showChargeForm ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChargeForm(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" /> Agregar cargo adicional
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Nuevo cargo adicional</div>
                      <div className="space-y-2">
                        <Input
                          placeholder="Motivo (ej: Reemplazo de placa)"
                          value={chargeMotivo}
                          onChange={(e) => setChargeMotivo(e.target.value)}
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="Monto Adicional Gs."
                          value={chargeMonto}
                          onChange={(e) => setChargeMonto(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowChargeForm(false);
                            setChargeMotivo("");
                            setChargeMonto("");
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button type="button" size="sm" onClick={addCharge}>
                          Guardar cargo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(newStatus === "en_diagnostico" || newStatus === "en_reparacion" || newStatus === "listo") && (
                <div className="space-y-3 rounded-md border border-dashed border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Camera className="h-4 w-4 text-primary" /> Evidencia fotográfica
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adjuntá fotos del proceso de reparación. {noteVisible ? "Serán visibles para el cliente en el seguimiento." : "Solo serán visibles para el taller."}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      Fotos: {evidencePreviews.length}/{photoLimit}
                      {isStarter && <span className="ml-1 text-secondary">(Límite Starter)</span>}
                    </span>
                    {evidencePreviews.length >= photoLimit && (
                      <span className="text-secondary">Límite alcanzado</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition hover:bg-accent">
                      <ImagePlus className="h-4 w-4" /> Galería
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif,image/bmp,image/*"
                        multiple
                        className="hidden"
                        onChange={handleEvidenceSelect}
                      />
                    </label>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition hover:bg-accent">
                      <Camera className="h-4 w-4" /> Cámara
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleEvidenceSelect}
                      />
                    </label>
                  </div>

                  {evidencePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {evidencePreviews.map((src, i) => (
                        <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-border">
                          <img src={src} alt={`Evidencia ${i + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeEvidence(i)}
                            className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow transition hover:bg-destructive hover:text-destructive-foreground"
                            aria-label="Quitar foto"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button onClick={updateStatus} disabled={updating || compressing} className="w-full">
                {compressing ? "Comprimiendo imágenes..." : updating ? "Actualizando..." : "Guardar cambios"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4 text-primary" /> Bitácora técnica
              </div>

              <div className="space-y-2">
                <Label htmlFor="tech-note">Nueva entrada</Label>
                <Textarea
                  id="tech-note"
                  rows={2}
                  value={newTechNote}
                  onChange={(e) => setNewTechNote(e.target.value)}
                  placeholder="Ej: Se retira capacitor en corto del riel de carga..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      addTechNote();
                    }
                  }}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={addTechNote}
                    disabled={addingNote || !newTechNote.trim()}
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {addingNote ? "Agregando..." : "Agregar nota"}
                  </Button>
                </div>
              </div>

              {techNotes.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  Sin entradas en la bitácora todavía.
                </div>
              ) : (
                <ol className="relative space-y-4 border-l-2 border-border pl-5">
                  {techNotes.map((tn) => (
                    <li key={tn.id} className="relative">
                      <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                      <div className="rounded-md border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(tn.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                          </div>
                          {user?.id === tn.technician_id && (
                            <button
                              type="button"
                              onClick={() => deleteTechNote(tn.id)}
                              className="text-muted-foreground transition hover:text-destructive"
                              aria-label="Eliminar nota"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{tn.note}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <OrderQRCode orderCode={order.order_number} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="text-sm font-semibold">Historial</div>
              <ol className="space-y-4">
                {history.map((h) => (
                  <li key={h.id} className="relative pl-6">
                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
                    <div className="flex items-center gap-2">
                      <StatusBadge status={h.status} />
                    </div>
                    {h.note && <p className="mt-1 text-sm text-muted-foreground">{h.note}</p>}
                    {h.image_urls && h.image_urls.length > 0 && (
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {h.image_urls.map((src, i) => (
                          <a
                            key={i}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-square overflow-hidden rounded-md border border-border"
                          >
                            <img src={src} alt={`Evidencia ${i + 1}`} className="h-full w-full object-cover transition hover:opacity-80" />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("es-ES")}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
          {lightboxIndex !== null && order.photos[lightboxIndex] && (
            <div className="relative flex items-center justify-center">
              <img
                src={order.photos[lightboxIndex]}
                alt={`Foto ${lightboxIndex + 1}`}
                className="max-h-[85vh] w-auto rounded-md object-contain"
              />
              <button
                type="button"
                onClick={closeLightbox}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-2 text-foreground transition hover:bg-background"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
              {order.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground transition hover:bg-background"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={nextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground transition hover:bg-background"
                    aria-label="Siguiente"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground">
                    {lightboxIndex + 1} / {order.photos.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PrintReceipt order={order} businessName={businessName} />
    </div>
  );
}
