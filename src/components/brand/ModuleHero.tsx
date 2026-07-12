import type { ReactNode } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { CRIA_HEX, colorFromPath, type CriaColor } from "@/lib/moduleTheme";
import { cn } from "@/lib/utils";

export type SubTab = { to: string; label: string; end?: boolean };

// ═══════════════════════════════════════════════════════════════════════
// CABEÇALHO DE MÓDULO
//
// Um cabeçalho com a cor do módulo e as formas orgânicas atrás. É o que
// faz a pessoa SENTIR onde está: entrou no Caixa, a tela fica azul; foi
// pro Post, fica laranja. Antes era tudo o mesmo bege e o único sinal de
// contexto era o título escrito.
//
// Recebe as abas do módulo (submenu com rota real) — cada seção vira uma
// URL de verdade, compartilhável e com botão voltar funcionando.
// ═══════════════════════════════════════════════════════════════════════

export function ModuleHero({
  title, subtitle, actions, tabs, color, children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  tabs?: SubTab[];
  color?: CriaColor;              // se não vier, deduz pela rota
  children?: ReactNode;           // controles extras (ex.: seletor Empresa/Pessoal)
}) {
  const { pathname } = useLocation();
  const c = color ?? colorFromPath(pathname);
  const hex = CRIA_HEX[c];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card mb-5">
      <OrganicBlobs color={c} />

      <div className="relative px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-foreground truncate">{title}</h1>
            {subtitle && <p className="text-sm font-body text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
        </div>

        {children && <div className="mt-4">{children}</div>}

        {/* Submenu — rota real por seção. Sublinhado na cor do módulo. */}
        {tabs && tabs.length > 0 && (
          <nav className="mt-4 -mx-1 flex gap-1 overflow-x-auto scrollbar-none">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-body font-semibold border-b-2 transition-colors",
                    isActive ? "text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )
                }
                style={({ isActive }) => (isActive ? { borderBottomColor: hex, color: hex } : undefined)}
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        )}
        {!tabs && <div className="h-5" />}
      </div>
    </div>
  );
}

export default ModuleHero;
