import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEAL_ICON,
  DEFAULT_SEARCH_PLACEHOLDER,
  EMPTY_QUERY,
  EMPTY_SOCIALS,
  INCLUDES_MAX,
  INCLUDE_MAX,
  NO_CATEGORY_KEY,
  SEALS_MAX,
  SEAL_SUBTITLE_MAX,
  SEAL_TITLE_MAX,
  SOCIAL_URL_MAX,
  accentStyle,
  applyCatalogQuery,
  buildGeneralMessage,
  buildInterestMessage,
  categoriesOf,
  cleanIncludes,
  cleanSeals,
  galleryImages,
  hiddenReason,
  isDefaultQuery,
  isStorefrontVisible,
  mapsUrl,
  normalizeSocialUrl,
  parsePriceInput,
  priceBounds,
  priceLabel,
  searchPlaceholderOf,
  slugify,
  socialLinks,
  stockLabel,
  storefrontPath,
  storefrontUrl,
  validateSlug,
  whatsappLink,
  type StorefrontItem,
} from "./storefront";

function item(over: Partial<StorefrontItem> & { id: string; name: string }): StorefrontItem {
  return {
    price: 100000,
    image_url: null,
    category_id: "c1",
    category: "Celulares",
    is_device: false,
    battery_health: null,
    stock: null,
    created_at: "2026-10-01T10:00:00Z",
    ...over,
  };
}

