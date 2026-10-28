import { describe, expect, it } from "vitest";
import { parseRich, stripRich } from "./parseRich";

describe("parseRich", () => {
  it("un texto sin marcas es un solo trozo", () => {
    expect(parseRich("Hola mundo")).toEqual([{ kind: "text", text: "Hola mundo" }]);
  });

  it("separa el acento de color", () => {
    expect(parseRich("¿Cansado del caos de [[libretas y WhatsApp]]?")).toEqual([
      { kind: "text", text: "¿Cansado del caos de " },
      { kind: "accent", text: "libretas y WhatsApp" },
      { kind: "text", text: "?" },
    ]);
  });

  it("separa el destacado", () => {
    expect(parseRich("Usalo **7 días** en tu taller.")).toEqual([
      { kind: "text", text: "Usalo " },
      { kind: "strong", text: "7 días" },
      { kind: "text", text: " en tu taller." },
    ]);
  });

  it("acepta varios destacados y los dos tipos mezclados", () => {
    const parts = parseRich("**uno** y [[dos]] y **tres**");
    expect(parts.map((p) => p.kind)).toEqual(["strong", "text", "accent", "text", "strong"]);
  });

  it("el salto de línea es un <br>", () => {
    expect(parseRich("a\nb")).toEqual([{ kind: "text", text: "a" }, { kind: "br" }, { kind: "text", text: "b" }]);
  });

  it("un marcador sin su par queda como texto, no rompe", () => {
    expect(parseRich("5 ** 3 y [[sin cerrar")).toEqual([{ kind: "text", text: "5 ** 3 y [[sin cerrar" }]);
  });

  it("no pierde ni inventa texto", () => {
    const text = "Si en 7 días no te sirve, [[te devolvemos todo tu dinero]]. **Sin vueltas**.";
    expect(stripRich(text)).toBe("Si en 7 días no te sirve, te devolvemos todo tu dinero. Sin vueltas.");
  });
});

describe("stripRich", () => {
  it("deja el texto limpio para el título de la pestaña", () => {
    expect(stripRich("F7 Manager Pro")).toBe("F7 Manager Pro");
    expect(stripRich("Precios para [[talleres]]")).toBe("Precios para talleres");
  });
});
