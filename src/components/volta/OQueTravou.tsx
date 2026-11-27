import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, CirclePlay, Clock, HelpCircle, Lightbulb, Loader2, MoreHorizontal, Plus, RefreshCw, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useAbrirComunidade, IconeComunidade } from "@/components/ComunidadeCria";
import { useTour } from "@/components/tour/TourProvider";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { useBrandContext } from "@/hooks/useBrandContext";
import { useSendFeedback } from "@/hooks/useFeedback";
import { useEhCriadorNaPropriaConta } from "@/hooks/useSequencia";
import { getPostRapido, getVoltaIdeias, type PostRapido } from "@/lib/ai/claude";
import { parseSuggestions, type AISuggestion } from "@/lib/ai/sugestoes";
import { hojeBR } from "@/lib/date-br";
import { somarDias } from "@/lib/oQueTrava";
import { diasFora } from "@/lib/sequencia";
import { DIAS_SEMANA, devePerguntar, formatoPelaRede, type MotivoVolta } from "@/lib/volta";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   "O QUE TRAVOU?" (Walter, 27/11/2026: "Aprovado, constrói". Mockup:
   https://claude.ai/artifact/3oBSu2r55fNTTR1HWrawk5)

   Só 3 de 21 criadores voltavam num outro dia depois do cadastro. Quem volta
   depois de 3+ dias sem abrir o Cria vê esta folha UMA vez. Um toque responde
   e a resposta já leva pra uma saída na hora:
     · Não sabia o que postar: 3 ideias da Cria IA, uma vira post de amanhã.
     · Faltou tempo: post de 5 minutos, baixar a meta, lembrete no dia.
     · Não entendi como usar: tour do Criando, tutoriais e comunidade.
     · Faltou uma função: o que a pessoa queria fazer, pro painel de feedback.
     · Outro motivo: texto livre, depois "Bora recomeçar?".
   Toda resposta (e o "Agora não") grava em motivos_saida com origem 'volta',
   e é ela que segura a próxima pergunta por 30 dias (no banco, não no
   aparelho). Não aparece no dia do onboarding nem em cima de outro pop-up.
   ═══════════════════════════════════════════════════════════════════════════ */

type Status = { hoje: string; ultimo_dia: string | null; perguntou_recente: boolean };
type Tela = "pergunta" | MotivoVolta;

const sbRpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;

const OPCOES: { motivo: MotivoVolta; rotulo: string; cor: string; icone: ReactNode }[] = [
  { motivo: "sem_ideia", rotulo: "Não sabia o que postar", cor: "#FFCF03", icone: <Lightbulb className="h-4 w-4" /> },
  { motivo: "sem_tempo", rotulo: "Faltou tempo", cor: "#FF77B9", icone: <Clock className="h-4 w-4" /> },
  { motivo: "nao_entendi", rotulo: "Não entendi como usar", cor: "#CFE0FF", icone: <HelpCircle className="h-4 w-4" /> },
  { motivo: "faltou_funcao", rotulo: "Faltou uma função", cor: "#E3F0E1", icone: <Plus className="h-4 w-4" /> },
  { motivo: "outro", rotulo: "Outro motivo", cor: "#E4DDCC", icone: <MoreHorizontal className="h-4 w-4" /> },
];
const CORES_IDEIA = ["#FF77B9", "#9BB8FF", "#FFCF03"];

/** Mensagem do erro da IA, em português. */
function erroIA(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (/subscription_required|teste encerrou|plano ativo/i.test(m)) return "Seu teste acabou, então a Cria IA está fechada. Assine um plano pra liberar.";
  if (/rate|várias sugestões/i.test(m)) return m || "Por hoje já foram várias sugestões. Amanhã tem mais.";
  return "A Cria IA não respondeu agora. Tenta de novo em instantes.";
}

export function OQueTravou() {
  const ehCriador = useEhCriadorNaPropriaConta();
  const { profile } = useProfile();
  const { active: tourAtivo } = useTour();
  const adiado = useMemo(() => { try { return sessionStorage.getItem("cria.tour-adiado") === "1"; } catch { return false; } }, []);

  const { data: status } = useQuery<Status | null>({
    queryKey: ["volta-status", profile?.id],
    enabled: ehCriador && !adiado && !!profile?.id,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data, error } = await sbRpc("volta_status");
      if (error || !data) return null;
      return data as Status;
    },
  });
  // Dias fora calculado ANTES de olhar o dia de hoje (diasFora ignora hoje).
  const dias = status ? diasFora(status.ultimo_dia ? [status.ultimo_dia] : [], status.hoje) : null;
  const elegivel = !!status && ehCriador && !adiado && devePerguntar(dias, status.perguntou_recente);

  const [aberta, setAberta] = useState(false);
  const jaAbriu = useRef(false);
  /* Espera a tela assentar e só abre se não houver outro pop-up ou tour na
     frente. Tenta por uns 30s; se a tela continuar ocupada, fica pra próxima. */
  useEffect(() => {
    if (!elegivel || jaAbriu.current) return;
    let tentativas = 0;
    const t = window.setInterval(() => {
      tentativas += 1;
      const ocupado = tourAtivo || !!document.querySelector('[role="dialog"], [role="alertdialog"]');
      if (!ocupado) { jaAbriu.current = true; setAberta(true); window.clearInterval(t); }
      else if (tentativas > 15) window.clearInterval(t);
    }, 2000);
    return () => window.clearInterval(t);
  }, [elegivel, tourAtivo]);

  if (!elegivel && !aberta) return null;
  return <Folha aberta={aberta} onFechar={() => setAberta(false)} diasFora={dias ?? 0} />;
}

