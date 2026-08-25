import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ClipboardList, ShoppingCart, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePlan } from "@/hooks/usePlan";

// Botón central flotante en la barra inferior mobile, accesible desde
// cualquier pantalla — antes "Nueva Orden" solo vivía arriba de la página
// de Órdenes, así que si estabas en Clientes o Inventario había que volver
// y scrollear. Se posiciona relativo al <nav>, no como un ítem más del flex,
// porque la cantidad de tabs varía según plan/rol.
export default function QuickActionsFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isBusiness, isRetail } = usePlan();
  const hasStore = isBusiness || isRetail;

  const actions = [
    {
      key: "order",
      label: "Nueva Orden",
      desc: "Recibir un equipo para reparación",
      icon: ClipboardList,
      run: () => navigate("/dashboard", { state: { openNewOrder: true } }),
    },
    {
      key: "quote",
      label: "Nuevo Presupuesto",
      desc: "Cotizar sin recibir el equipo todavía",
      icon: FileText,
      run: () => navigate("/dashboard", { state: { openNewQuote: true } }),
    },
    ...(hasStore
      ? [{
          key: "sale",
          label: "Venta Mostrador",
          desc: "Vender un producto del catálogo",
          icon: ShoppingCart,
          run: () => navigate("/productos"),
        }]
      : []),
  ];

  const handleTap = () => {
    if (actions.length === 1) { actions[0].run(); return; }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTap}
        aria-label="Acciones rápidas"
        className="absolute -top-5 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated ring-4 ring-background transition-transform active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Acciones rápidas</SheetTitle>
          </SheetHeader>
          <div className="mt-2 space-y-2 pb-[env(safe-area-inset-bottom)]">
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => { setOpen(false); a.run(); }}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:bg-accent"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <a.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
