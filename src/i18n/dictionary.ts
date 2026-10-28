import { en } from "@/i18n/dictionaries/en";
import { es, type LandingDict } from "@/i18n/dictionaries/es";
import { pt } from "@/i18n/dictionaries/pt";
import { formatNumber, type Lang } from "@/i18n/language";
import { OFFER_GUARANTEE_DAYS } from "@/lib/ofertaOffer";
import { PRICING } from "@/lib/plans";

export const DICTIONARIES: Record<Lang, LandingDict> = { es, en, pt };

function mapStrings<T>(value: T, fn: (text: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, fn)])) as T;
  }
  return value;
}

// Completa {days} ("7 días"), {dayCount} ("7", para "7-day" en inglés) y {starterPrice} en todos los textos: así los días de garantía salen de un
// único valor (OFFER_GUARANTEE_DAYS) y el precio sale de PRICING, nunca escritos a mano.
export function resolveDictionary(lang: Lang): LandingDict {
  const dict = DICTIONARIES[lang];
  const shared: Record<string, string> = {
    days: `${OFFER_GUARANTEE_DAYS} ${dict.common.daysUnit}`,
    dayCount: String(OFFER_GUARANTEE_DAYS),
    starterPrice: formatNumber(PRICING.starter.mensual.gs, lang),
  };
  return mapStrings(dict, (text) => text.replace(/\{(days|dayCount|starterPrice)\}/g, (_, name: string) => shared[name]));
}
