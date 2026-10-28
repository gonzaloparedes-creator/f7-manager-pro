export type Lang = "es" | "en" | "pt";

export const DEFAULT_LANG: Lang = "es";

export const LANGUAGES: { code: Lang; label: string; htmlLang: string; numberLocale: string }[] = [
  { code: "es", label: "Español", htmlLang: "es", numberLocale: "es-PY" },
  { code: "en", label: "English", htmlLang: "en", numberLocale: "en-US" },
  { code: "pt", label: "Português", htmlLang: "pt-BR", numberLocale: "pt-BR" },
];

export const LANG_STORAGE_KEY = "f7-landing-lang";

export function languageInfo(lang: Lang) {
  return LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
}

// "pt", "PT", "pt-BR" y "pt_br" valen como portugués; lo desconocido no es idioma.
export function parseLang(value: string | null | undefined): Lang | null {
  const code = value?.trim().toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.find((l) => l.code === code)?.code ?? null;
}

// Manda el link (?lang=pt, para avisos dirigidos a un país), después lo que la
// persona eligió la última vez, y si no hay nada, español.
export function resolveInitialLang(search: string, stored: string | null): { lang: Lang; fromUrl: boolean } {
  const fromUrl = parseLang(new URLSearchParams(search).get("lang"));
  if (fromUrl) return { lang: fromUrl, fromUrl: true };
  return { lang: parseLang(stored) ?? DEFAULT_LANG, fromUrl: false };
}

// El almacenamiento puede estar bloqueado (modo privado): nunca debe romper la página.
export function readStoredLang(): string | null {
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeLang(lang: Lang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* sin almacenamiento: la elección vale solo para esta visita */
  }
}

export function formatNumber(value: number, lang: Lang): string {
  return value.toLocaleString(languageInfo(lang).numberLocale);
}
