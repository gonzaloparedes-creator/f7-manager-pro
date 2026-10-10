import { createContext, useContext } from "react";
import type { PendingMessage } from "@/lib/pendingMessages";

export interface PendingMessagesValue {
  items: PendingMessage[];
  count: number;
  /** La empresa sigue con Evolution: el servidor avisa solo y no hay cola. */
  evolutionActive: boolean;
  loading: boolean;
  error: boolean;
  refresh: () => void;
  /** Oculta ya un aviso resuelto, sin esperar a que el refresco lo confirme. */
  markHandled: (ids: string[]) => void;
}

export const PendingMessagesContext = createContext<PendingMessagesValue>({
  items: [],
  count: 0,
  evolutionActive: false,
  loading: false,
  error: false,
  refresh: () => {},
  markHandled: () => {},
});

export function usePendingMessages() {
  return useContext(PendingMessagesContext);
}
