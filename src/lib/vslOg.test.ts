import { describe, expect, it } from "vitest";
import { renderVslOg } from "../../api/vsl-og";
import { withGroupTag } from "@/lib/vsl";

describe("vista previa del link de /py y /latam", () => {
  it("muestra la portada del video con play y un título que invita a mirarlo", () => {
    const html = renderVslOg("latam", "");
    expect(html).toContain('content="https://f7manager.com/latam/vsl-og.jpg"');
    expect(html).toContain("Mirá cómo funciona F7 Manager por dentro");
    expect(html).toContain("precios en dólares");
    expect(html).not.toMatch(/autom[aá]ti/i);
    expect(html).not.toContain("F7 Manager Pro");
  });

  it("conserva el grupo al redirigir y descarta valores raros", () => {
    expect(renderVslOg("py", "1")).toContain('url=https://f7manager.com/py?g=1"');
    const bad = renderVslOg("py", '"><script>');
    expect(bad).not.toContain("<script>");
    expect(bad).toContain('url=https://f7manager.com/py"');
  });
});

describe("marca del grupo en el mensaje de WhatsApp", () => {
  it("suma el grupo antes del paréntesis de cierre", () => {
    expect(withGroupTag(" (Vi el video)", "2")).toBe(" (Vi el video · Grupo 2)");
    expect(withGroupTag(" (Vi el video · Latam)", "1")).toBe(" (Vi el video · Latam · Grupo 1)");
    expect(withGroupTag(" (Vi el video)", null)).toBe(" (Vi el video)");
    expect(withGroupTag(" (Vi el video)", "a b")).toBe(" (Vi el video)");
  });
});
