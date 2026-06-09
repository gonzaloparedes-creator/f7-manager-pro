import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import f7Logo from "@/assets/f7-logo.png";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Actualizar contraseña | F7 Manager Pro";
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "¡Listo!", description: "Tu contraseña fue actualizada correctamente" });
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <img src={f7Logo} alt="F7 Manager Pro" className="mx-auto mb-3 h-16 w-16 rounded-xl object-contain" />
          <CardTitle className="text-2xl">Nueva contraseña</CardTitle>
          <CardDescription>Definí tu nueva contraseña para acceder</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#00C2C7] text-white hover:bg-[#00C2C7]/90"
              disabled={loading || !ready}
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </Button>
            {!ready && (
              <p className="text-center text-xs text-muted-foreground">
                Validando enlace de recuperación...
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
