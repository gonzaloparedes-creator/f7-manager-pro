import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Globe2, Building2 } from "lucide-react";

export default function SuperAdminHome() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  useEffect(() => { document.title = "Super Admin — F7 Manager Pro"; }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const tiles = [
    {
      to: "/superadmin/proveedores",
      icon: Globe2,
      title: "Comparativa de Proveedores",
      desc: "Inteligencia de mercado: precios promedio, min y max por proveedor.",
    },
    {
      to: "/master-admin",
      icon: Building2,
      title: "Gestión de Empresas",
      desc: "Planes, estado y administración global de talleres.",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Super Admin</h1>
            <p className="text-sm text-muted-foreground">Panel global de inteligencia SaaS</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {tiles.map((t) => (
            <Link key={t.to} to={t.to} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/60">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <t.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-3 text-lg">{t.title}</CardTitle>
                  <CardDescription>{t.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-primary group-hover:underline">
                    Abrir →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
