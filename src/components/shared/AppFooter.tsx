import { Link } from "react-router-dom";

export function AppFooter() {
  return (
    <footer className="border-t border-border mt-12 py-6 px-6">
      <div className="max-w-6xl mx-auto text-center space-y-3">
        <p className="text-xs text-muted-foreground font-body leading-relaxed max-w-2xl mx-auto">
          O cria é uma plataforma de organização e gestão de conteúdo para
          criadores nas redes sociais. As sugestões geradas por inteligência
          artificial são orientativas e não substituem o julgamento profissional
          do criador. Cabe ao usuário avaliar e adaptar todo conteúdo antes de
          publicar.
        </p>
        <p className="text-xs text-muted-foreground font-body">
          cria © {new Date().getFullYear()} ·{" "}
          <Link to="/termos" className="hover:text-foreground underline-offset-2 hover:underline">
            Termos
          </Link>{" "}
          ·{" "}
          <Link to="/privacidade" className="hover:text-foreground underline-offset-2 hover:underline">
            Privacidade
          </Link>
        </p>
      </div>
    </footer>
  );
}
