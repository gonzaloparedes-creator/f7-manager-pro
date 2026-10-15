import { describe, expect, it } from "vitest";
import { emptyDevicePurchaseForm, buildDevicePurchaseParams } from "./devicePurchase";
import {
  amountToCollect,
  buildTradeInSaleParams,
  netSaleAmount,
  tradeInOfSale,
  validateTradeInValue,
} from "./tradeIn";

describe("amountToCollect", () => {
  it("resta el canje del total de la venta", () => {
    expect(amountToCollect(3000000, 1200000)).toBe(1800000);
  });
  it("nunca queda negativo", () => {
    expect(amountToCollect(1000000, 1000000)).toBe(0);
    expect(amountToCollect(1000000, 1500000)).toBe(0);
  });
});

describe("validateTradeInValue", () => {
  it("acepta un valor entre 1 y el total", () => {
    expect(validateTradeInValue(500000, 3000000)).toBeNull();
    expect(validateTradeInValue(3000000, 3000000)).toBeNull();
  });
  it("rechaza cero y más que el total", () => {
    expect(validateTradeInValue(0, 3000000)).toMatch(/reconocés/);
    expect(validateTradeInValue(3000001, 3000000)).toMatch(/vale más que la venta/);
  });
});

describe("netSaleAmount", () => {
  it("es lo cobrado: precio por cantidad menos el canje", () => {
    expect(netSaleAmount({ quantity: 2, unit_price: 1000000, trade_in_value: 500000 })).toBe(1500000);
  });
  it("sin canje es el precio completo", () => {
    expect(netSaleAmount({ quantity: 1, unit_price: "250000" })).toBe(250000);
    expect(netSaleAmount({ quantity: 1, unit_price: 250000, trade_in_value: null })).toBe(250000);
  });
  it("la suma de varias líneas da el neto aunque la primera quede en negativo", () => {
    const rows = [
      { quantity: 1, unit_price: 100000, trade_in_value: 500000 },
      { quantity: 1, unit_price: 800000, trade_in_value: 0 },
    ];
    expect(rows.reduce((s, r) => s + netSaleAmount(r), 0)).toBe(400000);
  });
});

describe("tradeInOfSale", () => {
  it("suma el canje de todas las líneas de la venta", () => {
    expect(tradeInOfSale([{ trade_in_value: 500000 }, { trade_in_value: 0 }, {}])).toBe(500000);
  });
});

describe("buildTradeInSaleParams", () => {
  it("arma los parámetros de la RPC con la sucursal del equipo vacía", () => {
    const form = {
      ...emptyDevicePurchaseForm("branch-1"),
      device_name: "iPhone 11",
      imei: "356938035643809",
      seller_name: "Ana",
      seller_cedula: "1.234.567",
      purchase_price: "500.000",
    };
    const params = buildTradeInSaleParams({
      saleGroupId: "grp-1",
      paymentMethod: "Efectivo",
      lines: [{ inventory_item_id: "item-1", quantity: 1, unit_price: 3000000 }],
      draft: { form, params: buildDevicePurchaseParams(form, []) },
    });
    expect(params.sale_group_id).toBe("grp-1");
    expect(params.payment_method).toBe("Efectivo");
    expect(params.items).toEqual([{ inventory_item_id: "item-1", quantity: 1, unit_price: 3000000 }]);
    expect(params.trade_in.purchase_price).toBe(500000);
    expect(params.trade_in.branch_id).toBeNull();
    expect(params.warranty_days).toBeNull();
    expect(params.customer_name).toBeNull();
    expect(params.customer_phone).toBeNull();
  });

  it("incluye la garantía y los datos del comprador cuando se piden", () => {
    const form = {
      ...emptyDevicePurchaseForm("branch-1"),
      device_name: "iPhone 11",
      imei: "356938035643809",
      seller_name: "Ana",
      seller_cedula: "1.234.567",
      purchase_price: "500.000",
    };
    const params = buildTradeInSaleParams({
      saleGroupId: "grp-1",
      paymentMethod: "Efectivo",
      lines: [{ inventory_item_id: "item-1", quantity: 1, unit_price: 3000000 }],
      draft: { form, params: buildDevicePurchaseParams(form, []) },
      warranty: { warranty_days: 90, customer_name: "Luis", customer_phone: "0981 123 456" },
    });
    expect(params.warranty_days).toBe(90);
    expect(params.customer_name).toBe("Luis");
    expect(params.customer_phone).toBe("0981 123 456");
  });
});
