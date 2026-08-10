import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, SwitchCamera } from "lucide-react";

type Shot = { blob: Blob; previewUrl: string };

// Reemplaza <input capture="environment">: ese flujo abre la app nativa de
// Cámara de Android como una Activity separada. Al volver, Chrome puede
// haber descargado la pestaña por presión de memoria y el usuario cae de
// nuevo en el dashboard sin la foto. Al capturar con getUserMedia nunca se
// sale de la página, así que no hay Activity-switch que dispare eso.
export function CameraCapture({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (files: File[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [shots, setShots] = useState<Shot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    stopStream();
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo acceder a la cámara. Probá con Galería.");
      });
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing]);

  // Cleanup de previews al desmontar (cancelar o cerrar sin usar "Listo")
  useEffect(() => {
    return () => {
      shots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setShots((prev) => [...prev, { blob, previewUrl: URL.createObjectURL(blob) }]);
      },
      "image/jpeg",
      0.9
    );
  };

  const removeShot = (i: number) => {
    setShots((prev) => {
      URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, j) => j !== i);
    });
  };

  const finish = () => {
    const files = shots.map(
      (s, i) => new File([s.blob], `camara-${Date.now()}-${i}.jpg`, { type: "image/jpeg" })
    );
    stopStream();
    if (files.length > 0) onCapture(files);
    onClose();
  };

  const cancel = () => {
    stopStream();
    shots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black pointer-events-auto">
      {/* Radix Dialog pone pointer-events:none en <body> mientras está abierto
          y solo restaura pointer-events en sus propios nodos portados; este
          overlay se porta aparte, así que sin este pointer-events-auto
          hereda ese none: se ve encima pero los clics atraviesan al form. */}
      <div className="flex items-center justify-between p-3 text-white">
        <button
          type="button"
          onClick={cancel}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40"
          aria-label="Cerrar cámara"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium">
          {shots.length > 0 ? `${shots.length} foto${shots.length > 1 ? "s" : ""}` : "Tomar foto"}
        </span>
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40"
          aria-label="Cambiar cámara"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white">
            {error}
          </div>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
        )}
      </div>

      {shots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto bg-black/60 p-2">
          {shots.map((s, i) => (
            <div key={s.previewUrl} className="relative shrink-0">
              <img src={s.previewUrl} alt={`Foto ${i + 1}`} className="h-14 w-14 rounded-md object-cover" />
              <button
                type="button"
                onClick={() => removeShot(i)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                aria-label="Quitar foto"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-8 bg-black/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={capture}
          disabled={!ready || !!error}
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
          aria-label="Capturar foto"
        >
          <span className="h-12 w-12 rounded-full bg-white" />
        </button>
        {shots.length > 0 && (
          <button
            type="button"
            onClick={finish}
            className="flex h-12 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Check className="h-4 w-4" /> Listo
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
