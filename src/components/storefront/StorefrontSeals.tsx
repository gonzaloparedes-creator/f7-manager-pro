import { Check } from "lucide-react";
import type { StorefrontSeal } from "@/lib/storefront";
import { SealIcon } from "./StorefrontIcons";

function SealText({ seal }: { seal: StorefrontSeal }) {
  return (
    <span className="min-w-0">
      <span className="block break-words text-sm font-semibold leading-tight text-foreground">{seal.title}</span>
      {seal.subtitle && <span className="mt-0.5 block break-words text-xs leading-snug text-muted-foreground">{seal.subtitle}</span>}
    </span>
  );
}

/** Franja de sellos del negocio bajo la portada. Sin sellos cargados no ocupa lugar. */
export function SealsStrip({ seals }: { seals: StorefrontSeal[] }) {
  if (seals.length === 0) return null;
  return (
    <section aria-label="Garantías y beneficios" className="border-b border-border bg-card/60" data-testid="storefront-seals">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:flex sm:flex-wrap sm:gap-x-10">
        {seals.map((seal, i) => (
          <li key={`${seal.title}-${i}`} className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <SealIcon id={seal.icon} className="h-[18px] w-[18px]" />
            </span>
            <SealText seal={seal} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sellos que acompañan cada artículo en su página. */
export function ProductSeals({ seals }: { seals: StorefrontSeal[] }) {
  if (seals.length === 0) return null;
  return (
    <ul className="mt-5 grid gap-2.5 sm:grid-cols-2" data-testid="storefront-product-seals">
      {seals.map((seal, i) => (
        <li key={`${seal.title}-${i}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <SealIcon id={seal.icon} className="h-[18px] w-[18px]" />
          </span>
          <SealText seal={seal} />
        </li>
      ))}
    </ul>
  );
}

export function IncludesList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5" data-testid="storefront-includes">
      <h2 className="text-sm font-semibold text-foreground">Qué incluye</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((text, i) => (
          <li key={`${text}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-foreground">
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