describe("slugify", () => {
  it("saca tildes, pasa a minúsculas y une con guiones", () => {
    expect(slugify("TecnoFix Asunción")).toBe("tecnofix-asuncion");
    expect(slugify("  Móviles & Más!! ")).toBe("moviles-mas");
  });

  it("corta en 40 caracteres sin dejar un guion al final", () => {
    const slug = slugify("a".repeat(39) + " bbbb");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("devuelve vacío si no queda nada utilizable", () => {
    expect(slugify("¡¡¡")).toBe("");
  });
});

describe("validateSlug", () => {
  it("acepta enlaces válidos", () => {
    expect(validateSlug("mi-taller")).toBeNull();
    expect(validateSlug("abc")).toBeNull();
    expect(validateSlug("taller123")).toBeNull();
  });

  it("rechaza muy corto, muy largo y caracteres inválidos", () => {
    expect(validateSlug("ab")).toMatch(/al menos 3/);
    expect(validateSlug("a".repeat(41))).toMatch(/como máximo 40/);
    expect(validateSlug("Mi-Taller")).not.toBeNull();
    expect(validateSlug("mi taller")).not.toBeNull();
    expect(validateSlug("-mi-taller")).not.toBeNull();
    expect(validateSlug("mi-taller-")).not.toBeNull();
  });
});

describe("storefrontPath / storefrontUrl", () => {
  it("arma la ruta de la vitrina y de un artículo", () => {
    expect(storefrontPath("mi-taller")).toBe("/v/mi-taller");
    expect(storefrontPath("mi-taller", "abc")).toBe("/v/mi-taller/abc");
  });

  it("no duplica la barra del origen", () => {
    expect(storefrontUrl("mi-taller", "https://app.test/")).toBe("https://app.test/v/mi-taller");
    expect(storefrontUrl("mi-taller", "https://app.test", "x1")).toBe("https://app.test/v/mi-taller/x1");
  });
});

describe("isStorefrontVisible / hiddenReason", () => {
  const base = { is_for_sale: true, show_in_storefront: true, stock: 2, selling_price: 50000 };
  const open = { showPrices: true, reserved: false };

  it("muestra lo publicado con stock y precio", () => {
    expect(isStorefrontVisible(base, open)).toBe(true);
    expect(hiddenReason(base, open)).toBeNull();
  });

  it("oculta lo no publicado y no avisa nada (no está marcado)", () => {
    const it = { ...base, show_in_storefront: false };
    expect(isStorefrontVisible(it, open)).toBe(false);
    expect(hiddenReason(it, open)).toBeNull();
  });

  it("oculta sin stock, reservado o sin precio (si se muestran precios)", () => {
    expect(isStorefrontVisible({ ...base, stock: 0 }, open)).toBe(false);
    expect(hiddenReason({ ...base, stock: 0 }, open)).toBe("Sin stock");
    expect(isStorefrontVisible(base, { ...open, reserved: true })).toBe(false);
    expect(hiddenReason(base, { ...open, reserved: true })).toBe("Reservado");
    expect(isStorefrontVisible({ ...base, selling_price: 0 }, open)).toBe(false);
    expect(hiddenReason({ ...base, selling_price: 0 }, open)).toBe("Sin precio");
  });

  it("sin precios visibles, un producto sin precio igual se muestra", () => {
    const it = { ...base, selling_price: 0 };
    expect(isStorefrontVisible(it, { showPrices: false, reserved: false })).toBe(true);
  });

  it("nunca muestra algo que no está a la venta", () => {
    expect(isStorefrontVisible({ ...base, is_for_sale: false }, open)).toBe(false);
  });
});

describe("categoriesOf", () => {
  it("agrupa y cuenta por categoría, y deja 'Otros' al final", () => {
    const list = [
      item({ id: "1", name: "A", category_id: "c2", category: "Fundas" }),
      item({ id: "2", name: "B", category_id: null, category: null }),
      item({ id: "3", name: "C", category_id: "c1", category: "Celulares" }),
      item({ id: "4", name: "D", category_id: "c2", category: "Fundas" }),
    ];
    const cats = categoriesOf(list);
    expect(cats.map((c) => c.label)).toEqual(["Celulares", "Fundas", "Otros"]);
    expect(cats.find((c) => c.label === "Fundas")?.count).toBe(2);
    expect(cats[2].key).toBe(NO_CATEGORY_KEY);
  });
});

describe("priceBounds", () => {
  it("ignora los sin precio", () => {
    const list = [item({ id: "1", name: "A", price: 30000 }), item({ id: "2", name: "B", price: null }), item({ id: "3", name: "C", price: 90000 })];
    expect(priceBounds(list)).toEqual({ min: 30000, max: 90000 });
  });

  it("devuelve null si ninguno tiene precio", () => {
    expect(priceBounds([item({ id: "1", name: "A", price: null })])).toBeNull();
  });
});

describe("applyCatalogQuery", () => {
  const list = [
    item({ id: "1", name: "iPhone 12", price: 2500000, category_id: "c1", category: "Celulares", created_at: "2026-10-03T00:00:00Z" }),
    item({ id: "2", name: "Funda Silicona", price: 40000, category_id: "c2", category: "Fundas", created_at: "2026-10-05T00:00:00Z" }),
    item({ id: "3", name: "Cargador rápido", price: null, category_id: "c3", category: "Cargadores", created_at: "2026-10-04T00:00:00Z" }),
    item({ id: "4", name: "Auriculares", price: 150000, category_id: null, category: null, created_at: "2026-10-01T00:00:00Z" }),
  ];
  const ids = (xs: StorefrontItem[]) => xs.map((x) => x.id);

  it("ordena por más recientes por defecto", () => {
    expect(ids(applyCatalogQuery(list, EMPTY_QUERY))).toEqual(["2", "3", "1", "4"]);
  });

  it("busca sin importar tildes ni mayúsculas, por nombre o categoría", () => {
    expect(ids(applyCatalogQuery(list, { ...EMPTY_QUERY, text: "RAPIDO" }))).toEqual(["3"]);
    expect(ids(applyCatalogQuery(list, { ...EMPTY_QUERY, text: "fundas" }))).toEqual(["2"]);
  });

  it("filtra por categoría, incluida la de sin categoría", () => {
    expect(ids(applyCatalogQuery(list, { ...EMPTY_QUERY, category: "c1" }))).toEqual(["1"]);
    expect(ids(applyCatalogQuery(list, { ...EMPTY_QUERY, category: NO_CATEGORY_KEY }))).toEqual(["4"]);
  });

  it("filtra por rango de precio y deja afuera los sin precio", () => {
    expect(ids(applyCatalogQuery(list, { ...EMPTY_QUERY, minPrice: 100000, maxPrice: 200000 }))).toEqual(["4"]);
    expect(ids(applyCatalogQuery(list, { ...EMPTY_QUERY, minPrice: 1 }))).not.toContain("3");
  });

  it("ordena por precio con los sin precio al final", () => {
    expect(ids(applyCatalogQuery(list, { ...EMPTY_QUERY, sort: "precio_asc" }))).toEqual(["2", "4", "1", "3"]);
    expect(ids(applyCatalogQuery(list, { ...EMPTY_QUERY, sort: "precio_desc" }))).toEqual(["1", "4", "2", "3"]);
  });

  it("ordena por nombre", () => {
    expect(ids(applyCatalogQuery(list, { ...EMPTY_QUERY, sort: "nombre" }))).toEqual(["4", "3", "2", "1"]);
  });

  it("no modifica la lista original", () => {
    const copy = ids(list);
    applyCatalogQuery(list, { ...EMPTY_QUERY, sort: "precio_asc" });
    expect(ids(list)).toEqual(copy);
  });
});

describe("isDefaultQuery", () => {
  it("detecta cuándo hay filtros activos", () => {
    expect(isDefaultQuery(EMPTY_QUERY)).toBe(true);
    expect(isDefaultQuery({ ...EMPTY_QUERY, text: "  " })).toBe(true);
    expect(isDefaultQuery({ ...EMPTY_QUERY, text: "a" })).toBe(false);
    expect(isDefaultQuery({ ...EMPTY_QUERY, sort: "nombre" })).toBe(false);
  });
});

describe("parsePriceInput", () => {
  it("lee números con o sin separadores", () => {
    expect(parsePriceInput("150000")).toBe(150000);
    expect(parsePriceInput("150.000")).toBe(150000);
    expect(parsePriceInput("Gs. 1.500.000")).toBe(1500000);
  });

  it("devuelve null con vacío o texto sin dígitos", () => {
    expect(parsePriceInput("")).toBeNull();
    expect(parsePriceInput("abc")).toBeNull();
  });
});

describe("textos y enlaces", () => {
  it("priceLabel pide consultar cuando no hay precio", () => {
    expect(priceLabel({ price: null })).toBe("Consultar precio");
    expect(priceLabel({ price: 0 })).toBe("Consultar precio");
    expect(priceLabel({ price: 150000 })).toContain("150");
  });

  it("stockLabel solo habla de unidades en productos, no en equipos", () => {
    expect(stockLabel({ stock: 1, is_device: false })).toBe("Última unidad");
    expect(stockLabel({ stock: 5, is_device: false })).toBe("5 disponibles");
    expect(stockLabel({ stock: 1, is_device: true })).toBeNull();
    expect(stockLabel({ stock: null, is_device: false })).toBeNull();
  });

  it("whatsappLink deja solo dígitos y codifica el mensaje", () => {
    expect(whatsappLink("+595 981 123456")).toBe("https://wa.me/595981123456");
    expect(whatsappLink("595981123456", "Hola & chau")).toBe("https://wa.me/595981123456?text=Hola%20%26%20chau");
  });

  it("mapsUrl codifica la dirección", () => {
    expect(mapsUrl(" Av. España 123 ")).toBe("https://www.google.com/maps/search/?api=1&query=Av.%20Espa%C3%B1a%20123");
  });

  it("buildInterestMessage menciona el artículo, el precio y el enlace", () => {
    const msg = buildInterestMessage({ name: "iPhone 12", price: 2500000 }, "TecnoFix", "https://app.test/v/tf/1");
    expect(msg).toContain('Hola TecnoFix!');
    expect(msg).toContain('"iPhone 12"');
    expect(msg).toContain("2.500.000");
    expect(msg.endsWith("https://app.test/v/tf/1")).toBe(true);
  });

  it("buildInterestMessage omite el precio cuando no se muestra", () => {
    const msg = buildInterestMessage({ name: "Funda", price: null }, "TecnoFix");
    expect(msg).toBe('Hola TecnoFix! Vi "Funda" en su vitrina y me interesa.');
  });

  it("buildGeneralMessage nombra el negocio", () => {
    expect(buildGeneralMessage("TecnoFix")).toContain("TecnoFix");
  });
});

describe("accentStyle", () => {
  it("sin color válido no pisa nada", () => {
    expect(accentStyle(null)).toEqual({});
    expect(accentStyle("rojo")).toEqual({});
    expect(accentStyle("#12345")).toEqual({});
  });

  it("define los colores de acento con texto claro sobre fondos oscuros", () => {
    const style = accentStyle("#1F2937") as Record<string, string>;
    expect(style["--primary"]).toMatch(/^\d+ \d+% \d+%$/);
    expect(style["--ring"]).toBe(style["--primary"]);
    expect(style["--primary-foreground"]).toBe("0 0% 100%");
  });

  it("usa texto oscuro sobre fondos claros", () => {
    const style = accentStyle("#FFEB3B") as Record<string, string>;
    expect(style["--primary-foreground"]).toBe("212 52% 11%");
  });
});

describe("cleanSeals", () => {
  it("descarta los vacíos y recorta los textos", () => {
    const out = cleanSeals(
      [
        { icon: "truck", title: "  Envíos  ", subtitle: "  a todo el país " },
        { icon: "star", title: "   " },
      ],
      SEALS_MAX,
    );
    expect(out).toEqual([{ icon: "truck", title: "Envíos", subtitle: "a todo el país" }]);
  });

  it("no guarda subtítulo vacío", () => {
    expect(cleanSeals([{ icon: "star", title: "Garantía", subtitle: "  " }], SEALS_MAX)).toEqual([{ icon: "star", title: "Garantía" }]);
  });

  it("reemplaza un ícono desconocido por el de siempre", () => {
    expect(cleanSeals([{ icon: "bomba", title: "Algo" }], SEALS_MAX)[0].icon).toBe(DEFAULT_SEAL_ICON);
  });

  it("respeta el máximo y los largos que acepta la base", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ icon: "star", title: `Sello ${i}` }));
    expect(cleanSeals(many, 4)).toHaveLength(4);
    const long = cleanSeals([{ icon: "star", title: "t".repeat(90), subtitle: "s".repeat(200) }], SEALS_MAX)[0];
    expect(long.title).toHaveLength(SEAL_TITLE_MAX);
    expect(long.subtitle).toHaveLength(SEAL_SUBTITLE_MAX);
  });
});

