import imageCompression from "browser-image-compression";

export type PhotoEntry = { file: File; previewUrl: string };

// Comprimir apenas se agrega la foto (no recién al enviar el formulario): una
// foto de cámara sin comprimir puede pesar varios MB, y mientras el usuario
// completa el resto del formulario esos File quedan enteros en memoria. En
// Android, justo después de volver de la app de Cámara (que ya usó memoria
// por su cuenta), esa presión extra hace que el sistema mate la pestaña y
// vuelva al dashboard — no pasa con la galería porque el picker del sistema
// es mucho más liviano que la app de Cámara.
export const PHOTO_COMPRESS_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  initialQuality: 0.8,
};

export async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const compressed = await imageCompression(file, PHOTO_COMPRESS_OPTIONS);
    return new File([compressed], file.name, { type: compressed.type || file.type });
  } catch {
    return file;
  }
}
