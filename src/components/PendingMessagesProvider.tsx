import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCompany } from "@/hooks/useCompany";
import { PendingMessagesContext, type PendingMessagesValue } from "@/hooks/usePendingMessages";
import { MESSAGE_LOG_EVENT } from "@/lib/customerMessages";
import { fetchPendingMessages, type PendingQueue } from "@/lib/pendingMessages";

const POLL_MS = 90_000;
const EMPTY: PendingQueue = { evolutionActive: false, items: [] };

export default function PendingMessagesProvider({ children }: { children: ReactNode }) {
  const { companyId } = useCompany();
  const [queue, setQueue] = useState<PendingQueue>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const inFlight = useRef(false);
  const rerun = useRef(false);
  const refreshRef = useRef<() => void>(() => {});

  const refresh = useCallback(() => {
    if (!companyId) return;
    // Un refresco pedido mientras otro está en curso podría leer datos
    // anteriores al registro que lo disparó: se repite al terminar.
    if (inFlight.current) {
      rerun.current = true;
      return;
    }
    inFlight.current = true;
    fetchPendingMessages(companyId)
      .then((next) => {
        setQueue(next);
        const ids = new Set(next.items.map((i) => i.id));
        setHidden((prev) => new Set([...prev].filter((id) => ids.has(id))));
        setError(false);
      })
      .catch((e) => {
        console.warn("No se pudo calcular la cola de avisos:", e);
        setError(true);
      })
      .finally(() => {
        inFlight.current = false;
        setLoading(false);
        if (rerun.current) {
          rerun.current = false;
          refreshRef.current();
        }
      });
  }, [companyId]);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!companyId) return;
    refresh();
    const onChange = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(MESSAGE_LOG_EVENT, onChange);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, POLL_MS);
    return () => {
      window.removeEventListener(MESSAGE_LOG_EVENT, onChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [companyId, refresh]);

  const markHandled = useCallback((ids: string[]) => {
    setHidden((prev) => new Set([...prev, ...ids]));
  }, []);

  const value = useMemo<PendingMessagesValue>(() => {
    const items = queue.items.filter((i) => !hidden.has(i.id));
    return {
      items,
      count: items.length,
      evolutionActive: queue.evolutionActive,
      loading,
      error,
      refresh,
      markHandled,
    };
  }, [queue, hidden, loading, error, refresh, markHandled]);

  return <PendingMessagesContext.Provider value={value}>{children}</PendingMessagesContext.Provider>;
}
