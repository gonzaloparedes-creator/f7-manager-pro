import { describe, expect, it } from "vitest";
import { newMilestones, vslEmbedUrl, VSL_MILESTONES } from "./vsl";

describe("newMilestones", () => {
  it("no avisa nada al principio", () => {
    expect(newMilestones(10, 372, new Set())).toEqual([]);
  });

  it("avisa el 25 % al llegar y no lo repite", () => {
    expect(newMilestones(93, 372, new Set())).toEqual([25]);
    expect(newMilestones(100, 372, new Set([25]))).toEqual([]);
  });

  it("si la persona salta hacia adelante, avisa todos los que quedaron atrás", () => {
    expect(newMilestones(300, 372, new Set([25]))).toEqual([50, 75]);
  });

  it("al final llega al 95 %", () => {
    expect(newMilestones(372, 372, new Set([25, 50, 75]))).toEqual([95]);
  });

  it("sin duración conocida (video cargando) no avisa", () => {
    expect(newMilestones(50, 0, new Set())).toEqual([]);
    expect(newMilestones(NaN, 372, new Set())).toEqual([]);
  });

  it("los hitos son 25, 50, 75 y 95", () => {
    expect([...VSL_MILESTONES]).toEqual([25, 50, 75, 95]);
  });
});

describe("vslEmbedUrl", () => {
  it("usa el dominio sin cookies, reproduce solo y habilita la API para medir", () => {
    const url = new URL(vslEmbedUrl("abc123", "https://f7.example"));
    expect(url.hostname).toBe("www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/abc123");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("enablejsapi")).toBe("1");
    expect(url.searchParams.get("rel")).toBe("0");
    expect(url.searchParams.get("playsinline")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("https://f7.example");
  });
});
