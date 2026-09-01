import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, Settings, LogOut, Users, BarChart3, Package, ShoppingBag, ShieldCheck, Lock, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import f7Logo from "@/assets/f7-logo.png";
import { useCompanyStatus } from "@/hooks/useCompanyStatus";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { usePlan } from "@/hooks/usePlan";
import { openUpgradeWhatsApp } from "@/lib/upgrade";
import { PLAN_MESSAGES } from "@/lib/plans";
import SuspendedAccount from "@/pages/SuspendedAccount";
import UpgradeProDialog from "@/components/UpgradeProDialog";
import QuickActionsFab from "@/components/QuickActionsFab";

const baseNav = [
  { to: "/dashboard", label: "Órdenes", icon: LayoutDashboard, proOnly: false, businessOnly: false, adminOnly: false },
  { to: "/clientes", label: "Clientes", icon: Users, proOnly: false, businessOnly: false, adminOnly: false },
  { to: "/inventario", label: "Inventario", icon: Package, proOnly: true, businessOnly: false, adminOnly: false },
  { to: "/productos", label: "Productos", icon: ShoppingBag, proOnly: false, businessOnly: true, adminOnly: false },
  { to: "/reportes", label: "Reportes", icon: BarChart3, proOnly: true, businessOnly: false, adminOnly: true },
  { to: "/como-usar", label: "Cómo usar", icon: BookOpen, proOnly: false, businessOnly: false, adminOnly: false },
];
const adminNav = [
  { to: "/configuracion", label: "Configuración", icon: Settings, proOnly: false, businessOnly: false, adminOnly: true },
];

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRole();
  const { isSuperAdmin } = useSuperAdmin();
  const { isActive, loading: statusLoading } = useCompanyStatus();
  const { isStarter, isBusiness, isRetail, loading: planLoading } = usePlan();
  const hasExternalInventory = isBusiness || isRetail;
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const nav = useMemo(() => {
    const items = isAdmin ? [...baseNav, ...adminNav] : baseNav;
    const filtered = items.filter((i) => !i.adminOnly || isAdmin);
    if (isSuperAdmin) {
      filtered.push({ to: "/superadmin", label: "Super Admin", icon: ShieldCheck, proOnly: false, businessOnly: false, adminOnly: false });
    }
    return filtered;
  }, [isAdmin, isSuperAdmin]);

  // La barra inferior mobile no entra con más de ~5 ítems (peor todavía con
  // el badge de bloqueo PRO/BUSINESS) — Configuración y Super Admin son de
  // uso poco frecuente comparado con Órdenes/Clientes/Inventario/Productos,
  // así que en mobile viven como íconos en el header en vez de competir por
  // espacio en la barra inferior. En desktop el sidebar tiene lugar de sobra.
  const mobileNav = useMemo(
    () => nav.filter((i) => i.to !== "/configuracion" && i.to !== "/superadmin" && i.to !== "/como-usar"),
    [nav]
  );
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (loading || !user || statusLoading || planLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isActive === false && !isSuperAdmin) {
    return <SuspendedAccount />;
  }

  const renderNavItem = (item: typeof baseNav[number], mobile = false) => {
    const businessLocked = item.businessOnly && !hasExternalInventory;
    const locked = (item.proOnly && isStarter) || businessLocked;
    if (locked) {
      if (mobile) {
        return (
          <button
            key={item.to}
            onClick={() => businessLocked ? openUpgradeWhatsApp(PLAN_MESSAGES.business) : setUpgradeOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground"
            aria-label={`${item.label} (requiere plan ${businessLocked ? "Business" : "Pro"})`}
          >
            <span className="relative">
              <item.icon className="h-5 w-5" />
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-secondary ring-2 ring-card">
                <Lock className="h-2 w-2 text-secondary-foreground" />
              </span>
            </span>
            <span className="truncate text-[10px]">{item.label}</span>
          </button>
        );
      }
      return (
        <button
          key={item.to}
          onClick={() => businessLocked ? openUpgradeWhatsApp(PLAN_MESSAGES.business) : setUpgradeOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
        >
          <item.icon className="h-4 w-4" />
          <span className="flex items-center gap-2">
            {item.label}
            <span
              className="rounded-sm bg-secondary px-1.5 py-0.5 text-[9px] font-bold leading-none text-secondary-foreground"
            >
              {businessLocked ? "BUSINESS" : "PRO"}
            </span>
          </span>
        </button>
      );
    }
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          cn(
            mobile
              ? "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium"
              : "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            mobile
              ? isActive ? "text-primary" : "text-muted-foreground"
              : isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          )
        }
      >
        <item.icon className={mobile ? "h-5 w-5" : "h-4 w-4"} />
        {item.label}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <UpgradeProDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Link to="/dashboard" className="flex items-center gap-3 px-6 py-6">
          <img
            src={f7Logo}
            alt="F7 Manager Pro"
            className="h-11 w-11 rounded-lg object-contain"
          />
          <div>
            <div className="text-base font-bold leading-tight tracking-tight">F7 Manager Pro</div>
            <div className="text-[11px] text-sidebar-foreground/60">Control total de tu taller</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => renderNavItem(item))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-sidebar text-sidebar-foreground px-4 py-3 md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={f7Logo} alt="F7 Manager Pro" className="h-8 w-8 rounded-md object-contain" />
          <span className="font-bold">F7 Manager Pro</span>
        </Link>
        <div className="-mr-2 flex items-center">
          {isSuperAdmin && (
            <Link
              to="/superadmin"
              aria-label="Super Admin"
              className="rounded-full p-2.5 text-sidebar-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ShieldCheck className="h-5 w-5" />
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/configuracion"
              aria-label="Configuración"
              className="rounded-full p-2.5 text-sidebar-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}
          <Link
            to="/como-usar"
            aria-label="Cómo usar"
            className="rounded-full p-2.5 text-sidebar-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BookOpen className="h-5 w-5" />
          </Link>
          <button
            onClick={signOut}
            aria-label="Cerrar sesión"
            className="rounded-full p-2.5 text-sidebar-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="md:pl-64 pb-20 md:pb-0">
        <div className="mx-auto max-w-6xl p-4 md:p-8 animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t bg-card md:hidden">
        {mobileNav.map((item) => renderNavItem(item, true))}
      </nav>
      <QuickActionsFab />
    </div>
  );
}
