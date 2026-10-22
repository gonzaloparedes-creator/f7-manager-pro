import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_FINANCE_DATA, loadFinanceData, type FinanceData } from "@/lib/f7FinanceApi";
import type { F7Category, F7Entry, F7Partner, F7Recurring } from "@/lib/f7Finance";
import { todayInAsuncion } from "@/lib/subscriptionReceipt";

function upsert<T extends { id: string }>(list: T[], rows: T[]): T[] {
  const incoming = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const next = list.map((item) => {
    const row = incoming.get(item.id);
    if (!row) return item;
    seen.add(item.id);
    return row;
  });
  for (const row of rows) if (!seen.has(row.id)) next.push(row);
  return next;
}

export function useF7Finance(enabled: boolean) {
  const [data, setData] = useState<FinanceData>(EMPTY_FINANCE_DATA);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [generated, setGenerated] = useState(0);
  const [today, setToday] = useState(() => todayInAsuncion());
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setFailed(false);
    try {
      const result = await loadFinanceData();
      if (id !== requestId.current) return;
      setData(result.data);
      setGenerated(result.generated);
      setToday(todayInAsuncion());
    } catch {
      if (id !== requestId.current) return;
      setFailed(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  // Cambios locales para no recargar todo después de cada guardado.
  const putEntries = useCallback((rows: F7Entry[]) => {
    setData((prev) => ({ ...prev, entries: upsert(prev.entries, rows) }));
  }, []);
  const putRecurring = useCallback((row: F7Recurring) => {
    setData((prev) => ({ ...prev, recurring: upsert(prev.recurring, [row]) }));
  }, []);
  const putPartner = useCallback((row: F7Partner) => {
    setData((prev) => ({ ...prev, partners: upsert(prev.partners, [row]) }));
  }, []);
  const removePartner = useCallback((id: string) => {
    setData((prev) => ({ ...prev, partners: prev.partners.filter((p) => p.id !== id) }));
  }, []);
  const putCategory = useCallback((row: F7Category) => {
    setData((prev) => ({ ...prev, categories: upsert(prev.categories, [row]) }));
  }, []);
  const removeCategory = useCallback((id: string) => {
    setData((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== id) }));
  }, []);

  return {
    data,
    today,
    loading,
    failed,
    generated,
    reload,
    putEntries,
    putRecurring,
    putPartner,
    removePartner,
    putCategory,
    removeCategory,
  };
}

export type F7FinanceStore = ReturnType<typeof useF7Finance>;
