import { createContext, useContext } from "react";
import type { LandingDict } from "@/i18n/dictionaries/es";
import type { Lang } from "@/i18n/language";

export interface LandingLanguage {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: LandingDict;
  /** "Gs. 1.850.000" con el separador de miles del idioma elegido. */
  gs: (amount: number) => string;
}

export const LandingLanguageContext = createContext<LandingLanguage | null>(null);

export function useLanguage(): LandingLanguage {
  const context = useContext(LandingLanguageContext);
  if (!context) throw new Error("useLanguage debe usarse dentro de LandingLanguageProvider");
  return context;
}
