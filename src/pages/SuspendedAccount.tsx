import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function SuspendedAccount() {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4 rounded-lg border bg-card p-8 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">Cuenta Suspendida</h1>
        <p className="text-muted-foreground">
          Tu cuenta ha sido suspendida. Por favor contactá al administrador para reactivar tu acceso a F7 Manager Pro.
        </p>
        <Button onClick={signOut} variant="outline" className="w-full">
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
