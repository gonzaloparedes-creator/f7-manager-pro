import { ImageOff } from "lucide-react";
import { getTutorialImageUrl } from "@/lib/tutorialImages";

export default function TutorialImage({ file, alt }: { file: string; alt: string }) {
  const src = getTutorialImageUrl(file);
  if (!src) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/40 p-4 text-center text-xs text-muted-foreground">
        <ImageOff className="h-6 w-6" />
        <span>Captura pendiente: {file}</span>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <img src={src} alt={alt} loading="lazy" className="w-full" />
    </div>
  );
}
