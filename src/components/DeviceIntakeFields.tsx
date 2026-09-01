import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAccessoryPresets } from "@/hooks/useAccessoryPresets";
import { useChecklistPresets } from "@/hooks/useChecklistPresets";
import { useProblemPresets } from "@/hooks/useProblemPresets";
import { useDeviceTypePresets } from "@/hooks/useDeviceTypePresets";
import { useMarcaPresets } from "@/hooks/useMarcaPresets";
import { useModeloPresets } from "@/hooks/useModeloPresets";
import { useAssignableTechnicians } from "@/hooks/useAssignableTechnicians";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { formatPYG } from "@/lib/orders";
import { compressPhoto, type PhotoEntry } from "@/lib/photos";
import WarrantySelector from "@/components/WarrantySelector";
import { Upload, CalendarIcon, Camera, Type, Grid3x3, Banknote, ArrowLeftRight, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PatternLock } from "@/components/PatternLock";
import { CameraCapture } from "@/components/CameraCapture";

export interface DeviceIntakeValue {
  device_type: string;
  imei: string;
  marca: string;
  modelo: string;
  assigned_technician_id: string;
  problems: string[];
  problem_other: string;
  problem_description: string;
  accessories: string[];
  checklist: Record<string, "ok" | "fail">;
  quote_amount: string;
  deposit_amount: string;
  deposit_payment_method: string;
  estimated_delivery_date: Date | undefined;
  warranty_days: number;
  device_pin: string;
  device_pattern: number[];
}

interface DeviceIntakeFieldsProps {
  idPrefix: string;
  value: DeviceIntakeValue;
  onChange: (patch: Partial<DeviceIntakeValue>) => void;
  files: PhotoEntry[];
  onFilesChange: (files: PhotoEntry[]) => void;
  photoLimit: number;
  isStarterPlan: boolean;
  registerSectionRef?: (key: string, el: HTMLElement | null) => void;
  onCameraActiveChange?: (active: boolean) => void;
  onCompressingChange?: (compressing: boolean) => void;
  compact?: boolean;
}

