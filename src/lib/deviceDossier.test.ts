import { describe, expect, it } from "vitest";
import {
  buildDossierEvents,
  buildDossierHtml,
  dossierFinance,
  dossierStatusText,
  warrantyText,
  type DossierDevice,
  type DossierHistory,
} from "@/lib/deviceDossier";

const device: DossierDevice = {
  name: "iPhone 13 128GB",
  imei: "356938035643809",
  battery_health: 87,
  origin: "compra_cliente",
  selling_price: 3_000_000,
  cost_price: 2_200_000,
  purchase_cost: 2_000_000,
  repair_cost: 200_000,
  repair_details: "Pantalla nueva",
  notes: "Con funda <b>y</b> vidrio",
  image_url: null,
  stock: 1,
  created_at: "2026-10-01T12:00:00.000Z",
};

const empty: DossierHistory = { purchases: [], reservations: [], sales: [] };
const NOW = new Date("2026-10-16T12:00:00.000Z");
const base = { businessName: "TecnoFix", branchName: "Casa Central", categoryLabel: "Celulares", now: NOW };

describe("buildDossierEvents", () => {
  it("ordena por fecha e incluye compra, reserva cancelada y venta", () => {
    const events = buildDossierEvents(device, {
      purchases: [{ receipt_number: "CMP-0001", kind: "compra", created_at: "2026-10-01T12:00:05.000Z", purchase_price: 2_000_000 }],
      reservations: [
        {
          receipt_number: "RES-0001", customer_name: "Ana", status: "cancelada", created_at: "2026-10-05T10:00:00.000Z",
          resolved_at: "2026-10-07T10:00:00.000Z", agreed_price: 3_000_000, deposit_amount: 400_000, refunded_amount: 150_000,
          retained_amount: 250_000, expires_on: "2026-10-08",
        },
      ],
      sales: [
        { created_at: "2026-10-10T10:00:00.000Z", quantity: 1, unit_price: 2_900_000, unit_cost: 2_200_000, payment_method: "Efectivo", warranty_days: 30, customer_name: "Luis", reservation_deposit: null },
      ],
    });
    expect(events.map((e) => e.title)).toEqual([
      "Ingresó al catálogo",
      "Comprado a un cliente · CMP-0001",
      "Reservado · RES-0001",
      "Reserva cancelada · RES-0001",
      "Vendido",
    ]);
    expect(events[2].detail).toContain("seña Gs. 400.000");
    expect(events[3].detail).toContain("retenido Gs. 250.000");
    expect(events[4].detail).toContain("30 días de garantía");
    expect(events[4].detail).toContain("a Luis");
  });

  it("un canje dice 'Recibido en canje' y reserva sin seña lo aclara", () => {
    const events = buildDossierEvents(device, {
      purchases: [{ receipt_number: "CMP-0002", kind: "canje", created_at: "2026-10-02T00:00:00.000Z", purchase_price: 1_000_000 }],
      reservations: [
        { receipt_number: "RES-0002", customer_name: "Eva", status: "activa", created_at: "2026-10-03T00:00:00.000Z", resolved_at: null, agreed_price: 3_000_000, deposit_amount: 0, refunded_amount: 0, retained_amount: 0, expires_on: "2026-10-20" },
      ],
      sales: [],
    });
    expect(events.find((e) => e.title.startsWith("Recibido en canje"))?.detail).toBe("Valor reconocido Gs. 1.000.000");
    expect(events.find((e) => e.title.startsWith("Reservado"))?.detail).toContain("sin seña");
  });
});

describe("dossierFinance", () => {
  it("calcula costo, ganancia estimada y margen a precio de lista", () => {
    const f = dossierFinance(device, empty);
    expect(f.totalCost).toBe(2_200_000);
    expect(f.estimatedProfit).toBe(800_000);
    expect(f.estimatedMarginPct).toBe(27);
    expect(f.sold).toBeNull();
  });

  it("con venta usa el precio y costo reales de la venta, no los de lista", () => {
    const f = dossierFinance(device, {
      ...empty,
      sales: [{ created_at: "2026-10-10T10:00:00.000Z", quantity: 1, unit_price: 2_700_000, unit_cost: 2_200_000, payment_method: null, warranty_days: null, customer_name: null, reservation_deposit: null }],
    });
    expect(f.sold).toEqual({ price: 2_700_000, cost: 2_200_000, profit: 500_000, marginPct: 19 });
  });

  it("precio de lista 0 no divide por cero", () => {
    expect(dossierFinance({ ...device, selling_price: 0 }, empty).estimatedMarginPct).toBeNull();
  });
});

