import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, BarChart3, Building2, Users, Camera, Sparkles } from "lucide-react";
import { openUpgradeWhatsApp } from "@/lib/upgrade";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const benefits = [
  { icon: Package, title: "Inventario completo", desc: "Controlá stock, costos y repuestos." },
  { icon: BarChart3, title: "Reportes financieros", desc: "Ingresos brutos, costos y ganancia neta." },
  { icon: Building2, title: "Sucursales ilimitadas", desc: "Gestioná todos tus locales." },
  { icon: Users, title: "Hasta 5 usuarios", desc: "Sumá técnicos a tu equipo." },
  { icon: Camera, title: "20 fotos por orden", desc: "Más evidencia por reparación." },
];

export default function UpgradeProDialog({ open, onOpenChange }: Props) {
  const contact = () => openUpgradeWhatsApp();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-secondary/30">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/15 ring-1 ring-secondary/30">
            <Sparkles className="h-6 w-6 text-secondary" />
          </div>
          <DialogTitle className="text-center text-xl">¡Lleva tu taller al siguiente nivel!</DialogTitle>
          <DialogDescription className="text-center">
            Desbloqueá todas las herramientas profesionales con el plan <span className="font-semibold text-secondary">PRO</span>.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-2">
          {benefits.map((b) => (
            <li key={b.title} className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                <b.icon className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-semibold">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.desc}</div>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter className="sm:justify-center">
          <Button onClick={contact} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Contactar para subir de Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
