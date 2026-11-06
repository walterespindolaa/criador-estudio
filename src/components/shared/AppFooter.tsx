import { Link } from "react-router-dom";

const VERSAO = typeof __APP_VERSAO__ !== "undefined" ? __APP_VERSAO__ : "dev";
const CURTA = typeof __APP_VERSAO_CURTA__ !== "undefined" ? __APP_VERSAO_CURTA__ : "dev";

export function AppFooter() {
  return (
    <footer className="border-t border-border mt-12 py-6 px-6">
      <div className="max-w-6xl mx-auto text-center space-y-3">
        <p className="text-xs text-muted-foreground font-body leading-relaxed max-w-2xl mx-auto">
          O Cria Social Club é uma plataforma de organização e gestão de conteúdo para
          criadores nas redes sociais. As sugestões geradas por inteligência
          artificial são orientativas e não substituem o julgamento profissional
          do criador. Cabe ao usuário avaliar e adaptar todo conteúdo antes de
          publicar.
        </p>
        <p className="text-xs text-muted-foreground font-body">
          Cria Social Club © {new Date().getFullYear()} ·{" "}
          <Link to="/termos" className="hover:text-foreground underline-offset-2 hover:underline">
            Termos
          </Link>{" "}
          ·{" "}
          <Link to="/privacidade" className="hover:text-foreground underline-offset-2 hover:underline">
            Privacidade
          </Link>
        </p>
        <p className="text-[11px] text-muted-foreground/70 font-body tabular-nums" title={`Subiu em ${VERSAO}`}>
          {CURTA}
        </p>
      </div>
    </footer>
  );
}
