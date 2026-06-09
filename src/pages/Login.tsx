import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import f7Logo from "@/assets/f7-logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"login" | "recover">("login");
  const [recoverEmail, setRecoverEmail] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Iniciar sesión | F7 Manager Pro";
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  const onRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(recoverEmail, {
      redirectTo: `${window.location.origin}/actualizar-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Enlace enviado", description: "Revisá tu correo para restablecer tu contraseña" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <img
            src={f7Logo}
            alt="F7 Manager Pro"
            className="mx-auto mb-3 h-16 w-16 rounded-xl object-contain"
          />
          <CardTitle className="text-2xl">F7 Manager Pro</CardTitle>
          <CardDescription>
            {view === "login" ? "Ingresá a tu cuenta de técnico" : "Recuperá el acceso a tu cuenta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view === "login" ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setRecoverEmail(email); setView("recover"); }}
                    className="text-xs text-muted-foreground transition-colors hover:text-[#00C2C7]"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Ingresando..." : "Iniciar sesión"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ¿No tenés cuenta?{" "}
                <Link to="/register" className="font-medium text-primary hover:underline">
                  Registrate
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={onRecover} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recover-email">Email</Label>
                <Input
                  id="recover-email"
                  type="email"
                  required
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#00C2C7] text-white hover:bg-[#00C2C7]/90"
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar enlace de recuperación"}
              </Button>
              <p className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="text-muted-foreground transition-colors hover:text-[#00C2C7]"
                >
                  Volver al inicio de sesión
                </button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
