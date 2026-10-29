import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useTier } from "@/hooks/useTier";
import { useStoryTrends } from "@/hooks/useStoryTrends";
import { useSendPostToPrompter } from "@/hooks/usePrompterScripts";
import { falaDoStory, storyFalado, tipoDoFormato, NOME_TIPO } from "@/lib/storyRoteiro";
import { PLANS } from "@/lib/plans";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CrIA } from "@/components/brand/CrIA";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   ATALHOS DA PÁGINA INICIAL (28/10/2026, mockup aba 6, foco no celular)

   v2 (28/10, opção B do mockup): uma faixa só, "Gravar story", logo abaixo
   da saudação (o "+ Novo post" já está no cartão verde). Com Studio, "Gravar story" abre o story falado de hoje direto no
   Prompter (ou o Novo story, se não tiver). Sem Studio, abre a vitrine do
   Studio subindo de baixo, com 3 exemplos reais da curadoria de stories.
   ═══════════════════════════════════════════════════════════════════════════ */

function hojeIso(): string {
  const d = new Date();
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
}

type StoryHoje = { id: string; title: string; slot_time: string | null; script: string | null; format: string | null; post_id: string | null };

export function AtalhosInicio() {
  const navigate = useNavigate();
  const { activeAccountId } = useActiveAccount();
  const { isStudio } = useTier();
  const [vitrine, setVitrine] = useState(false);
  const enviar = useSendPostToPrompter();

  /* O próximo story falado de hoje que ainda não foi gravado. */
  const { data: proximo } = useQuery<StoryHoje | null>({
    queryKey: ["atalho-story-hoje", activeAccountId, hojeIso()],
    enabled: !!activeAccountId && isStudio,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;
      const { data } = await sb("story_slots").select("id,title,slot_time,script,format,post_id")
        .eq("user_id", activeAccountId!).eq("slot_date", hojeIso()).eq("status", "pendente")
        .order("slot_time", { ascending: true, nullsFirst: false });
      const lista = (data as unknown as StoryHoje[] | null) ?? [];
      return lista.find((s) => storyFalado(s.format) && s.post_id) ?? null;
    },
  });

  const gravarStory = () => {
    if (!isStudio) { setVitrine(true); return; }
    const fala = proximo ? falaDoStory(proximo.script).fala.trim() : "";
    if (proximo?.post_id && fala) {
      enviar.mutate({ postId: proximo.post_id, title: proximo.title, script: fala, source: "stories" }, {
        onSuccess: (id) => navigate(`/app/prompter/gravar/${id}`),
      });
      return;
    }
    navigate("/app/stories", { state: { novoStory: true } });
  };

  const sub = !isStudio
    ? "Plano semanal de stories"
    : proximo ? `${proximo.title}${proximo.slot_time ? ` · ${proximo.slot_time.slice(0, 5)}` : ""}` : "Escreva e grave agora";

  return (
    <>
      <button type="button" onClick={gravarStory} disabled={enviar.isPending} data-tour="dash-atalhos"
        className="w-full mb-5 text-left rounded-[18px] bg-[#1F1A17] text-white px-3.5 py-3 flex items-center gap-3 shadow-[0_6px_18px_rgba(40,20,10,0.14)] active:scale-[0.99] transition-transform disabled:opacity-80">
        <span className="h-10 w-10 shrink-0 rounded-full bg-white/[0.12] grid place-items-center">
          {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" />
            : <span className="h-[18px] w-[18px] rounded-full border-[2.5px] border-[#FF6B6B] grid place-items-center"><span className="h-2 w-2 rounded-full bg-[#FF6B6B]" /></span>}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block font-display font-extrabold text-[15px] leading-tight">Gravar story</b>
          <small className="block text-[12px] font-body text-white/75 truncate">{sub}</small>
        </span>
        <span className="shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-body font-extrabold bg-[#FF6B6B] text-white">{isStudio ? "Gravar" : "Studio"}</span>
      </button>
      <VitrineStudio open={vitrine} onOpenChange={setVitrine} />
    </>
  );
}

/* Vitrine do Studio (stories). Mesma em qualquer lugar que esbarre no Studio. */
export function VitrineStudio({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { data: trends = [] } = useStoryTrends();
  const studio = PLANS.find((p) => p.id === "studio");
  const exemplos = trends.filter((t) => t.example).slice(0, 3);
  const COR: Record<string, string> = {
    falado: "bg-emerald-100 text-emerald-800", figurinha: "bg-amber-100 text-amber-900",
    midia: "bg-violet-100 text-violet-800", texto: "bg-violet-100 text-violet-800",
  };
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <div className="mx-auto w-full max-w-[540px] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2 flex flex-col gap-3.5">
          <span className="self-start text-[11px] font-body font-extrabold rounded-full px-2.5 py-1 bg-foreground text-background">Exclusivo do cria Studio</span>
          <DrawerTitle className="font-display font-extrabold text-[23px] leading-tight text-left">Story todo dia, sem travar no que postar</DrawerTitle>
          <DrawerDescription className="text-left text-sm font-body text-muted-foreground">
            A Cria IA monta sua semana de stories com o que está em alta no seu nicho. Você grava lendo a fala na tela e o vídeo já cai no post.
          </DrawerDescription>
          {exemplos.length > 0 && (
            <div className="rounded-2xl border-[1.5px] border-dashed border-border p-3 flex flex-col gap-2">
              <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">O que a <CrIA /> faria pra você esta semana</p>
              {exemplos.map((t) => {
                const tipo = tipoDoFormato(t.format);
                return (
                  <div key={t.id} className="flex items-baseline gap-2 text-[13px] font-body">
                    <span className={cn("shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5", COR[tipo])}>{NOME_TIPO[tipo]}</span>
                    <span className="text-foreground line-clamp-2">{t.example}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Semana pronta", "7 dias de stories com gancho, interação e horário."],
              ["Prompter de story", "A fala rola na tela no seu ritmo enquanto você grava."],
              ["Figurinha sem esquecer", "Enquete, caixinha e quiz com lembrete na hora de postar."],
              ["E o mês inteiro", "Libera o Cria Plano e 500 gerações da Cria IA por mês."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-muted p-3">
                <b className="block font-display text-sm mb-0.5">{t}</b>
                <span className="text-[12px] font-body text-muted-foreground leading-snug">{d}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <span className="font-display font-extrabold text-xl">{studio?.price ?? "R$ 49,90"}<small className="font-body font-semibold text-xs text-muted-foreground">/mês · cancela quando quiser</small></span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Agora não</Button>
              <Button onClick={() => { onOpenChange(false); navigate("/app/assinar"); }}>Quero o Studio</Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
