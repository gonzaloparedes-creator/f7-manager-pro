// Glob (no imports directos por archivo): mientras src/assets/tutoriales/ esté
// vacía o no exista, esto no rompe el build — cada captura real que se agregue
// ahí después aparece sola, sin tocar este archivo ni tutorialsContent.ts.
const modules = import.meta.glob("/src/assets/tutoriales/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const byFilename: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  byFilename[path.split("/").pop() as string] = url;
}

export function getTutorialImageUrl(file: string): string | undefined {
  return byFilename[file];
}
