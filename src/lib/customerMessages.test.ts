import { describe, expect, it } from "vitest";
import {
  buildBatchCreatedMessage,
  buildOrderMessageVars,
  equipmentLabel,
  getPreviewVars,
  renderMessage,
  resolveStatusBody,
  type OrderMessageSource,
} from "./customerMessages";

const baseOrder: OrderMessageSource = {
  customer_name: "Juan Pérez",
  customer_phone: "0975153380",
  device_type: "Celular",
  order_number: "ORD-0001",
  tracking_token: "tok123",
};

describe("equipmentLabel", () => {
  it("suma marca y modelo al tipo de equipo", () => {
    expect(equipmentLabel({ device_type: "Celular", marca: "Samsung", modelo: "Galaxy S23" })).toBe(
      "Celular Samsung Galaxy S23"
    );
  });

  it("sin marca ni modelo queda solo el tipo (órdenes viejas)", () => {
    expect(equipmentLabel({ device_type: "Celular" })).toBe("Celular");
    expect(equipmentLabel({ device_type: "Celular", marca: null, modelo: null })).toBe("Celular");
    expect(equipmentLabel({ device_type: "Celular", marca: "  ", modelo: "" })).toBe("Celular");
  });

  it("solo marca o solo modelo", () => {
    expect(equipmentLabel({ device_type: "Notebook", marca: "Lenovo" })).toBe("Notebook Lenovo");
    expect(equipmentLabel({ device_type: "Celular", modelo: "iPhone 12" })).toBe("Celular iPhone 12");
  });

  it("no repite la marca cuando el modelo ya empieza con ella", () => {
    expect(equipmentLabel({ device_type: "Celular", marca: "Samsung", modelo: "samsung Galaxy A15" })).toBe(
      "Celular samsung Galaxy A15"
    );
    expect(equipmentLabel({ device_type: "Celular", marca: "Apple", modelo: "iPhone 12" })).toBe(
      "Celular Apple iPhone 12"
    );
  });

  it("limpia espacios sobrantes", () => {
    expect(equipmentLabel({ device_type: " Celular ", marca: " Xiaomi ", modelo: " Redmi Note 12 " })).toBe(
      "Celular Xiaomi Redmi Note 12"
    );
  });
});

describe("mensaje de 'listo para retirar'", () => {
  const listo = resolveStatusBody("listo", []);

  it("dice el modelo del equipo, para distinguir cuando el cliente dejó varios", () => {
    const a = renderMessage(
      listo,
      buildOrderMessageVars(
        { ...baseOrder, marca: "Samsung", modelo: "Galaxy S23" },
        { taller: "Taller", estado: "Listo para retirar" }
      )
    );
    const b = renderMessage(
      listo,
      buildOrderMessageVars(
        { ...baseOrder, order_number: "ORD-0002", marca: "Apple", modelo: "iPhone 12" },
        { taller: "Taller", estado: "Listo para retirar" }
      )
    );
    expect(a).toContain("Tu Celular Samsung Galaxy S23 ya está listo para retirar");
    expect(b).toContain("Tu Celular Apple iPhone 12 ya está listo para retirar");
    expect(a).not.toBe(b);
  });

  it("una orden sin marca ni modelo sigue diciendo solo el tipo", () => {
    const msg = renderMessage(listo, buildOrderMessageVars(baseOrder, { taller: "Taller" }));
    expect(msg).toContain("Tu Celular ya está listo para retirar");
  });

  it("una plantilla personalizada con {{equipo}} también incluye el modelo", () => {
    const custom = "Hola {{cliente}}, tu {{equipo}} está listo ({{orden}})";
    const msg = renderMessage(
      custom,
      buildOrderMessageVars({ ...baseOrder, marca: "Motorola", modelo: "G54" }, { taller: "T" })
    );
    expect(msg).toBe("Hola Juan Pérez, tu Celular Motorola G54 está listo (ORD-0001)");
  });
});

describe("mensaje de lote", () => {
  it("lista cada equipo con su modelo", () => {
    const msg = buildBatchCreatedMessage(
      [
        { device_type: "Celular", marca: "Samsung", modelo: "A15", order_number: "ORD-0001", tracking_token: "t1" },
        { device_type: "Celular", order_number: "ORD-0002", tracking_token: "t2" },
      ],
      { cliente: "Juan", taller: "Taller" }
    );
    expect(msg).toContain("• Celular Samsung A15 — *ORD-0001*");
    expect(msg).toContain("• Celular — *ORD-0002*");
  });
});

describe("vista previa de variables", () => {
  it("el ejemplo de {{equipo}} muestra que incluye el modelo", () => {
    expect(getPreviewVars().equipo).toBe("Celular Samsung Galaxy S23");
  });
});
