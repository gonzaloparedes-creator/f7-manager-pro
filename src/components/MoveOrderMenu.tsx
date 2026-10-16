import { ArrowRightLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type StatusPreset = { key: string; label: string };

interface MoveOrderMenuProps {
  status: string;
  presets: StatusPreset[];
  onMove: (toStatus: string) => void;
  className?: string;
}

// Alternativa accesible al arrastre: sirve con teclado, en el celular y en
// cualquier lista. Cualquiera que hoy pueda cambiar el estado desde el detalle
// de la orden puede usarlo (no es un permiso nuevo).
export default function MoveOrderMenu({ status, presets, onMove, className }: MoveOrderMenuProps) {
  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (status === "presupuesto" || presets.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground", className)}
          onClick={stop}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ArrowRightLeft className="h-4 w-4" />
          <span className="sr-only">Mover a otro estado</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={stop}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Mover a…</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {presets.map((p) => (
          <DropdownMenuItem
            key={p.key}
            disabled={p.key === status}
            onSelect={() => onMove(p.key)}
            className="gap-2"
          >
            {p.key === status ? <Check className="h-4 w-4 text-primary" /> : <span className="h-4 w-4" />}
            {p.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
