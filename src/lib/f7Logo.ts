import f7Logo from "@/assets/f7-logo.png";

const SIZE = 256;

let cached: Promise<string | null> | null = null;

async function render(): Promise<string> {
  const img = new Image();
  img.src = f7Logo;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas no disponible");
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  return canvas.toDataURL("image/png");
}

// Dirección absoluta del logo empaquetado con la app (el mismo que se ve en el menú).
export function f7LogoUrl(): string {
  return new URL(f7Logo, window.location.origin).href;
}

// El logo como imagen incrustada (data URI). Los documentos del recibo (vista
// previa, impresión y PDF) lo llevan adentro, así no dependen de volver a
// pedirlo al servidor. Si falla devuelve null y no guarda el fallo.
export function loadF7LogoDataUri(): Promise<string | null> {
  if (!cached) {
    cached = render().catch(() => {
      cached = null;
      return null;
    });
  }
  return cached;
}
