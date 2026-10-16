import { cn } from "@/lib/utils";

export default function LoadingState({ className }: { className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center py-10", className)}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="sr-only">Cargando...</span>
    </div>
  );
}
