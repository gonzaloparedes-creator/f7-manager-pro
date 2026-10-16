import { describe, expect, it } from "vitest";
import { findByBarcode, isDuplicateBarcodeError, matchesBarcodeQuery, parseBarcode } from "@/lib/barcode";
import {
  barcodeSvgMarkup,
  buildLabelsHtml,
  clampCopies,
  isReadableOnLabel,
  labelPriceText,
  moduleWidthMm,
} from "@/lib/barcodeLabels";

describe("parseBarcode", () => {
  it("vacío o solo espacios = sin código, sin error", () => {
    expect(parseBarcode("")).toEqual({ value: null, error: null });
    expect(parseBarcode("   ")).toEqual({ value: null, error: null });
    expect(parseBarcode(null)).toEqual({ value: null, error: null });
  });

  it("recorta los espacios que a veces deja un lector", () => {
    expect(parseBarcode(" 7891234567890 ").value).toBe("7891234567890");
  });

  it("acepta letras, números y símbolos comunes", () => {
    expect(parseBarcode("ABC-123_x.9").error).toBeNull();
  });

  it("rechaza espacios internos, tildes y ñ", () => {
    expect(parseBarcode("AB 12").error).not.toBeNull();
    expect(parseBarcode("Cañón1").error).not.toBeNull();
  });

  it("rechaza más de 64 caracteres", () => {
    expect(parseBarcode("1".repeat(64)).error).toBeNull();
    expect(parseBarcode("1".repeat(65)).error).not.toBeNull();
  });
});

describe("findByBarcode / matchesBarcodeQuery", () => {
  const items = [
    { id: "a", barcode: "2000000001" },
    { id: "b", barcode: "7891234567890" },
    { id: "c", barcode: null },
    { id: "d" },
  ];

  it("encuentra solo por coincidencia exacta", () => {
    expect(findByBarcode(items, "7891234567890")?.id).toBe("b");
    expect(findByBarcode(items, "  2000000001\n")?.id).toBe("a");
    expect(findByBarcode(items, "789123")).toBeNull();
    expect(findByBarcode(items, "")).toBeNull();
  });

  it("tolera mayúsculas cambiadas por el lector, salvo que sea ambiguo", () => {
    const withLetters = [
      { id: "x", barcode: "ABC-123" },
      { id: "y", barcode: "Zed-9" },
      { id: "z", barcode: "zed-9" },
    ];
    expect(findByBarcode(withLetters, "abc-123")?.id).toBe("x");
    expect(findByBarcode(withLetters, "zed-9")?.id).toBe("z");
    expect(findByBarcode(withLetters, "Zed-9")?.id).toBe("y");
    expect(findByBarcode(withLetters, "ZED-9")).toBeNull();
  });

  it("el buscador acepta parcial solo desde 5 caracteres", () => {
    expect(matchesBarcodeQuery(items[1], "7891234567890")).toBe(true);
    expect(matchesBarcodeQuery(items[1], "67890")).toBe(true);
    expect(matchesBarcodeQuery(items[1], "890")).toBe(false);
    expect(matchesBarcodeQuery(items[0], "12")).toBe(false);
  });

  it("sin código nunca coincide", () => {
    expect(matchesBarcodeQuery(items[2], "12345")).toBe(false);
    expect(matchesBarcodeQuery(items[3], "12345")).toBe(false);
  });
});

describe("isDuplicateBarcodeError", () => {
  it("solo reconoce la violación del índice de código de barras", () => {
    expect(
      isDuplicateBarcodeError({ code: "23505", message: 'duplicate key value violates unique constraint "inventory_items_company_barcode_unique"' }),
    ).toBe(true);
    expect(isDuplicateBarcodeError({ code: "23505", message: "duplicate key ... imei" })).toBe(false);
    expect(isDuplicateBarcodeError(null)).toBe(false);
  });
});

describe("clampCopies / labelPriceText", () => {
  it("copias entre 1 y 200", () => {
    expect(clampCopies("")).toBe(1);
    expect(clampCopies("abc")).toBe(1);
    expect(clampCopies(0)).toBe(1);
    expect(clampCopies("5")).toBe(5);
    expect(clampCopies(5.9)).toBe(5);
    expect(clampCopies(999)).toBe(200);
  });

  it("el precio sale solo si se pidió y es mayor a cero", () => {
    expect(labelPriceText(150000, true)).toBe("Gs. 150.000");
    expect(labelPriceText(150000, false)).toBeNull();
    expect(labelPriceText(0, true)).toBeNull();
    expect(labelPriceText(null, true)).toBeNull();
  });
});

describe("legibilidad en 60 mm", () => {
  it("un código propio de 10 dígitos entra holgado y uno muy largo no", () => {
    expect(isReadableOnLabel(110)).toBe(true);
    expect(isReadableOnLabel(500)).toBe(false);
    expect(moduleWidthMm(0)).toBe(0);
  });
});

describe("buildLabelsHtml", () => {
  const bars = '<svg viewBox="0 0 110 60"><rect/></svg>';

  it("repite una etiqueta por copia y tamaño de página 60x40", () => {
    const html = buildLabelsHtml({ name: "Funda", barcode: "2000000001", price: 50000 }, bars, { copies: 3, showPrice: true });
    expect((html.match(/<section class="label">/g) ?? []).length).toBe(3);
    expect((html.match(/<svg/g) ?? []).length).toBe(3);
    expect(html).toContain("@page { size: 60mm 40mm; margin: 0; }");
    expect(html).toContain("Gs. 50.000");
  });

  it("escapa el nombre y el código (vienen de un campo libre)", () => {
    const html = buildLabelsHtml({ name: '<img src=x onerror="alert(1)">', barcode: "A<B>&C", price: 0 }, bars, {
      copies: 1,
      showPrice: true,
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("A&lt;B&gt;&amp;C");
  });

  it("sin precio cuando se desactiva o es cero", () => {
    const off = buildLabelsHtml({ name: "X", barcode: "1", price: 9000 }, bars, { copies: 1, showPrice: false });
    const zero = buildLabelsHtml({ name: "X", barcode: "1", price: 0 }, bars, { copies: 1, showPrice: true });
    expect(off).not.toContain('class="price">');
    expect(zero).not.toContain('class="price">');
  });

  it("limita las copias a 200", () => {
    const html = buildLabelsHtml({ name: "X", barcode: "1" }, bars, { copies: 5000, showPrice: false });
    expect((html.match(/<section class="label">/g) ?? []).length).toBe(200);
  });
});

describe("barcodeSvgMarkup", () => {
  it("dibuja barras Code128 sin texto y devuelve los módulos", async () => {
    const { markup, modules } = await barcodeSvgMarkup("2000000001");
    expect(markup).toContain("<svg");
    expect(markup).toContain("<rect");
    expect(markup).not.toContain("<text");
    expect(markup).toContain('preserveAspectRatio="none"');
    expect(modules).toBeGreaterThan(80);
    expect(isReadableOnLabel(modules)).toBe(true);
  });

  it("un código largo avisa que no se lee bien en 60 mm", async () => {
    const { modules } = await barcodeSvgMarkup("ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-ABCDEFGHIJKLMNOP");
    expect(isReadableOnLabel(modules)).toBe(false);
  });
});
