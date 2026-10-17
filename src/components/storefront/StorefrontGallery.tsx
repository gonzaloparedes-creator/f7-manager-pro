import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  images: string[];
  name: string;
}

export default function StorefrontGallery({ images, name }: Props) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const count = images.length;
  const current = Math.min(index, Math.max(count - 1, 0));

  const go = (delta: number) => setIndex((current + delta + count) % count);

  if (count === 0) {
    return (
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-muted-foreground">
        <ShoppingBag className="h-16 w-16" />
      </div>
    );
  }

  return (
    <div data-testid="storefront-gallery">
      <div
        className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null || count < 2) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <img src={images[current]} alt={count > 1 ? `${name} (foto ${current + 1} de ${count})` : name} className="h-full w-full object-cover" />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-card"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-card"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === current}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted transition-colors",
                i === current ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