function Folha({ aberta, onFechar, diasFora }: { aberta: boolean; onFechar: () => void; diasFora: number }) {
  const navigate = useNavigate();
  const { profile, updateProfile } = useProfile();
  const { createPost } = usePosts();
  const { brandContext, hasBrandContext } = useBrandContext();
  const { startTour } = useTour();
  const comunidade = useAbrirComunidade();
  const enviarFeedback = useSendFeedback();
  const qc = useQueryClient();

  const [tela, setTela] = useState<Tela>("pergunta");
  const [respondeu, setRespondeu] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [ideias, setIdeias] = useState<AISuggestion[]>([]);
  const [rapido, setRapido] = useState<PostRapido | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [avisar, setAvisar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [metaBaixada, setMetaBaixada] = useState(false);
  const [diaLembrete, setDiaLembrete] = useState<number>(() => new Date().getDay());
  const [lembreteFeito, setLembreteFeito] = useState(false);

  const p = profile as { platforms?: string[] | null; niche?: string | null; weekly_goal?: number | null; notification_prefs?: Record<string, unknown> | null } | null;
  const rede = formatoPelaRede(p?.platforms?.[0]);
  const paramsIA = { formato: rede.ia, platform: rede.platform, niche: p?.niche ?? undefined, brandContext: hasBrandContext ? brandContext : undefined };

  const registrar = async (motivo: MotivoVolta | "agora_nao", detalhe?: string, querAviso?: boolean) => {
    // Já respondeu: a folha não volta nesta sessão nem ao reabrir o Início.
    qc.setQueryData<Status | null>(["volta-status", profile?.id], (s) => (s ? { ...s, perguntou_recente: true } : s));
    const { error } = await sbRpc("registrar_volta", { _motivo: motivo, _dias_fora: diasFora, _detalhe: detalhe ?? null, _avisar: !!querAviso });
    if (error) throw new Error(error.message);
  };

  const agoraNao = () => {
    if (!respondeu) void registrar("agora_nao").catch(() => { /* não segura a pessoa */ });
    onFechar();
  };

  const gerarIdeias = async () => {
    setCarregando(true); setErro(null);
    try {
      let lista = parseSuggestions(await getVoltaIdeias(paramsIA));
      if (lista.length === 0) lista = parseSuggestions(await getVoltaIdeias(paramsIA));
      if (lista.length === 0) setErro("A Cria IA respondeu fora do formato. Tenta de novo.");
      setIdeias(lista.slice(0, 3));
    } catch (e) { setErro(erroIA(e)); }
    finally { setCarregando(false); }
  };

  const gerarRapido = async () => {
    setCarregando(true); setErro(null);
    try {
      const r = await getPostRapido(paramsIA);
      if (!r) setErro("A Cria IA respondeu fora do formato. Tenta de novo.");
      setRapido(r);
    } catch (e) { setErro(erroIA(e)); }
    finally { setCarregando(false); }
  };

  const escolher = (motivo: MotivoVolta) => {
    setTela(motivo); setRespondeu(true); setErro(null);
    void registrar(motivo).catch(() => { /* a ajuda segue mesmo se o registro falhar */ });
    if (motivo === "sem_ideia") void gerarIdeias();
    if (motivo === "sem_tempo") void gerarRapido();
  };

  /* Cria o post de amanhã e abre o editor. */
  const abrirPost = async (dados: { title: string; hook?: string; script?: string; caption?: string; cta?: string }) => {
    try {
      const post = await createPost.mutateAsync({
        title: dados.title.slice(0, 120), status: "ideia", platform: rede.platform, format: rede.format,
        scheduled_date: somarDias(hojeBR(), 1),
        hook: dados.hook || null, script: dados.script || null, caption: dados.caption || null, cta: dados.cta || null,
      } as never);
      onFechar();
      navigate(`/app/criando?post=${post.id}`);
    } catch { toast.error("Não consegui criar o post. Tenta de novo."); }
  };

  const baixarMeta = async () => {
    try { await updateProfile.mutateAsync({ weekly_goal: 1 } as never); setMetaBaixada(true); }
    catch { toast.error("Não consegui mudar a meta."); }
  };

  const lembrar = async () => {
    try {
      await updateProfile.mutateAsync({ notification_prefs: { ...(p?.notification_prefs ?? {}), lembrete_criar_dia: diaLembrete } } as never);
      setLembreteFeito(true);
    } catch { toast.error("Não consegui salvar o lembrete."); }
  };

  const enviarTexto = async (motivo: "faltou_funcao" | "outro") => {
    const msg = texto.trim();
    if (!msg) return;
    try {
      await enviarFeedback.mutateAsync({ type: motivo === "faltou_funcao" ? "ideia" : "outro", message: msg, origin: "volta" });
      await registrar(motivo, msg, motivo === "faltou_funcao" && avisar);
      setEnviado(true);
    } catch { /* o hook já avisou */ }
  };

  const fazerTour = () => {
    onFechar();
    navigate("/app/criando");
    window.setTimeout(() => startTour("criando"), 800);
  };

  const voltar = <button type="button" onClick={() => { setTela("pergunta"); setErro(null); }}
    className="inline-flex items-center gap-1 text-[13px] font-body font-bold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</button>;

  const botao = "inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-foreground px-4 h-11 text-[13.5px] font-body font-extrabold disabled:opacity-60";
  const cheio = "bg-[#2D4A2B] border-[#2D4A2B] text-white";

  return (
    <Drawer open={aberta} onOpenChange={(o) => { if (!o) agoraNao(); }}>
      <DrawerContent className="border-t-2 border-foreground bg-[#F4EFE3] dark:bg-card md:mx-auto md:max-w-[460px] max-h-[92dvh]">
        <div className="overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
          {tela === "pergunta" && (
            <>
              <DrawerTitle className="font-display font-extrabold text-[23px] leading-tight text-foreground">Que bom te ver. O que travou nesses dias?</DrawerTitle>
              <DrawerDescription className="mt-1.5 mb-3.5 text-[14px] font-body text-muted-foreground">Um toque, e eu te ajudo com isso agora.</DrawerDescription>
              <div className="flex flex-col gap-2">
                {OPCOES.map((o) => (
                  <button key={o.motivo} type="button" onClick={() => escolher(o.motivo)}
                    className="flex items-center gap-2.5 rounded-2xl border-2 border-border bg-card px-3 py-[11px] text-left text-[15px] font-body font-bold text-foreground active:border-foreground active:bg-[#FFF1EA]">
                    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] text-[#0A0A0A]" style={{ background: o.cor }}>{o.icone}</span>
                    {o.rotulo}
                  </button>
                ))}
              </div>
              <button type="button" onClick={agoraNao} className="mt-3 w-full text-center text-[12.5px] font-body text-muted-foreground underline-offset-2 hover:underline">
                Agora não · pergunto de novo só daqui a 30 dias
              </button>
            </>
          )}

          {tela !== "pergunta" && <div className="mb-2">{voltar}</div>}

          {tela === "sem_ideia" && (
            <Cartao titulo="Separei 3 ideias pro seu nicho. Escolhe uma e eu marco pra amanhã."
              sub={`Feitas pela Cria IA com o seu Brandbook${p?.niche ? ` (${p.niche.split(",")[0].trim()})` : ""}.`}>
              {carregando ? <Carregando texto="Pensando nas ideias..." /> : erro ? <Erro texto={erro} /> : (
                <div className="mt-2 flex flex-col gap-2">
                  {ideias.map((s, i) => (
                    <button key={`${s.titulo}-${i}`} type="button" disabled={createPost.isPending}
                      onClick={() => void abrirPost({ title: s.titulo, hook: s.gancho, cta: s.cta, script: s.estrutura?.map((x) => `- ${x}`).join("\n") })}
                      className="flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-border bg-card p-2.5 text-left text-[14px] font-body font-bold text-foreground active:border-foreground disabled:opacity-60">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: CORES_IDEIA[i % 3] }} />
                      {s.titulo}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3.5 flex gap-2">
                <button type="button" onClick={() => void gerarIdeias()} disabled={carregando} className={cn(botao, "flex-1 bg-card")}>
                  <RefreshCw className="h-4 w-4" /> Gerar outras</button>
              </div>
              {!carregando && ideias.length > 0 && <p className="mt-2 text-[12px] font-body text-muted-foreground">Toque numa ideia: ela vira post de amanhã e o editor abre.</p>}
            </Cartao>
          )}

          {tela === "sem_tempo" && (
            <>
              <Cartao titulo="Um post de 5 minutos, pra hoje." sub="Formato curto, roteiro em 3 linhas e a legenda pronta.">
                {carregando ? <Carregando texto="Escrevendo o roteiro..." /> : erro ? <Erro texto={erro} /> : rapido && (
                  <div className="mt-2 space-y-2 text-[13.5px] font-body text-foreground">
                    <p className="font-bold">{rapido.titulo}</p>
                    <ol className="list-decimal space-y-1 pl-5">{rapido.roteiro.map((l, i) => <li key={i}>{l}</li>)}</ol>
                    {rapido.legenda && <p className="rounded-xl bg-[#FFF1EA] dark:bg-orange-500/10 px-3 py-2 text-[13px]">{rapido.legenda}</p>}
                  </div>
                )}
                <div className="mt-3.5 flex gap-2">
                  <button type="button" onClick={() => void gerarRapido()} disabled={carregando} className={cn(botao, "bg-card")}><RefreshCw className="h-4 w-4" /></button>
                  <button type="button" disabled={!rapido || carregando || createPost.isPending}
                    onClick={() => rapido && void abrirPost({ title: rapido.titulo, hook: rapido.roteiro[0], script: rapido.roteiro.map((l) => `- ${l}`).join("\n"), caption: rapido.legenda })}
                    className={cn(botao, cheio, "flex-1")}><Sparkles className="h-4 w-4" /> Criar e abrir</button>
                </div>
              </Cartao>
              <div className="mt-3 flex flex-col gap-2">
                {(p?.weekly_goal ?? 0) > 1 && (
                  <button type="button" onClick={() => void baixarMeta()} disabled={metaBaixada || updateProfile.isPending}
                    className="flex items-center gap-2.5 rounded-2xl border-2 border-border bg-card px-3 py-[11px] text-left text-[14px] font-body font-bold disabled:opacity-70">
                    <Target className="h-4 w-4 shrink-0" />
                    {metaBaixada ? "Pronto: sua meta agora é 1 post por semana." : "Baixar minha meta pra 1 por semana"}
                  </button>
                )}
                <div className="rounded-2xl border-2 border-border bg-card px-3 py-[11px]">
                  <p className="flex items-center gap-2 text-[14px] font-body font-bold"><Bell className="h-4 w-4 shrink-0" />
                    {lembreteFeito ? `Combinado: toda ${DIAS_SEMANA[diaLembrete]} de manhã eu te lembro de criar.` : "Me lembrar de manhã de criar, toda:"}</p>
                  {!lembreteFeito && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {DIAS_SEMANA.map((d, i) => (
                        <button key={d} type="button" onClick={() => setDiaLembrete(i)} aria-pressed={diaLembrete === i}
                          className={cn("rounded-full border-2 px-2.5 h-8 text-[12px] font-body font-bold", diaLembrete === i ? "border-foreground bg-[#FFF1EA]" : "border-border")}>
                          {d.slice(0, 3)}</button>
                      ))}
                      <button type="button" onClick={() => void lembrar()} disabled={updateProfile.isPending}
                        className="ml-auto rounded-full border-2 border-foreground bg-foreground px-3 h-8 text-[12px] font-body font-bold text-background">Salvar</button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {tela === "nao_entendi" && (
            <Cartao titulo="Bora junto, em 60 segundos." sub="O tour do Criando mostra o caminho de uma ideia até o post publicado.">
              <div className="mt-3 flex flex-col gap-2">
                <button type="button" onClick={fazerTour} className={cn(botao, cheio)}><Sparkles className="h-4 w-4" /> Fazer o tour do Criando</button>
                <button type="button" onClick={() => { onFechar(); navigate("/app/tutoriais"); }} className={cn(botao, "bg-card")}><CirclePlay className="h-4 w-4" /> Ver os tutoriais em vídeo</button>
                {comunidade.url && (
                  <button type="button" onClick={() => comunidade.abrir()} className={cn(botao, "bg-card")}><IconeComunidade className="h-4 w-4" /> Tirar dúvida na comunidade</button>
                )}
              </div>
            </Cartao>
          )}

          {(tela === "faltou_funcao" || tela === "outro") && (
            enviado ? (
              <Cartao titulo={tela === "faltou_funcao" ? "Anotado. Vai direto pra quem decide o que entra no Cria." : "Obrigado por contar."}
                sub={tela === "faltou_funcao" && avisar ? "Quando sair, eu te aviso." : "Bora recomeçar?"}>
                <button type="button" onClick={() => { onFechar(); navigate("/app/criando"); }} className={cn(botao, cheio, "mt-3 w-full")}><Plus className="h-4 w-4" /> Novo post</button>
              </Cartao>
            ) : (
              <Cartao titulo={tela === "faltou_funcao" ? "O que você queria fazer?" : "Me conta o que aconteceu."}
                sub={tela === "faltou_funcao" ? "Uma frase já ajuda. Cai direto no painel de quem constrói o Cria." : "Pode ser curto. Eu leio tudo."}>
                <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 2000))} rows={4} autoFocus
                  placeholder={tela === "faltou_funcao" ? "Ex.: queria agendar direto no TikTok" : "Escreva aqui"}
                  className="mt-2 w-full rounded-xl border-2 border-border bg-card p-3 text-[15px] font-body focus:border-foreground focus:outline-none" />
                {tela === "faltou_funcao" && (
                  <label className="mt-2 flex items-center gap-2 text-[13.5px] font-body">
                    <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="h-4 w-4 accent-[#EA4918]" />
                    Me avisa quando sair
                  </label>
                )}
                <button type="button" onClick={() => void enviarTexto(tela)} disabled={!texto.trim() || enviarFeedback.isPending} className={cn(botao, cheio, "mt-3 w-full")}>
                  {enviarFeedback.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar</button>
              </Cartao>
            )
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Cartao({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="rounded-[20px] border-2 border-foreground bg-card p-3.5">
      <DrawerTitle className="font-display font-extrabold text-[18px] leading-tight text-foreground">{titulo}</DrawerTitle>
      {sub ? <DrawerDescription className="mt-1.5 text-[13.5px] font-body text-muted-foreground">{sub}</DrawerDescription> : null}
      {children}
    </div>
  );
}

const Carregando = ({ texto }: { texto: string }) => (
  <p className="mt-3 flex items-center gap-2 text-[13.5px] font-body text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {texto}</p>
);
const Erro = ({ texto }: { texto: string }) => <p className="mt-3 text-[13.5px] font-body text-[#B4441A]">{texto}</p>;
