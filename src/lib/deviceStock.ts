export const STALE_DEVICE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

type StockItem = {
  is_device: boolean;
  stock: number;
  cost_price: number | string | null;
  created_at?: string | null;
};

export function daysInStock(createdAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  return Math.max(0, Math.floor((now.getTime() - created) / DAY_MS));
}

export function isStaleDevice(item: StockItem, now: Date = new Date(), threshold = STALE_DEVICE_DAYS): boolean {
  if (!item.is_device || item.stock <= 0) return false;
  const days = daysInStock(item.created_at, now);
  return days !== null && days >= threshold;
}

export function staleDeviceSummary(items: StockItem[], now: Date = new Date(), threshold = STALE_DEVICE_DAYS) {
  const stale = items.filter((i) => isStaleDevice(i, now, threshold));
  return {
    count: stale.length,
    immobilizedCost: stale.reduce((sum, i) => sum + i.stock * Number(i.cost_price || 0), 0),
  };
}

export function hasDevicesInStock(items: StockItem[]): boolean {
  return items.some((i) => i.is_device && i.stock > 0);
}

export function daysInStockLabel(days: number): string {
  if (days === 0) return "Ingresó hoy";
  if (days === 1) return "1 día en stock";
  return `${days} días en stock`;
}