describe("cleanIncludes", () => {
  it("saca vacíos, recorta y limita la cantidad", () => {
    expect(cleanIncludes([" Cargador ", "", "  ", "Funda"])).toEqual(["Cargador", "Funda"]);
    expect(cleanIncludes(Array.from({ length: 12 }, (_, i) => `Cosa ${i}`))).toHaveLength(INCLUDES_MAX);
    expect(cleanIncludes(["x".repeat(100)])[0]).toHaveLength(INCLUDE_MAX);
  });
});

describe("normalizeSocialUrl", () => {
  it("vacío es válido y significa sin red", () => {
    expect(normalizeSocialUrl("instagram", "   ")).toEqual({ value: null, error: null });
  });

  it("arma el enlace desde el @usuario en Instagram y TikTok", () => {
    expect(normalizeSocialUrl("instagram", "@tecnofix.py").value).toBe("https://www.instagram.com/tecnofix.py");
    expect(normalizeSocialUrl("instagram", "tecnofix").value).toBe("https://www.instagram.com/tecnofix");
    expect(normalizeSocialUrl("tiktok", "@tecnofix").value).toBe("https://www.tiktok.com/@tecnofix");
  });

  it("acepta el enlace con o sin https y fuerza https", () => {
    expect(normalizeSocialUrl("instagram", "instagram.com/tecnofix").value).toBe("https://instagram.com/tecnofix");
    expect(normalizeSocialUrl("facebook", "http://www.facebook.com/tecnofix").value).toBe("https://www.facebook.com/tecnofix");
    expect(normalizeSocialUrl("youtube", "https://youtu.be/abc123").value).toBe("https://youtu.be/abc123");
  });

  it("rechaza una red que no corresponde al campo", () => {
    expect(normalizeSocialUrl("instagram", "https://facebook.com/tecnofix").error).not.toBeNull();
    expect(normalizeSocialUrl("facebook", "https://instagram.com/tecnofix").error).not.toBeNull();
  });

  it("rechaza dominios que solo imitan a la red", () => {
    expect(normalizeSocialUrl("instagram", "https://instagram.com.evil.com/x").error).not.toBeNull();
    expect(normalizeSocialUrl("instagram", "https://evil.com/instagram.com/x").error).not.toBeNull();
    expect(normalizeSocialUrl("instagram", "https://notinstagram.com/x").error).not.toBeNull();
  });

  it("rechaza esquemas peligrosos, puertos y enlaces sin perfil", () => {
    expect(normalizeSocialUrl("website", "javascript:alert(1)").error).not.toBeNull();
    expect(normalizeSocialUrl("website", "ftp://tienda.com").error).not.toBeNull();
    expect(normalizeSocialUrl("website", "https://tienda.com:8080").error).not.toBeNull();
    expect(normalizeSocialUrl("instagram", "https://instagram.com").error).not.toBeNull();
  });

  it("no deja pasar usuario:clave en el enlace", () => {
    const r = normalizeSocialUrl("instagram", "https://user:pass@instagram.com/tecnofix");
    expect(r.value).toBe("https://instagram.com/tecnofix");
  });

  it("el sitio web pide un dominio con punto y saca la barra final", () => {
    expect(normalizeSocialUrl("website", "mitienda.com.py").value).toBe("https://mitienda.com.py");
    expect(normalizeSocialUrl("website", "https://mitienda.com.py/catalogo?a=1").value).toBe("https://mitienda.com.py/catalogo?a=1");
    expect(normalizeSocialUrl("website", "localhost").error).not.toBeNull();
  });

  it("rechaza un enlace más largo que el máximo", () => {
    const r = normalizeSocialUrl("website", `https://mitienda.com.py/${"a".repeat(SOCIAL_URL_MAX)}`);
    expect(r.value).toBeNull();
    expect(r.error).not.toBeNull();
  });
});

