import { formatPYG } from "@/lib/orders";
import { batteryLabel } from "@/lib/deviceSpecs";

export type PriceListItem = {
  name: string;
  stock: number;
  selling_price: number | string | null;
  category_id: string | null;
  battery_health?: number | string | null;
};

export type PriceListInput<T extends PriceListItem> = {
  items: T[];
  categoryName: (id: string | null) => string | null;
  businessName?: string | null;
  branchName?: string | null;
  now?: Date;
};

export type PriceListResult = {
  text: string;
  included: number;
  withoutStock: number;
  withoutPrice: number;
};

const NO_CATEGORY = "Sin categoría";

function sellable(item: PriceListItem): boolean {
  return item.stock > 0 && Number(item.selling_price || 0) > 0;
}

/**
 * Lista de precios lista para pegar en WhatsApp. Solo incluye lo que se puede
 * ofrecer hoy (con stock y con precio de venta) y nunca expone costos, IMEI
 * ni cantidades de stock.
 */
export function buildPriceList<T extends PriceListItem>(input: PriceListInput<T>): PriceListResult {
  const { items, categoryName, businessName, branchName, now = new Date() } = input;

  const withoutStock = items.filter((i) => i.stock <= 0).length;
  const withoutPrice = items.filter((i) => i.stock > 0 && !(Number(i.selling_price || 0) > 0)).length;
  const offered = items.filter(sellable);

  const groups = new Map<string, { label: string; rows: T[] }>();
  for (const item of offered) {
    const key = item.category_id ?? "";
    const label = (item.category_id && categoryName(item.category_id)) || NO_CATEGORY;
    const current = groups.get(key) ?? { label, rows: [] };
    current.rows.push(item);
    groups.set(key, current);
  }

  const ordered = Array.from(groups.values()).sort((a, b) => {
    if (a.label === NO_CATEGORY) return 1;
    if (b.label === NO_CATEGORY) return -1;
    return a.label.localeCompare(b.label);
  });

  const date = now.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
  const title = businessName?.trim() ? `*${businessName.trim()} — Lista de precios*` : "*Lista de precios*";
  const lines: string[] = [title];
  lines.push(branchName ? `${branchName} · ${date}` : date);

  for (const group of ordered) {
    lines.push("");
    lines.push(`*${group.label}*`);
    const rows = [...group.rows].sort((a, b) => a.name.localeCompare(b.name));
    for (const row of rows) {
      const battery = batteryLabel(row.battery_health);
      lines.push(`• ${row.name.trim()}${battery ? ` · ${battery}` : ""} — ${formatPYG(Number(row.selling_price))}`);
    }
  }

  return { text: lines.join("\n"), included: offered.length, withoutStock, withoutPrice };
}
