import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useProfile";
import { useActiveAccount } from "@/contexts/AccountContext";

/* ═════════════════════════════════════════════════════════════════
   FAIXA DO CUPOM DE CAMPANHA NO INÍCIO (Walter, 12/11/2026)

   Quem está nos 7 dias grátis não passa por nenhuma tela com campo de cupom
   até decidir assinar, então não fica sabendo da oferta. Esta faixa aparece
   só no Início, só pra criador em teste, e some sozinha no fim da campanha.

   Pra trocar de campanha: mude CODIGO, o texto e FIM. O cupom precisa existir
   em cupons_campanha com a mesma validade (o CRIA30 vale até 01/12/2026,
   23:59 de Brasília, só Pro e Studio, primeira assinatura).
   ═════════════════════════════════════════════════════════════════ */
const CODIGO = "CRIA30";
const FIM = new Date("2026-12-01T23:59:59-03:00").getTime();
const CHAVE = "cria.faixa-cupom." + CODIGO;

export function FaixaCupomCampanha() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { status } = useSubscription();
  const { profile } = useProfile();
  const { ehMeuPerfil, isManaging } = useActiveAccount();
  const [fechada, setFechada] = useState(false);

  // Fechar vale pro dia: amanhã ela volta, até a campanha acabar.
  useEffect(() => {
    try { setFechada(localStorage.getItem(CHAVE) === new Date().toDateString()); } catch { /* modo privado */ }
  }, []);

  if (pathname !== "/app") return null;
  if (Date.now() > FIM) return null;
  if (fechada || ehMeuPerfil || isManaging) return null;
  if (profile?.account_type === "manager") return null;
  if (status !== "trial_active" && status !== "trial_expiring") return null;

  const fechar = () => {
    try { localStorage.setItem(CHAVE, new Date().toDateString()); } catch { /* ok */ }
    setFechada(true);
  };

  return (
    <div role="status" className="relative mx-3 mt-3 overflow-hidden rounded-2xl bg-[#FFCF03] px-4 py-3.5 text-[#0A0A0A] md:mx-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 pr-7">
        <div className="min-w-0 flex-1 basis-[230px]">
          <p className="font-display text-[17px] font-extrabold leading-tight">30% de desconto por 12 meses</p>
          <p className="mt-0.5 text-[13.5px] font-body leading-snug">
            Nos planos Pro e Studio, com o cupom <strong className="rounded-md bg-white/70 px-1.5 py-0.5 font-bold tracking-wide">{CODIGO}</strong>. Vale até 01/12.
          </p>
        </div>
        <button type="button" onClick={() => navigate(`/app/assinar?cupom=${CODIGO}`)}
          className="h-10 shrink-0 rounded-full bg-[#0A0A0A] px-5 font-display text-[14.5px] font-bold text-[#F5F3E7] active:scale-[0.97] transition-transform">
          Usar meu cupom
        </button>
      </div>
      <button type="button" onClick={fechar} aria-label="Fechar aviso do cupom"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-[#0A0A0A]/70 hover:bg-black/10">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