function parseAmount(s: string) {
  const digits = s.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function formatThousands(s: string) {
  const n = parseAmount(s);
  return n ? n.toLocaleString("es-PY") : "";
}

// Extraído de NewOrderDialog.tsx para poder usarse tanto ahí (un solo
// equipo) como en Modo Lote (uno por equipo del lote) sin duplicar la
// lógica de chips/checklist/fotos/seguridad — un solo lugar para arreglar
// bugs o agregar campos de ahí en adelante.
export default function DeviceIntakeFields({
  idPrefix,
  value,
  onChange,
  files,
  onFilesChange,
  photoLimit,
  isStarterPlan,
  registerSectionRef,
  onCameraActiveChange,
  onCompressingChange,
  compact = false,
}: DeviceIntakeFieldsProps) {
  const { toast } = useToast();
  const { presets: accessoryPresets } = useAccessoryPresets();
  const { presets: checklistPresets } = useChecklistPresets();
  const { presets: problemPresets } = useProblemPresets();
  const { presets: deviceTypePresets, selectionMode: deviceTypeSelectionMode, loading: deviceTypePresetsLoading } = useDeviceTypePresets();
  const { presets: marcaPresets, useDeviceClassification } = useMarcaPresets();
  const { presets: modeloPresets } = useModeloPresets();
  const { technicians } = useAssignableTechnicians();

  const [deviceOtro, setDeviceOtro] = useState(
    () => !!value.device_type && !deviceTypePresets.some((p) => p.label === value.device_type)
  );
  const [marcaOtro, setMarcaOtro] = useState(false);
  const [modeloOtro, setModeloOtro] = useState(false);
  const [lockInputMode, setLockInputMode] = useState<"text" | "pattern">(
    value.device_pattern.length > 0 ? "pattern" : "text"
  );
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraTriggerRef = useRef<HTMLButtonElement>(null);
  // El botón "Listo"/"Cerrar" de la cámara vive en un portal aparte y tiene
  // el foco al desmontarse. Devolver el foco al botón "Cámara" evita el
  // primer intento de cierre, pero en touch real de Android Radix dispara
  // un SEGUNDO onOpenChange(false) unos instantes después (confirmado con
  // pruebas), ya con cameraOpen=false en el closure — un ref, que no
  // depende de un re-render, mantiene el bloqueo durante ese margen. El
  // padre (el Dialog que envuelve esto) necesita saber cuándo dejar de
  // ignorar sus propios cierres, por eso avisamos con onCameraActiveChange
  // recién cuando termina también esa ventana de gracia.
  const suppressCloseRef = useRef(false);
  const openCamera = () => {
    setCameraOpen(true);
    onCameraActiveChange?.(true);
  };
  const closeCamera = () => {
    suppressCloseRef.current = true;
    cameraTriggerRef.current?.focus();
    setCameraOpen(false);
    window.setTimeout(() => {
      suppressCloseRef.current = false;
      onCameraActiveChange?.(false);
    }, 600);
  };

  // Si el equipo cargado no matchea ningún preset (texto libre tipeado
  // antes de activar "modo selección", o un preset que se borró después),
  // mostramos el campo de texto "Otro" ya con ese valor en vez de perderlo
  // silenciosamente.
  useEffect(() => {
    if (deviceTypePresetsLoading) return;
    if (value.device_type && !deviceTypePresets.some((p) => p.label === value.device_type)) {
      setDeviceOtro(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceTypePresetsLoading]);

  const selectDeviceType = (label: string) => {
    if (label === "Otro") {
      setDeviceOtro(true);
      onChange({ device_type: "" });
    } else {
      setDeviceOtro(false);
      onChange({ device_type: label });
    }
  };

  const selectMarca = (label: string) => {
    if (label === "Otro") {
      setMarcaOtro(true);
      onChange({ marca: "" });
    } else {
      setMarcaOtro(false);
      onChange({ marca: label });
    }
  };

  const selectModelo = (label: string) => {
    if (label === "Otro") {
      setModeloOtro(true);
      onChange({ modelo: "" });
    } else {
      setModeloOtro(false);
      onChange({ modelo: label });
    }
  };

  const toggleProblem = (p: string) => {
    onChange({
      problems: value.problems.includes(p) ? value.problems.filter((x) => x !== p) : [...value.problems, p],
    });
  };

  const toggleAccessory = (label: string, checked: boolean) => {
    onChange({
      accessories: checked ? [...value.accessories, label] : value.accessories.filter((x) => x !== label),
    });
  };

  const toggleChecklist = (label: string, status: "ok" | "fail") => {
    const next = { ...value.checklist };
    if (next[label] === status) delete next[label]; else next[label] = status;
    onChange({ checklist: next });
  };

  const addFiles = async (incoming: File[]) => {
    if (incoming.length === 0) return;
    const remaining = photoLimit - files.length;
    if (remaining <= 0) {
      toast({
        title: `Límite de ${photoLimit} fotos alcanzado${isStarterPlan ? " (plan Starter)" : ""}`,
        variant: "destructive",
      });
      return;
    }
    const accepted = incoming.slice(0, remaining);
    if (incoming.length > remaining) {
      toast({ title: `Solo se agregaron ${accepted.length} de ${incoming.length} fotos (máximo ${photoLimit}).` });
    }
    setCompressing(true);
    onCompressingChange?.(true);
    try {
      const entries: PhotoEntry[] = [];
      for (const file of accepted) {
        const compressed = await compressPhoto(file);
        entries.push({ file: compressed, previewUrl: URL.createObjectURL(compressed) });
      }
      onFilesChange([...files, ...entries]);
    } finally {
      setCompressing(false);
      onCompressingChange?.(false);
    }
  };

  const quote = parseAmount(value.quote_amount);
  const deposit = parseAmount(value.deposit_amount);
  const balance = Math.max(0, quote - deposit);

  const chipClass = (active: boolean) =>
    cn(
      "rounded-full border font-medium transition-colors",
      compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground hover:text-foreground"
    );

  const id = (name: string) => `${idPrefix}_${name}`;

  return (
    <div className="space-y-6">
      {/* Equipo */}
      <div
        ref={(el) => registerSectionRef?.("equipo", el)}
        data-section="equipo"
        className="space-y-3 border-t border-border pt-4"
      >
        <h4 className="text-sm font-semibold text-foreground">Detalles del equipo</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={id("device_type")}>Equipo *</Label>
            {deviceTypeSelectionMode && deviceTypePresets.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {deviceTypePresets.map((p) => {
                    const active = p.label === "Otro" ? deviceOtro : (!deviceOtro && value.device_type === p.label);
                    return (
                      <button key={p.id} type="button" onClick={() => selectDeviceType(p.label)} className={chipClass(active)}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                {deviceOtro && (
                  <Input id={id("device_type")} placeholder="Especificá el equipo…" value={value.device_type}
                    onChange={(e) => onChange({ device_type: e.target.value })} />
                )}
              </div>
            ) : (
              <Input id={id("device_type")} required placeholder="iPhone 13, Apple Watch S8…" value={value.device_type}
                onChange={(e) => onChange({ device_type: e.target.value })} />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("imei")}>IMEI / Nº de Serie</Label>
            <Input id={id("imei")} placeholder="356938035643809" value={value.imei}
              onChange={(e) => onChange({ imei: e.target.value })} />
          </div>
        </div>

        {useDeviceClassification && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={id("marca")}>Marca</Label>
              {marcaPresets.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {marcaPresets.map((p) => {
                      const active = p.label === "Otro" ? marcaOtro : (!marcaOtro && value.marca === p.label);
                      return (
                        <button key={p.id} type="button" onClick={() => selectMarca(p.label)} className={chipClass(active)}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  {marcaOtro && (
                    <Input id={id("marca")} placeholder="Especificá la marca…" value={value.marca}
                      onChange={(e) => onChange({ marca: e.target.value })} />
                  )}
                </div>
              ) : (
                <Input id={id("marca")} placeholder="Apple, Samsung…" value={value.marca}
                  onChange={(e) => onChange({ marca: e.target.value })} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("modelo")}>Modelo</Label>
              {modeloPresets.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {modeloPresets.map((p) => {
                      const active = p.label === "Otro" ? modeloOtro : (!modeloOtro && value.modelo === p.label);
                      return (
                        <button key={p.id} type="button" onClick={() => selectModelo(p.label)} className={chipClass(active)}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  {modeloOtro && (
                    <Input id={id("modelo")} placeholder="Especificá el modelo…" value={value.modelo}
                      onChange={(e) => onChange({ modelo: e.target.value })} />
                  )}
                </div>
              ) : (
                <Input id={id("modelo")} placeholder="iPhone 13, Galaxy A54…" value={value.modelo}
                  onChange={(e) => onChange({ modelo: e.target.value })} />
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={id("assigned_technician")}>Técnico asignado</Label>
          <Select
            value={value.assigned_technician_id || ""}
            onValueChange={(v) => onChange({ assigned_technician_id: v })}
          >
            <SelectTrigger id={id("assigned_technician")}><SelectValue placeholder="Sin asignar" /></SelectTrigger>
            <SelectContent>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.full_name || "Técnico sin nombre"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Detalles a la vista *</Label>
          <div className="flex flex-wrap gap-2">
            {problemPresets.map(({ label: p }) => (
              <button key={p} type="button" onClick={() => toggleProblem(p)} className={chipClass(value.problems.includes(p))}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {value.problems.includes("Otro") && (
          <div className="space-y-2">
            <Label htmlFor={id("problem_other")}>Especificá "Otro" *</Label>
            <Input id={id("problem_other")} placeholder="Describí el problema..." value={value.problem_other}
              onChange={(e) => onChange({ problem_other: e.target.value })} />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={id("problem")}>Observaciones iniciales</Label>
          <Textarea id={id("problem")} rows={3}
            placeholder="Estado estético, accesorios entregados, contraseña, etc."
            value={value.problem_description}
            onChange={(e) => onChange({ problem_description: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>Fotos</Label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-4 text-sm text-muted-foreground hover:bg-muted">
              <Upload className="h-4 w-4" />
              Galería
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/gif,image/bmp,image/*"
                multiple
                className="hidden"
                onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
              />
            </label>
            <button
              ref={cameraTriggerRef}
              type="button"
              onClick={openCamera}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-4 text-sm text-muted-foreground hover:bg-muted"
            >
              <Camera className="h-4 w-4" />
              Cámara
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {files.length} / {photoLimit} fotos{isStarterPlan ? " (plan Starter)" : ""}
            {compressing && " · Optimizando…"}
          </p>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={f.previewUrl} className="relative">
                  <img src={f.previewUrl} alt={f.file.name} className="h-16 w-16 rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={() => { URL.revokeObjectURL(f.previewUrl); onFilesChange(files.filter((_, j) => j !== i)); }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Accesorios */}
      <div
        ref={(el) => registerSectionRef?.("accesorios", el)}
        data-section="accesorios"
        className="space-y-3 border-t border-border pt-4"
      >
        <h4 className="text-sm font-semibold text-foreground">Accesorios y Componentes</h4>
        <p className="text-xs text-muted-foreground">Marcá lo que el cliente entrega junto al equipo.</p>
        {accessoryPresets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay accesorios configurados. Agregalos en Configuración → Accesorios.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {accessoryPresets.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
                <Label htmlFor={id(`acc_${acc.id}`)} className="cursor-pointer text-sm font-normal">{acc.label}</Label>
                <Switch
                  id={id(`acc_${acc.id}`)}
                  checked={value.accessories.includes(acc.label)}
                  onCheckedChange={(c) => toggleAccessory(acc.label, c)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checklist */}
      <div
        ref={(el) => registerSectionRef?.("checklist", el)}
        data-section="checklist"
        className="space-y-3 border-t border-border pt-4"
      >
        <h4 className="text-sm font-semibold text-foreground">Checklist de Recepción</h4>
        <p className="text-xs text-muted-foreground">Dejá constancia del estado del equipo al recibirlo (opcional, item por item).</p>
        {checklistPresets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay ítems configurados. Agregalos en Configuración → Accesorios.</p>
        ) : (
          <div className="space-y-2">
            {checklistPresets.map((c) => {
              const status = value.checklist[c.label];
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
                  <span className="text-sm">{c.label}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleChecklist(c.label, "ok")}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        status === "ok"
                          ? "border-transparent bg-[hsl(var(--status-listo-bg))] text-[hsl(var(--status-listo))]"
                          : "border-input text-muted-foreground hover:text-foreground"
                      )}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleChecklist(c.label, "fail")}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        status === "fail"
                          ? "border-transparent bg-destructive/10 text-destructive"
                          : "border-input text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Falla
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Financiero */}
      <div
        ref={(el) => registerSectionRef?.("financiero", el)}
        data-section="financiero"
        className="space-y-3 border-t border-border pt-4"
      >
        <h4 className="text-sm font-semibold text-foreground">Información financiera</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={id("quote_amount")}>Presupuesto (Gs.)</Label>
            <Input id={id("quote_amount")} inputMode="numeric" placeholder="0"
              value={formatThousands(value.quote_amount)}
              onChange={(e) => onChange({ quote_amount: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("deposit_amount")}>Seña (Gs.)</Label>
            <Input id={id("deposit_amount")} inputMode="numeric" placeholder="0"
              value={formatThousands(value.deposit_amount)}
              onChange={(e) => onChange({ deposit_amount: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Saldo</Label>
            <div className={cn(
              "flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold",
              balance > 0 ? "text-foreground" : "text-muted-foreground"
            )}>
              {formatPYG(balance)}
            </div>
          </div>
        </div>

        {deposit > 0 && (
          <div className="space-y-2">
            <Label>Método de pago de la seña</Label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "Efectivo", label: "Efectivo", icon: Banknote },
                { value: "Transferencia", label: "Transferencia", icon: ArrowLeftRight },
                { value: "Otro", label: "Otro", icon: MoreHorizontal },
              ] as const).map((m) => {
                const active = value.deposit_payment_method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => onChange({ deposit_payment_method: m.value })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <m.icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Fecha estimada de entrega</Label>
          <Popover open={deliveryDateOpen} onOpenChange={setDeliveryDateOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("w-full justify-start text-left font-normal sm:w-[280px]", !value.estimated_delivery_date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.estimated_delivery_date ? format(value.estimated_delivery_date, "PPP", { locale: es }) : <span>Elegí una fecha</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.estimated_delivery_date}
                onSelect={(d) => { onChange({ estimated_delivery_date: d }); setDeliveryDateOpen(false); }}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                locale={es}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Tiempo de garantía</Label>
          <WarrantySelector value={value.warranty_days} onChange={(d) => onChange({ warranty_days: d })} />
        </div>
      </div>

      {/* Seguridad */}
      <div
        ref={(el) => registerSectionRef?.("seguridad", el)}
        data-section="seguridad"
        className="space-y-3 border-t border-border pt-4"
      >
        <h4 className="text-sm font-semibold text-foreground">Seguridad del equipo</h4>
        <p className="text-xs text-muted-foreground">Datos opcionales para que el técnico pueda acceder al equipo durante la reparación.</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={lockInputMode === "text" ? id("device_pin") : undefined}>
              {lockInputMode === "text" ? "PIN / Contraseña" : "Patrón de desbloqueo (Android)"}
            </Label>
            <div className="flex rounded-md border border-input p-0.5">
              <button
                type="button"
                onClick={() => setLockInputMode("text")}
                aria-label="Usar PIN o contraseña"
                aria-pressed={lockInputMode === "text"}
                className={cn("flex h-7 w-7 items-center justify-center rounded-sm transition-colors", lockInputMode === "text" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                <Type className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLockInputMode("pattern")}
                aria-label="Usar patrón de desbloqueo"
                aria-pressed={lockInputMode === "pattern"}
                className={cn("flex h-7 w-7 items-center justify-center rounded-sm transition-colors", lockInputMode === "pattern" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                <Grid3x3 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {lockInputMode === "text" ? (
            <>
              <Input
                id={id("device_pin")}
                type="text"
                autoComplete="off"
                placeholder="Ej: 1234 o contraseña"
                value={value.device_pin}
                onChange={(e) => onChange({ device_pin: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Se guarda asociado a la orden y solo es visible para el técnico.</p>
            </>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <PatternLock value={value.device_pattern} onChange={(p) => onChange({ device_pattern: p })} size={200} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ device_pattern: [] })}
                disabled={value.device_pattern.length === 0}
              >
                Borrar patrón
              </Button>
            </div>
          )}
        </div>
      </div>

      {cameraOpen && (
        <CameraCapture onClose={closeCamera} onCapture={(fs) => addFiles(fs)} />
      )}
    </div>
  );
}
