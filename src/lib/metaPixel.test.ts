import { afterEach, describe, expect, it, vi } from "vitest";
import { isPixelExcludedPath, trackMeta, trackMetaCustom } from "./metaPixel";

type WithFbq = { fbq?: unknown };

afterEach(() => {
  delete (window as unknown as WithFbq).fbq;
  window.history.pushState({}, "", "/");
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

describe("isPixelExcludedPath", () => {
  it("excluye el seguimiento público, que lleva el código de acceso a la orden", () => {
    expect(isPixelExcludedPath("/tracking")).toBe(true);
    expect(isPixelExcludedPath("/tracking/4c316ccf-f7f2-4953-b13a-89c241b52f2e")).toBe(true);
  });

  it("no excluye la landing, la app ni rutas que solo se le parecen", () => {
    for (const p of ["/", "/oferta", "/py", "/latam", "/dashboard", "/trackingx", "/mi/tracking/abc"]) {
      expect(isPixelExcludedPath(p)).toBe(false);
    }
  });
});

describe("en el seguimiento público", () => {
  it("no manda ningún evento al Pixel aunque esté cargado", () => {
    const fbq = vi.fn();
    (window as unknown as WithFbq).fbq = fbq;
    window.history.pushState({}, "", "/tracking/4c316ccf-f7f2-4953-b13a-89c241b52f2e");
    trackMeta("Contact");
    trackMetaCustom("VSLProgreso");
    expect(fbq).not.toHaveBeenCalled();
  });

  it("sigue mandando eventos en el resto de las páginas", () => {
    const fbq = vi.fn();
    (window as unknown as WithFbq).fbq = fbq;
    window.history.pushState({}, "", "/oferta");
    trackMeta("Contact");
    trackMetaCustom("VSLProgreso");
    expect(fbq).toHaveBeenCalledTimes(2);
  });
});
