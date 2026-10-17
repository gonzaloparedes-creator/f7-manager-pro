import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { sanitizeFilenameForStorage } from "@/lib/utils";
import {
  DEFAULT_SEAL_ICON,
  DEFAULT_SEARCH_PLACEHOLDER,
  FOOTER_TEXT_MAX,
  INCLUDES_MAX,
  INCLUDE_MAX,
  PRODUCT_SEALS_MAX,
  SEALS_MAX,
  SEAL_ICONS,
  SEAL_SUBTITLE_MAX,
  SEAL_TITLE_MAX,
  SEARCH_PLACEHOLDER_MAX,
  SOCIAL_KINDS,
  SOCIAL_LABELS,
  type CustomDraft,
  type SocialKind,
  type StorefrontSeal,
} from "@/lib/storefront";
import { SealIcon, SocialIcon } from "./StorefrontIcons";

const SOCIAL_PLACEHOLDERS: Record<SocialKind, string> = {
  instagram: "@tu_negocio o instagram.com/tu_negocio",
  facebook: "facebook.com/tunegocio",
  tiktok: "@tu_negocio",
  youtube: "youtube.com/@tunegocio",
  website: "tunegocio.com.py",
};

const BANNER_MAX_BYTES = 12 * 1024 * 1024;

interface Props {
  companyId: string;
  value: CustomDraft;
  onChange: (patch: Partial<CustomDraft>) => void;
  socialErrors: Partial<Record<SocialKind, string | null>>;
}

