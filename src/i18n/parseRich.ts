export type RichPart = { kind: "text" | "strong" | "accent"; text: string } | { kind: "br" };

// Mini formato para los textos de las landings: **destacado**, [[acento de color]]
// y salto de línea. Un marcador sin su par queda como texto, nunca rompe.
const TOKEN = /\*\*(.+?)\*\*|\[\[(.+?)\]\]|\n/g;

export function parseRich(input: string): RichPart[] {
  const parts: RichPart[] = [];
  let last = 0;
  for (const m of input.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: "text", text: input.slice(last, at) });
    if (m[1] !== undefined) parts.push({ kind: "strong", text: m[1] });
    else if (m[2] !== undefined) parts.push({ kind: "accent", text: m[2] });
    else parts.push({ kind: "br" });
    last = at + m[0].length;
  }
  if (last < input.length) parts.push({ kind: "text", text: input.slice(last) });
  return parts;
}

// Sin los marcadores: para <title>, meta description o el mensaje de WhatsApp.
export function stripRich(input: string): string {
  return parseRich(input)
    .map((p) => (p.kind === "br" ? "\n" : p.text))
    .join("");
}
