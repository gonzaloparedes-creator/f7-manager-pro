import { describe, expect, it } from "vitest";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { pt } from "./dictionaries/pt";
import { resolveDictionary } from "./dictionary";
import type { Lang } from "./language";
import { OFFER_GUARANTEE_DAYS } from "@/lib/ofertaOffer";
import { PLAN_FEATURES, PRICING, type PlanType } from "@/lib/plans";

function flatten(value: unknown, path = ""): Record<string, string> {
  if (typeof value === "string") return { [path]: value };
  if (Array.isArray(value)) return Object.assign({}, ...value.map((item, i) => flatten(item, `${path}[${i}]`)));
  if (value && typeof value === "object") {
    return Object.assign({}, ...Object.entries(value).map(([key, item]) => flatten(item, path ? `${path}.${key}` : key)));
  }
  return {};
}

// Solo en otros idiomas: avisa que el sistema todavía está en español (en español no hace falta).
const ONLY_IN_OTHER_LANGUAGES = "oferta.faq.extra";
const skipExtra = (paths: string[]) => paths.filter((p) => !p.startsWith(ONLY_IN_OTHER_LANGUAGES));

const flat = { es: flatten(es), en: flatten(en), pt: flatten(pt) };
const OTHERS: Exclude<Lang, "es">[] = ["en", "pt"];

const tokens = (text: string) => ({
  strong: (text.match(/\*\*/g) ?? []).length,
  accent: (text.match(/\[\[/g) ?? []).length + (text.match(/\]\]/g) ?? []).length,
  placeholders: (text.match(/\{\w+\}/g) ?? []).sort(),
});

// Frases que pueden ser idénticas al español porque son nombres propios, siglas o una palabra
// que se escribe igual en ese idioma. Cada excepción está revisada a mano.
const SAME_AS_SPANISH: Record<Exclude<Lang, "es">, Set<string>> = {
  en: new Set([
    "home.meta.title", // nombre del producto
    "pricing.currencyGs", // "Guaraníes (Gs.)"
    "pricing.currencyUsd", // "USD ($)"
    "pricing.usdPrefix", // "$"
    "oferta.solution.businessOnly", // nombre del plan
  ]),
  pt: new Set([
    "home.meta.title",
    "pricing.currencyUsd",
    "oferta.solution.businessOnly",
    // Palabras que en portugués se escriben igual que en español:
    "common.languageLabel", // Idioma
    "pricing.perSemester", // / semestre
    "pricing.plans.starter.features[3]", // Base de clientes ilimitada
    "home.chaos.before", // Antes
    "home.pain.less", // − Ocultar
    "home.solution.recent[1]", // Redmi Note 10 — flex
    "home.features.alerts.title", // Avisos Inteligentes
    "home.features.alerts.alternative", // ✓ +595 982 222 222 (alternativo — esposa)
    "home.features.profit.gross", // Bruto
    "oferta.solution.blocks.whatsapp.pill", // Avisos por WhatsApp
  ]),
};

describe.each(OTHERS)("diccionario %s", (lang) => {
  it("tiene exactamente las mismas frases que el español", () => {
    expect(skipExtra(Object.keys(flat[lang])).sort()).toEqual(skipExtra(Object.keys(flat.es)).sort());
  });

  it("ninguna frase está vacía", () => {
    for (const [path, text] of Object.entries(flat[lang])) {
      expect(text.trim(), path).not.toBe("");
    }
  });

  it("los marcadores (**, [[ ]], {días}) coinciden con los del español", () => {
    for (const path of skipExtra(Object.keys(flat.es))) {
      const base = tokens(flat.es[path]);
      const other = tokens(flat[lang][path]);
      expect(other.strong, `${path}: ** `).toBe(base.strong);
      expect(other.accent, `${path}: [[ ]]`).toBe(base.accent);
      // {dayCount} es la forma inglesa de {days}: "7 días" / "7-day"
      const normalize = (list: string[]) => list.map((p) => (p === "{dayCount}" ? "{days}" : p)).sort();
      expect(normalize(other.placeholders), `${path}: placeholders`).toEqual(normalize(base.placeholders));
    }
  });

  it("no quedó ninguna frase sin traducir (idéntica al español)", () => {
    const untranslated = Object.keys(flat.es).filter(
      (path) => flat[lang][path] === flat.es[path] && !SAME_AS_SPANISH[lang].has(path)
    );
    expect(untranslated).toEqual([]);
  });

  it("las funciones de cada plan tienen la misma cantidad que las del plan real", () => {
    for (const plan of Object.keys(PLAN_FEATURES) as PlanType[]) {
      const dict = lang === "en" ? en : pt;
      expect(dict.pricing.plans[plan].features, plan).toHaveLength(PLAN_FEATURES[plan].length);
    }
  });

  it("explica que el sistema está en español (para no prometer lo que no hay)", () => {
    expect(flat[lang]["oferta.faq.extra[0].q"]).toBeTruthy();
    expect(flat[lang]["oferta.faq.extra[0].a"]).toMatch(/Spanish|espanhol/);
  });
});

describe("diccionario es", () => {
  it("usa los planes y mensajes reales de lib/plans (una sola fuente)", () => {
    for (const plan of Object.keys(PLAN_FEATURES) as PlanType[]) {
      expect(es.pricing.plans[plan].features).toEqual(PLAN_FEATURES[plan]);
    }
  });

  it("no lleva la pregunta del idioma (la landing ya está en español)", () => {
    expect(es.oferta.faq.extra).toEqual([]);
  });
});

describe("resolveDictionary", () => {
  it.each(["es", "en", "pt"] as Lang[])("%s: completa {days}, {dayCount} y {starterPrice} en todos los textos", (lang) => {
    const resolved = flatten(resolveDictionary(lang));
    for (const [path, text] of Object.entries(resolved)) {
      expect(text, path).not.toMatch(/\{(days|dayCount|starterPrice)\}/);
    }
    // {amount} se completa recién al dibujar cada precio
    const withBraces = Object.entries(resolved).filter(([, text]) => /\{\w+\}/.test(text));
    expect(withBraces.map(([path]) => path)).toEqual(["pricing.equivalent"]);
  });

  it("los días de garantía salen de OFFER_GUARANTEE_DAYS en los tres idiomas", () => {
    const n = OFFER_GUARANTEE_DAYS;
    expect(resolveDictionary("es").common.ctaGuarantee).toBe(`Empezar con garantía de ${n} días`);
    expect(resolveDictionary("en").common.ctaGuarantee).toBe(`Start with the ${n}-day guarantee`);
    expect(resolveDictionary("pt").common.ctaGuarantee).toBe(`Comece com garantia de ${n} dias`);
    expect(resolveDictionary("en").oferta.guarantee.steps.use.title).toBe(`You use it for ${n} days in your shop`);
  });

  it("el precio del plan Starter sale de PRICING con el separador de cada idioma", () => {
    const price = PRICING.starter.mensual.gs;
    expect(price).toBe(55000);
    const faqPrice = (lang: Lang) => resolveDictionary(lang).oferta.faq.items[4].a;
    expect(faqPrice("es")).toContain("Desde 55.000 Gs.");
    expect(faqPrice("en")).toContain("From 55,000 Gs.");
    expect(faqPrice("pt")).toContain("A partir de 55.000 Gs.");
  });

  it("no modifica los diccionarios originales", () => {
    resolveDictionary("en");
    expect(en.common.ctaGuarantee).toContain("{dayCount}");
    expect(es.common.ctaGuarantee).toContain("{days}");
  });
});
