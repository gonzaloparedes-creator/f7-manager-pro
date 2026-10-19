import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BatteryMedium, Check, Loader2, MessageCircle, Share2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StorefrontShell, { StorefrontUnavailable, useStorefrontTitle } from "@/components/storefront/StorefrontShell";
import StorefrontCard from "@/components/storefront/StorefrontCard";
import StorefrontGallery from "@/components/storefront/StorefrontGallery";
import { IncludesList, ProductSeals } from "@/components/storefront/StorefrontSeals";
import {
  buildInterestMessage,
  galleryImages,
  priceLabel,
  stockLabel,
  storefrontPath,
  storefrontUrl,
  whatsappLink,
  type StorefrontItemData,
} from "@/lib/storefront";

type State = { status: "loading" } | { status: "missing" } | { status: "error" } | { status: "ready"; data: StorefrontItemData };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PublicStorefrontItem() {
  const { slug, itemId } = useParams();
  const [state, setState] = useState<State>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    if (!slug || !itemId || !UUID_RE.test(itemId)) {
      setState({ status: "missing" });
      return;
    }
    setState({ status: "loading" });
    (supabase as any)
      .rpc("get_storefront_item", { _slug: slug, _item_id: itemId })
      .then(({ data, error }: { data: StorefrontItemData | null; error: unknown }) => {
        if (!active) return;
        if (error) setState({ status: "error" });
        else if (!data) setState({ status: "missing" });
        else setState({ status: "ready", data });
      });
    return () => { active = false; };
  }, [slug, itemId]);

  const ready = state.status === "ready" ? state.data : null;
  useStorefrontTitle(ready?.store.name, ready?.item?.name);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(t);
  }, [copied]);

  const share = async (name: string) => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copiá el enlace", url);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (state.status === "error") {
    return <StorefrontUnavailable title="No pudimos cargar el artículo" message="Revisá tu conexión y probá de nuevo en un momento." />;
  }
  if (state.status === "missing" || !ready) {
    return (
      <StorefrontUnavailable
        title="Esta vitrina no está disponible"
        message="El enlace puede estar mal escrito o el negocio la tiene pausada por ahora."
        backTo={slug ? storefrontPath(slug) : undefined}
      />
    );
  }

  const { store, item, similar } = ready;
  if (!item) {
    return (
      <StorefrontUnavailable
        title="Este artículo ya no está disponible"
        message="Puede que se haya vendido o que el negocio lo haya sacado de la vitrina."
        backTo={storefrontPath(store.slug)}
      />
    );
  }

  const stock = store.show_stock ? stockLabel(item) : null;
  const interestHref = store.whatsapp_phone
    ? whatsappLink(
        store.whatsapp_phone,
        buildInterestMessage(item, store.name, storefrontUrl(store.slug, window.location.origin, item.id))
      )
    : null;
  const hasPrice = item.price !== null && item.price > 0;

  return (
    <StorefrontShell store={store}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link
          to={storefrontPath(store.slug)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la vitrina
        </Link>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <StorefrontGallery key={item.id} images={galleryImages(item)} name={item.name} />

          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {item.category && <span className="rounded-full bg-muted px-2.5 py-1">{item.category}</span>}
              {item.is_device && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                  <Smartphone className="h-3 w-3 text-primary" /> Equipo
                </span>
              )}
              {item.is_device && item.battery_health !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                  <BatteryMedium className="h-3 w-3" /> Batería {item.battery_health}%
                </span>
              )}
              {stock && <span className="rounded-full bg-muted px-2.5 py-1">{stock}</span>}
            </div>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{item.name}</h1>
            <p className={hasPrice ? "mt-2 text-3xl font-extrabold text-primary" : "mt-2 text-lg font-medium text-muted-foreground"}>
              {priceLabel(item)}
            </p>
            {hasPrice && store.installments_text?.trim() && (
              <p className="mt-1 text-sm text-muted-foreground">{store.installments_text.trim()}</p>
            )}

            {item.public_description?.trim() && (
              <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{item.public_description.trim()}</p>
            )}

            <IncludesList items={store.includes} />
            <ProductSeals seals={store.product_seals} />

            <div className="mt-6 flex gap-2.5">
              {interestHref && (
                <a
                  href={interestHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  data-testid="storefront-contact"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" /> Contactar por WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={() => void share(item.name)}
                aria-label={copied ? "Enlace copiado" : "Compartir"}
                title={copied ? "Enlace copiado" : "Compartir"}
                className={
                  interestHref
                    ? "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-accent"
                    : "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-base font-medium text-foreground transition-colors hover:bg-accent sm:flex-none"
                }
                data-testid="storefront-share"
              >
                {copied ? <Check className="h-5 w-5 text-primary" /> : <Share2 className="h-5 w-5" />}
                {!interestHref && (copied ? "Enlace copiado" : "Compartir")}
              </button>
            </div>
            {interestHref && (
              <p className="mt-3 text-xs text-muted-foreground">
                Se abre WhatsApp con el mensaje ya escrito. Te respondemos para confirmar disponibilidad y coordinar la entrega.
              </p>
            )}
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold text-foreground">También te puede interesar</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {similar.map((s) => (
                <StorefrontCard key={s.id} item={s} slug={store.slug} showStock={store.show_stock} />
              ))}
            </div>
          </section>
        )}
      </div>
    </StorefrontShell>
  );
}
