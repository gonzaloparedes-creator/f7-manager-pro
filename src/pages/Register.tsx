import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wrench } from "lucide-react";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { document.title = "Registro | F7 Manager Pro"; }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/login`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName, business_name: businessName, phone },
        },
      });
      setLoading(false);

      if (error) {
        let msg = error.message;
        if (error.message.includes("weak")) {
          msg = "La contraseña es muy débil. Debe incluir letras, números y símbolos.";
        } else if (error.message.includes("already registered") || error.message.includes("already exists")) {
          msg = "Este correo electrónico ya está registrado.";
        }
        toast({ title: "Error", description: msg, variant: "destructive" });
        return;
      }

      if (data?.session) {
        toast({ title: "¡Cuenta creada!", description: "Ingresando..." });
        navigate("/dashboard", { replace: true });
      } else {
        toast({
          title: "¡Cuenta creada!",
          description: "Te enviamos un correo de verificación. Por favor, revisá tu casilla (y Spam) para confirmar tu cuenta.",
        });
        navigate("/login", { replace: true });
      }
    } catch (err: any) {
      setLoading(false);
      toast({
        title: "Error",
        description: err?.message || "Ocurrió un error inesperado al registrar.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Wrench className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>Empezá a gestionar tus reparaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">Nombre del taller</Label>
              <Input id="businessName" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" placeholder="595XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando..." : "Crear cuenta"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tenés cuenta?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Iniciá sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
