import { Outlet } from "react-router-dom";
import { LandingLanguageProvider } from "@/i18n/LandingLanguage";

// Las dos landings públicas (/ y /oferta) comparten idioma; el resto de la app sigue en español.
export default function LandingLayout() {
  return (
    <LandingLanguageProvider>
      <Outlet />
    </LandingLanguageProvider>
  );
}
