import { afterEach, describe, expect, it, vi } from "vitest";
import { trackMeta } from "./metaPixel";

type WithFbq = { fbq?: unknown };

afterEach(() => {
  delete (window as unknown as WithFbq).fbq;
});

describe("trackMeta", () => {
  it("no hace nada ni falla si el Pixel no está cargado", () => {
    expect(() => trackMeta("Contact")).not.toThrow();
  });

  it("llama al Pixel con el evento y los parámetros", () => {
    const fbq = vi.fn();
    (window as unknown as WithFbq).fbq = fbq;
    trackMeta("Contact", { content_name: "oferta" });
    expect(fbq).toHaveBeenCalledWith("track", "Contact", { content_name: "oferta" });
  });

  it("manda el evento sin parámetros cuando no se pasan", () => {
    const fbq = vi.fn();
    (window as unknown as WithFbq).fbq = fbq;
    trackMeta("Lead");
    expect(fbq).toHaveBeenCalledWith("track", "Lead", undefined);
  });

  it("ignora un fbq que no es una función", () => {
    (window as unknown as WithFbq).fbq = "no soy una funcion";
    expect(() => trackMeta("Lead")).not.toThrow();
  });

  it("traga el error si el Pixel explota", () => {
    (window as unknown as WithFbq).fbq = () => {
      throw new Error("pixel roto");
    };
    expect(() => trackMeta("Lead")).not.toThrow();
  });
});
