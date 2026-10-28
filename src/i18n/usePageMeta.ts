import { useEffect } from "react";

// Título de la pestaña y descripción del sitio en el idioma elegido; al salir de la página
// se devuelven los de index.html para no pisar el resto de la app.
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousTitle = document.title;
    const previousDescription = descriptionTag?.getAttribute("content") ?? null;
    document.title = title;
    descriptionTag?.setAttribute("content", description);
    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) descriptionTag?.setAttribute("content", previousDescription);
    };
  }, [title, description]);
}
