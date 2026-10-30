import { useEffect, useRef, useState } from "react";
import { Play, Volume2 } from "lucide-react";
import { newMilestones, vslEmbedUrl, type VslMilestone } from "@/lib/vsl";

// Reproductor del VSL: primero una portada liviana (no carga nada de YouTube hasta que la persona
// toca), después el video de YouTube con sonido. Mide cuánto se miró con la API del reproductor.

interface YTPlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}
interface YTNamespace {
  Player: new (el: HTMLIFrameElement, opts: { events?: Record<string, (e: { data: number }) => void> }) => YTPlayer;
}
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (w.YT) resolve(w.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error("No cargó la API de YouTube"));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

export function VslPlayer({
  videoId,
  poster,
  title,
  playLabel,
  durationLabel,
  pendingLabel,
  onPlay,
  onMilestone,
}: {
  videoId: string;
  poster: string;
  title: string;
  playLabel: string;
  durationLabel: string;
  /** Texto si todavía no hay video cargado (id vacío). */
  pendingLabel: string;
  onPlay?: () => void;
  onMilestone?: (milestone: VslMilestone) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sent = useRef(new Set<number>());
  const milestoneRef = useRef(onMilestone);
  milestoneRef.current = onMilestone;
  const hasVideo = videoId.trim() !== "";

  useEffect(() => {
    if (!playing || !iframeRef.current) return;
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !iframeRef.current) return;
        player = new YT.Player(iframeRef.current, {});
        timer = setInterval(() => {
          try {
            if (!player) return;
            for (const m of newMilestones(player.getCurrentTime(), player.getDuration(), sent.current)) {
              sent.current.add(m);
              milestoneRef.current?.(m);
            }
          } catch {
            // el reproductor todavía no está listo
          }
        }, 1000);
      })
      .catch(() => {
        // sin la API el video se ve igual; solo no se mide el avance
      });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        player?.destroy();
      } catch {
        // nada que limpiar
      }
    };
  }, [playing]);

  if (playing && hasVideo) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-primary/30 bg-black shadow-[0_0_60px_-15px_hsl(var(--primary)/0.6)]">
        <iframe
          ref={iframeRef}
          src={vslEmbedUrl(videoId, window.location.origin)}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!hasVideo) return;
        setPlaying(true);
        onPlay?.();
      }}
      aria-label={hasVideo ? `${playLabel} (${durationLabel})` : pendingLabel}
      className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-primary/30 bg-black text-left shadow-[0_0_60px_-15px_hsl(var(--primary)/0.6)]"
    >
      <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform duration-200 group-hover:scale-110 sm:h-20 sm:w-20 md:h-24 md:w-24">
          <Play className="ml-1 h-7 w-7 fill-current sm:h-9 sm:w-9 md:h-11 md:w-11" />
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-3 pb-2 text-center text-xs font-bold text-white sm:gap-2 sm:pb-5 sm:text-base">
        <Volume2 className="h-3.5 w-3.5 shrink-0 text-primary sm:h-5 sm:w-5" />
        <span>{hasVideo ? playLabel : pendingLabel}</span>
        {hasVideo && <span className="font-medium text-white/70">· {durationLabel}</span>}
      </div>
    </button>
  );
}
