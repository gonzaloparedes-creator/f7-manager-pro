import { createContext, useContext } from "react";
import type { CurrencyCode } from "@/lib/currency";

export interface CurrencyContextValue {
  /** Moneda de la empresa con la sesión abierta. */
  currency: CurrencyCode;
  /** Después de guardar el cambio en la base: vuelve a dibujar todos los montos. */
  setCurrency: (code: CurrencyCode) => void;
}

export const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency debe usarse dentro de CurrencyProvider");
  return context;
}
