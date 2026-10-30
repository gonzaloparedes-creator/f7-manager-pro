import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveDictionary } from "@/i18n/dictionary";
import {
  formatNumber,
  languageInfo,
  readStoredLang,
  resolveInitialLang,
  storeLang,
  type Lang,
} from "@/i18n/language";
import { LandingLanguageContext, type LandingLanguage } from "@/i18n/useLanguage";

// fixedLang: para una landing de un solo idioma (/py, Paraguay). No lee ni guarda la elección
// de las otras landings, ignora ?lang= y no se puede cambiar.
export function LandingLanguageProvider({ children, fixedLang }: { children: ReactNode; fixedLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(
    () => fixedLang ?? resolveInitialLang(window.location.search, readStoredLang()).lang
  );

  useEffect(() => {
    if (fixedLang) return;
    // Un link con ?lang= se recuerda: los links entre / y /oferta no llevan el parámetro.
    if (resolveInitialLang(window.location.search, null).fromUrl) storeLang(lang);
    // Solo al entrar: después manda lo que elija la persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El idioma elegido vale solo para las landings: al salir se devuelve el <html lang> original.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang;
    root.lang = languageInfo(lang).htmlLang;
    return () => {
      root.lang = previous;
    };
  }, [lang]);

  const setLang = useCallback(
    (next: Lang) => {
      if (fixedLang) return;
      setLangState(next);
      storeLang(next);
    },
    [fixedLang]
  );

  const value = useMemo<LandingLanguage>(
    () => ({
      lang,
      setLang,
      t: resolveDictionary(lang),
      gs: (amount) => `Gs. ${formatNumber(amount, lang)}`,
    }),
    [lang, setLang]
  );

  return <LandingLanguageContext.Provider value={value}>{children}</LandingLanguageContext.Provider>;
}
