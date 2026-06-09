import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Wrench } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "F7 Manager Pro — Gestión de reparaciones";
    if (!loading) navigate(user ? "/dashboard" : "/login", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
          <Wrench className="h-6 w-6" />
        </div>
        <div className="text-sm text-muted-foreground">Cargando F7 Manager Pro...</div>
      </div>
    </div>
  );
};

export default Index;
