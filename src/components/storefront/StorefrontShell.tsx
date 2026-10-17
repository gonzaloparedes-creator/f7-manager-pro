import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MapPin, MessageCircle, Navigation, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accentStyle,
  buildGeneralMessage,
  mapsUrl,
  socialLinks,
  storefrontPath,
  whatsappLink,
  type StorefrontStore,
} from "@/lib/storefront";
import { SocialIcon } from "./StorefrontIcons";

interface ShellProps {
  store: StorefrontStore;
  /** Vista previa dentro del panel de administración: sin navegación real y con el botón flotante contenido. */
  preview?: boolean;
  children: ReactNode;
}

export function useStorefrontTitle(storeName: string | undefined, detail?: string) {
  useEffect(() => {
    if (!storeName) return;
    const previous = document.title;
    document.title = detail ? `${detail} · ${storeName}` : `${storeName} · Vitrina`;
    return () => { document.title = previous; };
  }, [storeName, detail]);
}

export default function StorefrontShell({ store, preview = false, children }: ShellProps) {
  const waHref = store.whatsapp_phone ? whatsappLink(store.whatsapp_phone, buildGeneralMessage(store.name)) : null;
  const socials = socialLinks(store.socials);

  const brand = (
    <span className="flex min-w-0 items-center gap-2.5">
      {store.logo_url ? (
        <img src={store.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-border bg-card object-contain" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </span>
      )}
      <span className="truncate text-base font-bold text-foreground">{store.name}</span>
    </span>
  );

  return (
    <div style={accentStyle(store.accent_color)} className={cn("bg-background text-foreground", !preview && "min-h-screen")}>
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          {preview ? <div className="min-w-0">{brand}</div> : <Link to={storefrontPath(store.slug)} className="min-w-0">{brand}</Link>}
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={preview ? (e) => e.preventDefault() : undefined}
              className="hidden items-center gap-1.5 rounded-full border border-primary/40 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 sm:inline-flex"
            >
              <MessageCircle className="h-4 w-4" /> Escribinos
            </a>
          )}
        </div>
      </header>

      <main>{children}</main>

      <StorefrontLocation store={store} preview={preview} />

      <footer className="border-t border-border bg-card/60 px-4 py-8 text-center text-xs text-muted-foreground">
        <p className="text-sm font-semibold text-foreground">{store.name}</p>
        {store.footer_text?.trim() && (
          <p className="mx-auto mt-2 max-w-xl whitespace-pre-line text-sm leading-relaxed">{store.footer_text.trim()}</p>
        )}
        {socials.length > 0 && (
          <nav aria-label="Redes sociales" className="mt-4 flex flex-wrap items-center justify-center gap-2.5" data-testid="storefront-socials">
            {socials.map((s) => (
              <a
                key={s.kind}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
                onClick={preview ? (e) => e.preventDefault() : undefined}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <SocialIcon kind={s.kind} className="h-[18px] w-[18px]" />
              </a>
            ))}
          </nav>
        )}
        <p className="mt-4">Vitrina hecha con F7 Manager</p>
      </footer>

      {waHref && (
        <div className={cn(preview ? "pointer-events-none sticky bottom-3 flex justify-end px-3 pb-3" : "")}>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Escribir por WhatsApp"
            onClick={preview ? (e) => e.preventDefault() : undefined}
            className={cn(
              "pointer-events-auto z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-elevated transition-transform hover:scale-105 active:scale-95",
              !preview && "fixed bottom-5 right-5"
            )}
          >
            <MessageCircle className="h-7 w-7" />
          </a>
        </div>
      )}
    </div>
  );
}

export function StorefrontLocation({ store, preview = false }: { store: StorefrontStore; preview?: boolean }) {
  const waHref = store.whatsapp_phone ? whatsappLink(store.whatsapp_phone, buildGeneralMessage(store.name)) : null;
  if (!store.address && !waHref) return null;
  const block = preview ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  return (
    <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="storefront-location">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 id="storefront-location" className="flex items-center gap-2 text-lg font-bold text-foreground">
          <MapPin className="h-5 w-5 text-primary" /> Dónde estamos
        </h2>
        {store.address && <p className="mt-2 text-sm text-muted-foreground">{store.address}</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {store.address && (
            <a
              href={mapsUrl(store.address)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={block}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Navigation className="h-4 w-4 text-primary" /> Abrir en el GPS
            </a>
          )}
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={block}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" /> Escribir por WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export function StorefrontUnavailable({ title, message, backTo }: { title: string; message: string; backTo?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Store className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {backTo && (
          <Link to={backTo} className="mt-5 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Ver la vitrina
          </Link>
        )}
      </div>
    </div>
  );
}