describe("socialLinks", () => {
  it("lista solo las redes cargadas, en orden fijo", () => {
    const links = socialLinks({ ...EMPTY_SOCIALS, website: "https://x.com.py", instagram: "https://instagram.com/x" });
    expect(links.map((l) => l.kind)).toEqual(["instagram", "website"]);
    expect(links[0].label).toBe("Instagram");
  });

  it("sin datos devuelve lista vacía", () => {
    expect(socialLinks(null)).toEqual([]);
    expect(socialLinks(EMPTY_SOCIALS)).toEqual([]);
  });
});

describe("galleryImages", () => {
  it("pone la principal primero y no repite ni deja vacías", () => {
    expect(galleryImages({ image_url: "a", gallery_images: ["b", "a", "c"] })).toEqual(["a", "b", "c"]);
    expect(galleryImages({ image_url: null, gallery_images: ["b"] })).toEqual(["b"]);
    expect(galleryImages({ image_url: null })).toEqual([]);
  });
});

describe("searchPlaceholderOf", () => {
  it("usa el texto propio o el de siempre", () => {
    expect(searchPlaceholderOf({ search_placeholder: "  Buscá tu equipo  " })).toBe("Buscá tu equipo");
    expect(searchPlaceholderOf({ search_placeholder: "   " })).toBe(DEFAULT_SEARCH_PLACEHOLDER);
    expect(searchPlaceholderOf({ search_placeholder: null })).toBe(DEFAULT_SEARCH_PLACEHOLDER);
  });
});