export default function StorefrontCustomizer({ companyId, value, onChange, socialErrors }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadBanner = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Elegí una imagen (JPG, PNG o WebP).");
      return;
    }
    if (file.size > BANNER_MAX_BYTES) {
      toast.error("La imagen pesa demasiado. Probá con una de menos de 12 MB.");
      return;
    }
    setUploading(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.6, maxWidthOrHeight: 1600, useWebWorker: true });
      const path = `${companyId}/${crypto.randomUUID()}-${sanitizeFilenameForStorage(compressed.name)}`;
      const { error } = await supabase.storage.from("company-logos").upload(path, compressed, { contentType: compressed.type });
      if (error) throw error;
      const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
      onChange({ banner_url: data.publicUrl });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const filledSocials = SOCIAL_KINDS.filter((k) => value.socials[k].trim()).length;

  return (
    <div className="rounded-lg border border-border" data-testid="storefront-customizer">
      <Accordion type="multiple" className="px-3">
        <AccordionItem value="portada">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              Portada y textos
              {value.banner_url && <Count>imagen</Count>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <Label>Imagen de portada (opcional)</Label>
              {value.banner_url ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  <img src={value.banner_url} alt="Imagen de portada" className="h-28 w-full object-cover" data-testid="storefront-banner-preview" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin imagen: la portada usa un degradé con el color de tu vitrina.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="storefront-banner-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadBanner(f);
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
                  {value.banner_url ? "Cambiar imagen" : "Subir imagen"}
                </Button>
                {value.banner_url && (
                  <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange({ banner_url: "" })}>
                    <X className="mr-1.5 h-4 w-4" /> Quitar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Mejor una foto horizontal (por ejemplo 1600 × 600 px). El texto de la portada se lee sobre ella.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sf-placeholder">Texto del buscador</Label>
              <Input
                id="sf-placeholder"
                value={value.search_placeholder}
                maxLength={SEARCH_PLACEHOLDER_MAX}
                onChange={(e) => onChange({ search_placeholder: e.target.value })}
                placeholder={DEFAULT_SEARCH_PLACEHOLDER}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sf-footer">Texto al pie de la página</Label>
              <textarea
                id="sf-footer"
                value={value.footer_text}
                maxLength={FOOTER_TEXT_MAX}
                rows={3}
                onChange={(e) => onChange({ footer_text: e.target.value })}
                placeholder="Horarios, formas de pago, aclaraciones…"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-right text-xs text-muted-foreground">{value.footer_text.length}/{FOOTER_TEXT_MAX}</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="sellos">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              Sellos bajo la portada
              {value.seals.length > 0 && <Count>{value.seals.length}</Count>}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <SealsEditor
              seals={value.seals}
              max={SEALS_MAX}
              onChange={(seals) => onChange({ seals })}
              testId="storefront-seals-editor"
              hint="Frases cortas que dan confianza, como tu garantía o tus envíos. Escribí solo lo que realmente ofrecés: empieza vacío."
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="producto">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              Página del producto
              {value.product_seals.length + value.includes.length > 0 && <Count>{value.product_seals.length + value.includes.length}</Count>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-5">
            <div className="space-y-2">
              <Label>Sellos del producto</Label>
              <SealsEditor
                seals={value.product_seals}
                max={PRODUCT_SEALS_MAX}
                onChange={(product_seals) => onChange({ product_seals })}
                testId="storefront-product-seals-editor"
                hint="Aparecen en la ficha de cada artículo."
              />
            </div>
            <div className="space-y-2">
              <Label>Qué incluye</Label>
              <IncludesEditor items={value.includes} onChange={(includes) => onChange({ includes })} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="redes" className="border-b-0">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              Redes sociales
              {filledSocials > 0 && <Count>{filledSocials}</Count>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            {SOCIAL_KINDS.map((kind) => {
              const error = socialErrors[kind];
              return (
                <div key={kind} className="space-y-1">
                  <Label htmlFor={`sf-social-${kind}`} className="flex items-center gap-1.5 text-xs">
                    <SocialIcon kind={kind} className="h-3.5 w-3.5" /> {SOCIAL_LABELS[kind]}
                  </Label>
                  <Input
                    id={`sf-social-${kind}`}
                    value={value.socials[kind]}
                    maxLength={200}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => onChange({ socials: { ...value.socials, [kind]: e.target.value } })}
                    placeholder={SOCIAL_PLACEHOLDERS[kind]}
                    aria-invalid={!!error}
                  />
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{children}</span>;
}

interface SealsEditorProps {
  seals: StorefrontSeal[];
  max: number;
  hint: string;
  testId: string;
  onChange: (seals: StorefrontSeal[]) => void;
}

function SealsEditor({ seals, max, hint, testId, onChange }: SealsEditorProps) {
  const update = (index: number, p: Partial<StorefrontSeal>) =>
    onChange(seals.map((s, i) => (i === index ? { ...s, ...p } : s)));

  return (
    <div className="space-y-3" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {seals.map((seal, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-3" data-testid={`${testId}-row`}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <SealIcon id={seal.icon} className="h-[18px] w-[18px]" />
            </span>
            <select
              value={seal.icon}
              onChange={(e) => update(i, { icon: e.target.value })}
              aria-label="Ícono del sello"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
            >
              {SEAL_ICONS.map((icon) => (
                <option key={icon.id} value={icon.id}>{icon.label}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar sello"
              onClick={() => onChange(seals.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <Input
            value={seal.title}
            maxLength={SEAL_TITLE_MAX}
            onChange={(e) => update(i, { title: e.target.value })}
            placeholder="Título (ej. Garantía)"
            aria-label="Título del sello"
          />
          <Input
            value={seal.subtitle ?? ""}
            maxLength={SEAL_SUBTITLE_MAX}
            onChange={(e) => update(i, { subtitle: e.target.value })}
            placeholder="Detalle (opcional)"
            aria-label="Detalle del sello"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={seals.length >= max}
        onClick={() => onChange([...seals, { icon: DEFAULT_SEAL_ICON, title: "", subtitle: "" }])}
      >
        <Plus className="mr-1.5 h-4 w-4" /> Agregar sello{seals.length > 0 ? ` (${seals.length}/${max})` : ""}
      </Button>
    </div>
  );
}

function IncludesEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div className="space-y-2" data-testid="storefront-includes-editor">
      <p className="text-xs text-muted-foreground">Lo que recibe el cliente con cada compra (ej. "Cargador", "Funda"). Se muestra igual en todos los artículos.</p>
      {items.map((text, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={text}
            maxLength={INCLUDE_MAX}
            onChange={(e) => onChange(items.map((t, idx) => (idx === i ? e.target.value : t)))}
            placeholder="Ej. Cargador original"
            aria-label={`Incluye ${i + 1}`}
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Quitar" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={items.length >= INCLUDES_MAX} onClick={() => onChange([...items, ""])}>
        <Plus className="mr-1.5 h-4 w-4" /> Agregar{items.length > 0 ? ` (${items.length}/${INCLUDES_MAX})` : ""}
      </Button>
    </div>
  );
}
