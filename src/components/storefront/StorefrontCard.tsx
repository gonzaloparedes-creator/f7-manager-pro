import { Link } from "react-router-dom";
import { BatteryMedium, ShoppingBag, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { priceLabel, stockLabel, storefrontPath, type StorefrontItem } from "@/lib/storefront";

interface Props {
  item: StorefrontItem;
  slug: string;
  showStock: boolean;
  preview?: boolean;
}

export default function StorefrontCard({ item, slug, showStock, preview = false }: Props) {
  const hasPrice = item.price !== null && item.price > 0;
  const stock = showStock ? stockLabel(item) : null;

  const body = (
    <>
      <div className="relative aspect-square overflow-hidden bg-muted">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10" />
          </div>
        )}
        {item.is_device && (
          <Badge className="absolute left-2 top-2 gap-1 border-0 bg-card/90 text-[11px] text-foreground shadow-sm">
            <Smartphone className="h-3 w-3 text-primary" /> Equipo
          </Badge>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-foreground">{item.name}</h3>
        <p className={cn("text-base font-bold", hasPrice ? "text-primary" : "text-sm font-medium text-muted-foreground")}>
          {priceLabel(item)}
        </p>
        {(item.is_device && item.battery_health !== null) || stock ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {item.is_device && item.battery_health !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <BatteryMedium className="h-3 w-3" /> {item.battery_health}%
              </span>
            )}
            {stock && <span className="rounded-full bg-muted px-2 py-0.5">{stock}</span>}
          </div>
        ) : null}
      </div>
    </>
  );

  const className =
    "group block overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-elevated";

  return preview ? (
    <div className={className}>{body}</div>
  ) : (
    <Link to={storefrontPath(slug, item.id)} className={className}>
      {body}
    </Link>
  );
}
