import { useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import EditOrderDialog from "@/components/EditOrderDialog";
import { cn } from "@/lib/utils";

interface OrderActionsMenuProps {
  orderId: string;
  orderNumber?: string;
  variant?: "icon" | "buttons";
  onUpdated?: () => void;
  onDeleted?: () => void;
}

export default function OrderActionsMenu({
  orderId,
  orderNumber,
  variant = "icon",
  onUpdated,
  onDeleted,
}: OrderActionsMenuProps) {
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isAdmin) return null;

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDelete = async () => {
    setDeleting(true);
    // Best-effort cleanup of dependent rows (no FK cascade configured)
    await supabase.from("order_status_history").delete().eq("order_id", orderId);
    await supabase.from("order_technical_notes").delete().eq("order_id", orderId);
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    setDeleting(false);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Orden eliminada",
      description: orderNumber ? `${orderNumber} fue eliminada.` : "La orden fue eliminada.",
    });
    setConfirmOpen(false);
    onDeleted?.();
  };

  return (
    <>
      {variant === "icon" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={stop}
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Opciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={stop}>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setEditOpen(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar Orden
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setConfirmOpen(true);
              }}
              className={cn("text-destructive focus:text-destructive")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar Orden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      )}

      <EditOrderDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        orderId={orderId}
        onUpdated={onUpdated}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la orden
              {orderNumber ? ` ${orderNumber}` : ""} y todo su historial asociado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
