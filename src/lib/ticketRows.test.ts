import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CURRENCY, setActiveCurrency } from "./currency";
import { buildTicketRows, minRowGap, rowFits, wrapTextToWidth, type TicketRow } from "./ticketRows";

afterEach(() => setActiveCurrency(DEFAULT_CURRENCY));

// La venta del ticket "#3A2233" que le salió encimado al cliente (papel de 58 mm).
const clientSale = {
  id: "5b1c9e20-7d44-4f1a-9a3e-9d0c0b3a2233",
  created_at: "2026-11-16T14:41:00.000Z",
  payment_method: "Efectivo",
  items: [
    { product_name: "Glass 5d A07", quantity: 1, unit_price: 18000 },
    { product_name: "Estuche Samsung A07", quantity: 1, unit_price: 12000 },
    { product_name: "Estuche Note 13 pro", quantity: 1, unit_price: 12000 },
    { product_name: "Glass 5d Redmi Note 13", quantity: 1, unit_price: 18000 },
  ],
};

const pairs = (rows: TicketRow[]) =>
  rows.flatMap((r) => (r.kind === "pair" ? [[r.left, r.right] as const] : []));
const texts = (rows: TicketRow[]) => rows.flatMap((r) => (r.kind === "text" ? [r.text] : []));

describe("buildTicketRows: encabezado", () => {
  it("el número de ticket va arriba y la fecha con la hora abajo, cada uno en su línea", () => {
    const rows = buildTicketRows(clientSale, "Servi Smart", "Central");
    const ticketAt = rows.findIndex((r) => r.kind === "text" && r.text.startsWith("Ticket #"));
    expect(ticketAt).toBeGreaterThan(-1);
    expect(rows[ticketAt]).toMatchObject({ kind: "text", text: "Ticket #3A2233" });
    const date = rows[ticketAt + 1];
    expect(date.kind).toBe("text");
    expect((date as { text: string }).text).toMatch(/^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  it("el número y la fecha ya no comparten fila (juntos se pisaban en 58 mm)", () => {
    const rows = buildTicketRows(clientSale, "Servi Smart");
    expect(pairs(rows).some(([l]) => l.startsWith("Ticket"))).toBe(false);
  });

  it("muestra negocio, sucursal y el título; sin sucursal no deja una línea vacía", () => {
    const withBranch = buildTicketRows(clientSale, "Servi Smart", "Central");
    expect(withBranch.slice(0, 3)).toEqual([
      { kind: "center", text: "Servi Smart", size: "header" },
      { kind: "center", text: "Central", size: "small" },
      { kind: "center", text: "Comprobante de venta", size: "small" },
    ]);
    const noBranch = buildTicketRows(clientSale, "Servi Smart", null);
    expect(noBranch.slice(0, 2)).toEqual([
      { kind: "center", text: "Servi Smart", size: "header" },
      { kind: "center", text: "Comprobante de venta", size: "small" },
    ]);
  });

  it("el nombre del cliente sale solo si hay, sin espacios de más", () => {
    expect(texts(buildTicketRows(clientSale, "X")).some((t) => t.startsWith("Cliente"))).toBe(false);
    expect(texts(buildTicketRows({ ...clientSale, customer_name: "  Ana Gómez " }, "X"))).toContain("Cliente: Ana Gómez");
    expect(texts(buildTicketRows({ ...clientSale, customer_name: "   " }, "X")).some((t) => t.startsWith("Cliente"))).toBe(false);
  });
});

describe("buildTicketRows: productos", () => {
  it("las líneas llevan cantidad x precio y el importe, SIN el símbolo de la moneda", () => {
    const rows = buildTicketRows(clientSale, "Servi Smart");
    const itemPairs = pairs(rows).filter(([l]) => /^\d+ x /.test(l));
    expect(itemPairs).toEqual([
      ["1 x 18.000", "18.000"],
      ["1 x 12.000", "12.000"],
      ["1 x 12.000", "12.000"],
      ["1 x 18.000", "18.000"],
    ]);
    for (const [l, r] of itemPairs) {
      expect(l).not.toContain("Gs");
      expect(r).not.toContain("Gs");
    }
  });

  it("multiplica la cantidad para el importe de la línea", () => {
    const rows = buildTicketRows({ ...clientSale, items: [{ product_name: "Cable USB", quantity: 3, unit_price: 15000 }] }, "X");
    expect(pairs(rows)).toContainEqual(["3 x 15.000", "45.000"]);
  });

  it("el nombre del producto va en su propia fila, antes de los importes", () => {
    const rows = buildTicketRows(clientSale, "Servi Smart");
    const nameAt = rows.findIndex((r) => r.kind === "text" && r.text === "Glass 5d A07");
    expect(rows[nameAt + 1]).toMatchObject({ kind: "pair", left: "1 x 18.000" });
  });

  it("la moneda de la empresa aparece una sola vez, en el total", () => {
    setActiveCurrency("USD");
    const rows = buildTicketRows({ ...clientSale, items: [{ product_name: "Funda", quantity: 2, unit_price: 15 }] }, "X");
    expect(pairs(rows)).toContainEqual(["2 x 15", "30"]);
    expect(pairs(rows)).toContainEqual(["TOTAL", "US$ 30"]);
  });

  it("IMEI y garantía van debajo del nombre y piden conservar el ticket", () => {
    const rows = buildTicketRows(
      { ...clientSale, items: [{ product_name: "iPhone 14", quantity: 1, unit_price: 3000000, imei: "356938035643809", warranty_days: 30 }] },
      "X"
    );
    const t = texts(rows);
    expect(t).toContain("IMEI 356938035643809");
    expect(t.some((x) => x.startsWith("Garantía: 30 días"))).toBe(true);
    expect(t).toContain("Conserve este ticket: es su comprobante de garantía.");
  });

  it("sin garantía no pide conservar el ticket", () => {
    const t = texts(buildTicketRows(clientSale, "X"));
    expect(t).not.toContain("Conserve este ticket: es su comprobante de garantía.");
  });
});

// La misma venta, tal como se guarda hoy: cobrado (con el 40 % repartido) y precio de antes.
const clientSaleWithDiscount = {
  ...clientSale,
  items: [
    { product_name: "Glass 5d A07", quantity: 1, unit_price: 18000, unit_price_before_discount: 30000 },
    { product_name: "Estuche Samsung A07", quantity: 1, unit_price: 12000, unit_price_before_discount: 20000 },
    { product_name: "Estuche Note 13 pro", quantity: 1, unit_price: 12000, unit_price_before_discount: 20000 },
    { product_name: "Glass 5d Redmi Note 13", quantity: 1, unit_price: 18000, unit_price_before_discount: 30000 },
  ],
};

describe("buildTicketRows: venta con descuento", () => {
  it("las líneas salen a precio de lista, el que el dueño ve en el catálogo", () => {
    const itemPairs = pairs(buildTicketRows(clientSaleWithDiscount, "Servi Smart")).filter(([l]) => /^\d+ x /.test(l));
    expect(itemPairs).toEqual([
      ["1 x 30.000", "30.000"],
      ["1 x 20.000", "20.000"],
      ["1 x 20.000", "20.000"],
      ["1 x 30.000", "30.000"],
    ]);
  });

  it("muestra subtotal a lista, descuento aparte y el total que se cobró", () => {
    const p = pairs(buildTicketRows(clientSaleWithDiscount, "Servi Smart"));
    const labels = p.map(([l]) => l);
    expect(p).toContainEqual(["Subtotal", "Gs. 100.000"]);
    expect(p).toContainEqual(["Descuento", "-Gs. 40.000"]);
    expect(p).toContainEqual(["TOTAL", "Gs. 60.000"]);
    // en orden: subtotal, descuento, total
    expect(labels.indexOf("Subtotal")).toBeLessThan(labels.indexOf("Descuento"));
    expect(labels.indexOf("Descuento")).toBeLessThan(labels.indexOf("TOTAL"));
  });

  it("una venta sin el precio de antes sale como siempre: sin subtotal ni descuento", () => {
    const p = pairs(buildTicketRows(clientSale, "Servi Smart"));
    expect(p.some(([l]) => l === "Subtotal" || l === "Descuento")).toBe(false);
    expect(p).toContainEqual(["TOTAL", "Gs. 60.000"]);
  });

  it("un precio de antes igual o menor al cobrado no inventa un descuento", () => {
    const sale = { ...clientSale, items: [{ product_name: "Cable", quantity: 1, unit_price: 15000, unit_price_before_discount: 15000 }] };
    const p = pairs(buildTicketRows(sale, "X"));
    expect(p.some(([l]) => l === "Descuento")).toBe(false);
    expect(p).toContainEqual(["TOTAL", "Gs. 15.000"]);
  });

  it("con descuento y canje: subtotal a lista, descuento, canje y lo que se paga", () => {
    const sale = {
      ...clientSale,
      items: [{ product_name: "iPhone 14", quantity: 1, unit_price: 2700000, unit_price_before_discount: 3000000 }],
      trade_in: { device_name: "iPhone 11", value: 1200000 },
    };
    const rows = buildTicketRows(sale, "X");
    const p = pairs(rows);
    expect(p).toEqual(
      expect.arrayContaining([
        ["1 x 3.000.000", "3.000.000"],
        ["Subtotal", "Gs. 3.000.000"],
        ["Descuento", "-Gs. 300.000"],
        ["Canje", "-Gs. 1.200.000"],
        ["A PAGAR", "Gs. 1.500.000"],
      ])
    );
    expect(p.some(([l]) => l === "TOTAL")).toBe(false);
  });

  it("con descuento y seña de reserva: lo que se paga es lo cobrado menos la seña", () => {
    const sale = { ...clientSaleWithDiscount, deposit: 10000 };
    const p = pairs(buildTicketRows(sale, "X"));
    expect(p).toEqual(
      expect.arrayContaining([
        ["Subtotal", "Gs. 100.000"],
        ["Descuento", "-Gs. 40.000"],
        ["Seña abonada", "-Gs. 10.000"],
        ["A PAGAR", "Gs. 50.000"],
      ])
    );
  });

  it("lista menos descuento menos lo demás siempre da lo que se paga", () => {
    const sale = { ...clientSaleWithDiscount, deposit: 10000, trade_in: { device_name: "X", value: 5000 } };
    const p = Object.fromEntries(pairs(buildTicketRows(sale, "X")).map(([l, r]) => [l, Number(r.replace(/[^\d]/g, ""))]));
    expect(p["Subtotal"] - p["Descuento"] - p["Canje"] - p["Seña abonada"]).toBe(p["A PAGAR"]);
  });
});

describe("buildTicketRows: totales", () => {
  it("la venta del cliente suma 60.000 y paga en efectivo", () => {
    const rows = buildTicketRows(clientSale, "Servi Smart");
    expect(pairs(rows)).toContainEqual(["TOTAL", "Gs. 60.000"]);
    expect(pairs(rows)).toContainEqual(["Pago", "Efectivo"]);
    expect(pairs(rows).some(([l]) => l === "Subtotal")).toBe(false);
  });

  it("sin medio de pago muestra una raya", () => {
    expect(pairs(buildTicketRows({ ...clientSale, payment_method: null }, "X"))).toContainEqual(["Pago", "—"]);
  });

  it("con canje y seña muestra subtotal, descuentos y lo que se paga", () => {
    const rows = buildTicketRows(
      {
        ...clientSale,
        items: [{ product_name: "iPhone 14", quantity: 1, unit_price: 3000000 }],
        deposit: 500000,
        trade_in: { device_name: "iPhone 11", value: 1200000 },
      },
      "X"
    );
    expect(pairs(rows)).toEqual(
      expect.arrayContaining([
        ["Subtotal", "Gs. 3.000.000"],
        ["Canje", "-Gs. 1.200.000"],
        ["Seña abonada", "-Gs. 500.000"],
        ["A PAGAR", "Gs. 1.300.000"],
      ])
    );
    expect(texts(rows)).toContain("Equipo recibido: iPhone 11");
    expect(pairs(rows).some(([l]) => l === "TOTAL")).toBe(false);
  });

  it("lo que se paga nunca es negativo", () => {
    const rows = buildTicketRows(
      { ...clientSale, items: [{ product_name: "X", quantity: 1, unit_price: 100 }], deposit: 500 },
      "X"
    );
    expect(pairs(rows)).toContainEqual(["A PAGAR", "Gs. 0"]);
  });
});

// Una letra "mide" 10, como una fuente monoespaciada: 24 letras = 240.
const medir = (t: string) => t.length * 10;

describe("wrapTextToWidth", () => {
  it("un texto que entra queda en una sola línea", () => {
    expect(wrapTextToWidth(medir, "Glass 5d A07", 240)).toEqual(["Glass 5d A07"]);
  });

  it("no pierde la última línea: el '13' de 'Glass 5d Redmi Note 13' (antes salía 'Glass 5d Redmi Note')", () => {
    // 22 letras en un papel donde entran 20.
    expect(wrapTextToWidth(medir, "Glass 5d Redmi Note 13", 200)).toEqual(["Glass 5d Redmi Note", "13"]);
  });

  it("no pierde la fecha de vencimiento de la garantía (antes salía solo 'Garantía: 90 días')", () => {
    const lines = wrapTextToWidth(medir, "Garantía: 90 días (hasta 16/02/2027)", 200);
    expect(lines.join(" ")).toBe("Garantía: 90 días (hasta 16/02/2027)");
    expect(lines.every((l) => medir(l) <= 200)).toBe(true);
  });

  it("junta las líneas partidas y recupera exactamente el texto original", () => {
    const original = "Cliente: Maria de los Angeles Benitez Gimenez";
    for (const ancho of [120, 160, 200, 240, 330]) {
      const lines = wrapTextToWidth(medir, original, ancho);
      expect(lines.join(" ")).toBe(original);
      expect(lines.every((l) => medir(l) <= ancho)).toBe(true);
    }
  });

  it("parte en varias líneas si hace falta, sin perder ninguna", () => {
    expect(wrapTextToWidth(medir, "uno dos tres cuatro cinco seis", 100)).toEqual(["uno dos", "tres", "cuatro", "cinco seis"]);
  });

  it("una palabra más ancha que el papel se corta por letras en vez de salirse", () => {
    const lines = wrapTextToWidth(medir, "ABCDEFGHIJKLMNOP", 60);
    expect(lines).toEqual(["ABCDEF", "GHIJKL", "MNOP"]);
    expect(lines.join("")).toBe("ABCDEFGHIJKLMNOP");
  });

  it("la palabra larga convive con las de al lado", () => {
    const lines = wrapTextToWidth(medir, "IMEI 356938035643809 ok", 100);
    expect(lines.join(" ").replace(/ /g, "")).toBe("IMEI356938035643809ok");
    expect(lines.every((l) => medir(l) <= 100)).toBe(true);
  });

  it("espacios de más, vacío o solo espacios: nunca falla y devuelve una línea", () => {
    expect(wrapTextToWidth(medir, "  Glass   5d  ", 240)).toEqual(["Glass 5d"]);
    expect(wrapTextToWidth(medir, "", 240)).toEqual([""]);
    expect(wrapTextToWidth(medir, "    ", 240)).toEqual([""]);
  });

  it("justo en el límite entra; una letra más ya se parte", () => {
    expect(wrapTextToWidth(medir, "12345 12345", 110)).toEqual(["12345 12345"]);
    expect(wrapTextToWidth(medir, "12345 12345", 109)).toEqual(["12345", "12345"]);
  });
});

describe("rowFits / minRowGap", () => {
  it("entra cuando los dos textos y el espacio mínimo caben en la línea", () => {
    expect(rowFits(100, 100, 336, 24)).toBe(true);
    expect(rowFits(150, 150, 336, 24)).toBe(true);
  });

  it("no entra cuando se tocarían: es lo que hacía que el ticket saliera encimado", () => {
    // "Ticket #3A2233" + la fecha, en 58 mm: unos 185 px cada uno sobre 336 px útiles.
    expect(rowFits(185, 185, 336, 24)).toBe(false);
    // "1 x Gs. 18.000" + "Gs. 18.000" con la fuente del cuerpo: 200 + 143 px.
    expect(rowFits(200, 143, 336, 26)).toBe(false);
  });

  it("justo en el límite entra; un píxel más no", () => {
    const gap = minRowGap(24);
    expect(rowFits(200, 336 - 200 - gap, 336, 24)).toBe(true);
    expect(rowFits(200, 336 - 200 - gap + 1, 336, 24)).toBe(false);
  });

  it("el espacio mínimo crece con la letra y es de más o menos un carácter", () => {
    expect(minRowGap(24)).toBeGreaterThan(0);
    expect(minRowGap(30)).toBeGreaterThan(minRowGap(24));
  });
});
