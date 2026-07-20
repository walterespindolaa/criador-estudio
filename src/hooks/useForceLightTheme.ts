import { useEffect } from "react";

// Páginas PÚBLICAS (portal de aprovação, cronograma, proposta, bio) são vistas
// pelo cliente do cliente, que nunca configurou tema. Elas são desenhadas 100%
// claras (cards brancos, chips claros). Se o dispositivo está no dark mode, o
// ThemeProvider aplica `.dark` no <html> e o texto vira claro sobre branco —
// ilegível. Este hook fixa o modo claro enquanto a página pública está montada
// e restaura o tema anterior ao sair, sem afetar o app interno.
export function useForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    const hadLight = root.classList.contains("light");
    root.classList.remove("dark");
    root.classList.add("light");
    return () => {
      root.classList.remove("light", "dark");
      if (hadDark) root.classList.add("dark");
      else if (hadLight) root.classList.add("light");
    };
  }, []);
}