describe("dossierStatusText", () => {
  it("en stock muestra los días", () => {
    expect(dossierStatusText(device, empty, NOW)).toBe("En stock · 15 días en stock");
  });

  it("reservado muestra para quién y hasta cuándo", () => {
    const text = dossierStatusText(device, {
      ...empty,
      reservations: [{ receipt_number: "RES-0003", customer_name: "Ana", status: "activa", created_at: "2026-10-15T00:00:00.000Z", resolved_at: null, agreed_price: 1, deposit_amount: 0, refunded_amount: 0, retained_amount: 0, expires_on: "2026-10-19" }],
    }, NOW);
    expect(text).toBe("Reservado para Ana · vence 19/10/2026");
  });

  it("vendido muestra cuánto tardó", () => {
    const text = dossierStatusText({ ...device, stock: 0 }, {
      ...empty,
      sales: [{ created_at: "2026-10-11T12:00:00.000Z", quantity: 1, unit_price: 1, unit_cost: 1, payment_method: null, warranty_days: 30, customer_name: null, reservation_deposit: null }],
    }, NOW);
    expect(text).toContain("tardó 10 días en venderse");
  });

  it("vendido el mismo día que ingresó no dice '0 días'", () => {
    const text = dossierStatusText({ ...device, stock: 0 }, {
      ...empty,
      sales: [{ created_at: "2026-10-01T18:00:00.000Z", quantity: 1, unit_price: 1, unit_cost: 1, payment_method: null, warranty_days: null, customer_name: null, reservation_deposit: null }],
    }, NOW);
    expect(text).toContain("se vendió el mismo día que ingresó");
    expect(text).not.toContain("0 días");
  });

  it("sin stock y sin ventas", () => {
    expect(dossierStatusText({ ...device, stock: 0 }, empty, NOW)).toBe("Sin stock");
  });
});

describe("warrantyText", () => {
  it("distingue sin dato, sin garantía y con días", () => {
    expect(warrantyText(null)).toBe("Sin garantía registrada");
    expect(warrantyText(0)).toBe("Sin garantía");
    expect(warrantyText(1)).toBe("1 día de garantía");
    expect(warrantyText(90)).toBe("90 días de garantía");
  });
});

describe("buildDossierHtml", () => {
  it("la ficha del cliente muestra precio, IMEI y batería, y nunca costos, origen, notas ni historial", () => {
    const html = buildDossierHtml({ ...device, min_price: 2_777_777 } as DossierDevice, empty, { ...base, variant: "cliente" });
    expect(html).toContain("Gs. 3.000.000");
    expect(html).toContain("356938035643809");
    expect(html).toContain("87%");
    for (const secret of ["2.200.000", "2.000.000", "200.000", "Comprado a cliente", "Pantalla nueva", "Con funda", "2.777.777", "Historial", "Uso interno", "Ganancia"]) {
      expect(html).not.toContain(secret);
    }
  });

  it("el dossier interno muestra costos, ganancia, origen e historial, pero nunca el mínimo", () => {
    const html = buildDossierHtml({ ...device, min_price: 2_777_777 } as DossierDevice, empty, { ...base, variant: "interno" });
    expect(html).toContain("Uso interno");
    expect(html).toContain("Gs. 2.200.000");
    expect(html).toContain("Gs. 800.000");
    expect(html).toContain("Comprado a cliente");
    expect(html).toContain("Pantalla nueva");
    expect(html).toContain("Ingresó al catálogo");
    expect(html).not.toContain("2.777.777");
    expect(html).not.toContain("2777777");
  });

  it("escapa el HTML de los textos libres", () => {
    const html = buildDossierHtml({ ...device, name: "<script>x</script>" }, empty, { ...base, variant: "interno" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).toContain("Con funda &lt;b&gt;y&lt;/b&gt; vidrio");
  });

  it("incluye la foto solo si hay image_url y omite filas vacías", () => {
    const sinFoto = buildDossierHtml({ ...device, imei: null, battery_health: null }, empty, { ...base, variant: "cliente" });
    expect(sinFoto).not.toContain("<img");
    expect(sinFoto).not.toContain("IMEI");
    expect(sinFoto).not.toContain("Batería");
    const conFoto = buildDossierHtml({ ...device, image_url: "https://x.test/a.jpg" }, empty, { ...base, variant: "cliente" });
    expect(conFoto).toContain('<img src="https://x.test/a.jpg"');
  });
});
