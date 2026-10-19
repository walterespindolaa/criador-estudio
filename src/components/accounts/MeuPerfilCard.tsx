import { ArrowRight, Loader2, Plus } from "lucide-react";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useAbrirMeuPerfil, useCriarMeuPerfil, rotuloPlanoMeuPerfil } from "@/hooks/useMeuPerfil";
import { Button } from "@/components/ui/button";

/* O PRIMEIRO CARD DA CARTEIRA (mockup "Meu perfil", telas 2 e 2b, 18/10/2026)
   Quem atende clientes e também cria conteúdo tem o próprio Cria aqui, fixo
   no começo, aberto do mesmo jeito que o Cria de uma cliente. Ainda sem
   perfil, o card tracejado oferece criar (7 dias grátis, sem outro e-mail).
   Não aparece pra colaboradora atuando no time de outra agência: o perfil é
   da pessoa, não da agência. */
export function MeuPerfilCard() {
  const { meuPerfil, meuPerfilLoading, actingAsTeam } = useActiveAccount();
  const abrir = useAbrirMeuPerfil();
  const criar = useCriarMeuPerfil();

  if (actingAsTeam || meuPerfilLoading) return null;

  if (!meuPerfil) {
    return (
      <div className="relative flex flex-col items-center text-center rounded-3xl border-2 border-dashed border-primary/40 bg-primary/[0.04] p-4 sm:p-5 pt-6">
        <span className="w-16 h-16 rounded-full grid place-items-center bg-primary/10 text-primary mb-3">
          <Plus className="h-7 w-7" />
        </span>
        <p className="font-display font-bold text-foreground">Meu perfil</p>
        <p className="text-xs text-muted-foreground font-body">o seu próprio Cria</p>
        <p className="text-[11px] text-muted-foreground font-body mt-2 leading-snug">
          Organize o seu conteúdo no mesmo lugar dos seus clientes. 7 dias grátis, depois o plano que você escolher.
        </p>
        <Button size="sm" className="h-8 rounded-xl px-3 text-xs mt-3" disabled={criar.isPending} onClick={() => criar.mutate(undefined)}>
          {criar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Criar meu perfil
        </Button>
      </div>
    );
  }

  const handle = meuPerfil.instagram_handle?.replace(/^@/, "");
  const plano = rotuloPlanoMeuPerfil(meuPerfil);
  const inicial = (meuPerfil.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter") abrir(); }}
      className="group relative flex flex-col items-center text-center bg-card border-2 border-primary rounded-3xl p-4 sm:p-5 pt-6 cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
      <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-body font-extrabold uppercase tracking-wider bg-primary text-primary-foreground rounded-full px-2.5 py-0.5">
        Meu perfil
      </span>
      <span className="relative w-16 h-16 rounded-full grid place-items-center text-xl font-display font-bold overflow-hidden mt-3 mb-3 ring-2 ring-white shadow-md bg-gradient-to-br from-primary via-purple-600 to-pink-500 text-white">
        {inicial}
        {meuPerfil.avatar_url && <img src={meuPerfil.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover" />}
      </span>
      <p className="font-display font-bold text-foreground truncate w-full">{meuPerfil.name || "Meu perfil"}</p>
      <p className="text-xs text-muted-foreground font-body truncate w-full">
        {[handle ? `@${handle}` : null, plano].filter(Boolean).join(" · ")}
      </p>
      <p className="text-[11px] text-muted-foreground/80 font-body mt-1">Não conta nos seus clientes</p>
      <Button size="sm" className="h-8 rounded-xl px-3 text-xs mt-3" onClick={(e) => { e.stopPropagation(); abrir(); }}>
        Abrir meu Cria <ArrowRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}
