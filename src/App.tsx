import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import UpdatePassword from "./pages/UpdatePassword.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import OrderDetail from "./pages/OrderDetail.tsx";
import Settings from "./pages/Settings.tsx";
import Clients from "./pages/Clients.tsx";
import Reports from "./pages/Reports.tsx";
import Inventory from "./pages/Inventory.tsx";
import PublicTrackingByCode from "./pages/PublicTrackingByCode.tsx";
import MasterAdmin from "./pages/MasterAdmin.tsx";
import SuperAdminHome from "./pages/SuperAdminHome.tsx";
import SuperAdminSuppliers from "./pages/SuperAdminSuppliers.tsx";
import Presentacion from "./pages/Presentacion.tsx";
import AppLayout from "./components/AppLayout.tsx";

const queryClient = new QueryClient();

const MetaPixelTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "PageView");
    }
  }, [location]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MetaPixelTracker />
        <Routes>
          <Route path="/" element={<Presentacion />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/actualizar-password" element={<UpdatePassword />} />
          <Route path="/tracking/:orderCode" element={<PublicTrackingByCode />} />
          <Route path="/master-admin" element={<MasterAdmin />} />
          <Route path="/superadmin" element={<SuperAdminHome />} />
          <Route path="/superadmin/proveedores" element={<SuperAdminSuppliers />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ordenes/:id" element={<OrderDetail />} />
            <Route path="/clientes" element={<Clients />} />
            <Route path="/inventario" element={<Inventory />} />
            <Route path="/reportes" element={<Reports />} />
            <Route path="/configuracion" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
