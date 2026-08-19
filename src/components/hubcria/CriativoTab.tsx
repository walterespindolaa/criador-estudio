import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Sparkles, X, Instagram, Play, LayoutGrid, FileText, User, AtSign, Hash,
  Megaphone, TrendingUp, Plus, HelpCircle, Clock, CheckCircle2, AlertTriangle, ArrowRight, Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useScrapes, useCreativeIdeas, useRunScrape, useUpdateIdeaStatus, useDeleteIdea, useDeleteScrape,
  useGeneratePlanFromIdeas, useHubCredits, useMoveScrape, useCopyScrapeToClient, useIdeaFromReference,
  useCompetitors, useAddCompetitor, useDeleteCompetitor, diasSemLeitura,
  type ScrapeType, type CreativeIdea, type CompetitorScrape,
} from "@/hooks/useHubCria";
import { useCrmClients } from "@/hooks/useCrm";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { CRIA_HEX } from "@/lib/moduleTheme";
import { useExternalClients } from "@/hooks/useCriaPost";
import { supabase } from "@/integrations/supabase/client";
import { confirmar } from "@/components/shared/Confirm";
import { SummaryCard, IdeaCard, haQuanto, type Referencia } from "@/components/hubcria/ResultadoPesquisa";
import {
  PESQUISAS, PESQUISA_POR_TIPO, GRUPOS, sugerirParaSegmento,
  type PesquisaDef, type GrupoRadar,
} from "@/lib/radar-catalogo";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA RADAR

   O que estava errado e por que a tela mudou inteira:

   1. Oito caixinhas marcáveis ao mesmo tempo, e UM formulário genérico embaixo
      com todos os campos possíveis. Marcava três tipos e apareciam cinco campos
      sem dizer qual servia pra qual. Agora é UMA pesquisa por vez, com o
      formulário DELA e as perguntas DELA.

   2. Ninguém sabia o que ia receber antes de gastar crédito. Agora cada
      pesquisa mostra a entrega item por item, o tempo e o que precisa em mãos,
      antes do clique.

   3. Tela em branco no cliente novo: a pessoa abria e não sabia por onde
      começar. Agora o segmento da ficha vira um roteiro de 3 ou 4 leituras.

   4. O histórico só mostrava o que deu certo. Leitura com erro sumia da tela
      (e não dava pra apagar), leitura rodando desaparecia no refresh. Agora
      aparece tudo, com o estado de cada uma.
   ═══════════════════════════════════════════════════════════════════════════ */

const ICONE: Record<string, typeof LayoutGrid> = {
  posts: LayoutGrid, reels: Play, transcription: FileText,
  comments: Instagram, hashtag: Hash, mentions: AtSign,
  ads: Megaphone, profile: User,
};

type FormState = {
  handle: string;
  url: string;
  hashtag: string;
  limit: number;
  since: string;
  reelLinks: string[];
};

const FORM_VAZIO: FormState = { handle: "", url: "", hashtag: "", limit: 10, since: "", reelLinks: [""] };

export function CriativoTab({ clientId, clientName }: { clientId?: string; clientName?: string }) {
  const [tipoSel, setTipoSel] = useState<ScrapeType>("posts");
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [running, setRunning] = useState<string | null>(null);
  const [comoOpen, setComoOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const def = PESQUISA_POR_TIPO[tipoSel] as PesquisaDef;

  const { data: scrapes = [] } = useScrapes(clientId);
  const { data: ideas = [] } = useCreativeIdeas(clientId);
  const { data: carteira = [] } = useCrmClients();
  const run = useRunScrape();
  const upd = useUpdateIdeaStatus();
  const del = useDeleteIdea();
  const delScrape = useDeleteScrape();
  const genPlan = useGeneratePlanFromIdeas();
  const mover = useMoveScrape();
  const copiar = useCopyScrapeToClient();
  const refPauta = useIdeaFromReference();
  const { clients: extClients } = useExternalClients();
  const extClient = clientId ? extClients.find((c: { crm_client_id?: string | null }) => c.crm_client_id === clientId) : null;

  // O nicho vem do campo Segmento da ficha, que é texto livre. É ele que
  // transforma "escolha uma das oito" em "pro seu cliente, comece por aqui".
  const clienteAtual = clientId ? carteira.find((c) => c.id === clientId) : null;
  const sugestao = useMemo(() => sugerirParaSegmento(clienteAtual?.segment), [clienteAtual?.segment]);
  const temSegmento = !!(clienteAtual?.segment || "").trim();

  const outrosClientes = useMemo(
    () => carteira.filter((c) => c.id !== clientId).map((c) => ({ id: c.id, nome: c.display_name || c.name })),
    [carteira, clientId],
  );

  // ── saldo ───────────────────────────────────────────────────────────────
  const { data: credits } = useHubCredits();
  const creditsError = credits?.error === true;
  const quota = credits?.quota ?? 0;
  const usados = credits?.used ?? 0;
  const restantes = Math.max(0, quota - usados);
  const pctUso = quota > 0 ? Math.min(100, Math.round((usados / quota) * 100)) : 0;
  const custo = def.creditos;

  const [comprandoExtra, setComprandoExtra] = useState(false);
  const comprarExtra = async () => {
    setComprandoExtra(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-module-checkout", { body: { module_code: "hub_extra" } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("checkout sem URL");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui abrir o checkout.");
      setComprandoExtra(false);
    }
  };

  // ── radar de concorrentes ───────────────────────────────────────────────
  const { data: competidores = [] } = useCompetitors(clientId);
  const addComp = useAddCompetitor();
  const delComp = useDeleteCompetitor();
  const [compSel, setCompSel] = useState<string | null>(null);
  const [novoComp, setNovoComp] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const compAtivo = competidores.find((c) => c.id === compSel) ?? null;
  useEffect(() => {
    if (compAtivo) setForm((f) => ({ ...f, handle: "@" + compAtivo.handle }));
  }, [compAtivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── formulário ──────────────────────────────────────────────────────────
  const campos = def.campos;
  const usa = (id: string) => campos.some((c) => c.id === id);
  const linksValidos = form.reelLinks.map((l) => l.trim()).filter(Boolean);

  const escolher = (t: ScrapeType, valor?: string) => {
    setTipoSel(t);
    // Trocar de pesquisa NÃO pode limpar o @ que a pessoa acabou de digitar: é o
    // dado que ela mais reaproveita entre uma leitura e outra.
    setForm((f) => ({
      ...f,
      hashtag: valor && PESQUISA_POR_TIPO[t]?.campos.some((c) => c.id === "hashtag") ? valor : f.hashtag,
    }));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };

  /** O valor que vai pra edge, conforme o tipo. */
  const valorDeEntrada = (): string => {
    if (tipoSel === "transcription") return linksValidos.length > 0 ? linksValidos.join(",") : form.handle.trim();
    if (usa("url")) return form.url.trim();
    if (usa("hashtag")) return form.hashtag.trim().replace(/^#/, "");
    return form.handle.trim();
  };

  const faltando = (): string | null => {
    if (def.exigeUmDe) {
      const ok = def.exigeUmDe.some((id) => (id === "reelLinks" ? linksValidos.length > 0 : String(form[id as keyof FormState] || "").trim()));
      if (!ok) return "Preencha o @ do perfil ou cole ao menos um link de reel.";
      return null;
    }
    for (const c of campos) {
      if (!c.obrigatorio) continue;
      const v = c.id === "reelLinks" ? (linksValidos.length ? "x" : "") : String(form[c.id as keyof FormState] ?? "").trim();
      if (!v) return `Falta responder: ${c.label}`;
    }
    return null;
  };

  const pesquisar = async () => {
    if (creditsError) { toast.error("Não consegui conferir seu saldo de créditos agora. Tente de novo em instantes."); return; }
    const falta = faltando();
    if (falta) { toast.error(falta); return; }
    setRunning(def.nome);
    try {
      await run.mutateAsync({
        type: tipoSel,
        input: valorDeEntrada(),
        crm_client_id: clientId,
        // Amarrar a leitura ao concorrente do radar é o que permite o
        // "sem leitura há 31 dias" depois.
        competitor_id: compAtivo && usa("handle") && tipoSel !== "hashtag" ? compAtivo.id : null,
        limit: usa("limit") ? form.limit : undefined,
        since: usa("since") && form.since ? form.since : undefined,
      });
    } catch { /* toast já no hook */ }
    setRunning(null);
  };

  const rodarDeNovo = (s: CompetitorScrape) => {
    setTipoSel(s.scrape_type);
    const d = PESQUISA_POR_TIPO[s.scrape_type];
    const alvo = s.input_handle || "";
    setForm((f) => ({
      ...f,
      handle: d?.campos.some((c) => c.id === "handle") && !alvo.startsWith("http") ? alvo : f.handle,
      url: d?.campos.some((c) => c.id === "url") ? alvo : f.url,
      hashtag: d?.campos.some((c) => c.id === "hashtag") ? alvo : f.hashtag,
    }));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    toast.info("Formulário preenchido. Confira e mande pesquisar.");
  };

  const salvarReferencia = (scrapeId: string) => (r: Referencia) => {
    if (!clientId) { toast.error("Pesquisa avulsa não tem cliente. Mova ela pra um cliente antes de salvar a pauta."); return; }
    refPauta.mutate({ crm_client_id: clientId, scrape_id: scrapeId, ...r });
  };

  // ── histórico ───────────────────────────────────────────────────────────
  const ideasByScrape = useMemo(() => {
    const m: Record<string, CreativeIdea[]> = {};
    for (const idea of ideas) {
      const k = (idea as { scrape_id?: string | null }).scrape_id || "__orphan__";
      (m[k] ||= []).push(idea);
    }
    return m;
  }, [ideas]);
  const orphanIdeas = ideasByScrape["__orphan__"] || [];

  const prontas = useMemo(() => scrapes.filter((s) => s.status === "done" && s.result_summary), [scrapes]);
  // Leituras que falharam ou ficaram penduradas eram INVISÍVEIS: sumiam da tela
  // e não davam pra apagar. A pessoa achava que o módulo tinha comido o crédito.
  const pendentes = useMemo(
    () => scrapes.filter((s) => s.status === "error" || ((s.status === "queued" || s.status === "running") && Date.now() - new Date(s.created_at).getTime() < 30 * 60 * 1000)),
    [scrapes],
  );

  return (
    <div className="space-y-5">
      {/* ═══ CABEÇALHO ═══ */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5">
        <OrganicBlobs color="lilas" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 mb-2">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-[10px] font-body font-bold uppercase tracking-wider">Cria Radar</span>
            </span>
            <h2 className="font-display text-xl font-extrabold text-foreground tracking-tight">
              Chegue na pauta com informação, não com achismo
            </h2>
            <p className="text-[13px] font-body text-muted-foreground mt-1 leading-relaxed max-w-xl">
              O CRIA lê o concorrente de verdade: o que engajou, o roteiro do reel que bombou e os
              anúncios que ele <strong>paga</strong> pra rodar. Devolve <strong>pautas prontas</strong>
              {clientName ? ` pro ${clientName}` : " pro seu cliente"}.
            </p>
            <button
              onClick={() => setComoOpen((v) => !v)}
              className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-display font-bold text-primary hover:underline"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {comoOpen ? "Fechar" : "Como funciona e o que cada pesquisa entrega"}
            </button>
          </div>

          {quota > 0 && (
            <div className="relative w-full sm:w-auto sm:shrink-0 rounded-2xl border border-border bg-background/70 backdrop-blur-sm px-4 py-3 sm:min-w-[168px]">
              <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">Créditos deste mês</p>
              <p className="font-display text-2xl font-extrabold text-foreground tabular-nums leading-none mt-1">
                {restantes}<span className="text-sm font-bold text-muted-foreground">/{quota}</span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", restantes === 0 ? "bg-destructive" : pctUso > 80 ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${100 - pctUso}%` }}
                />
              </div>
              {pctUso >= 80 && (
                <button
                  onClick={comprarExtra}
                  disabled={comprandoExtra}
                  className="mt-2 w-full rounded-lg bg-primary px-2 py-1.5 text-[11px] font-display font-bold text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
                >
                  {comprandoExtra ? "Abrindo…" : restantes === 0 ? "Acabou · +20 por R$ 24,90" : "+20 créditos · R$ 24,90"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ COMO FUNCIONA ═══
          Ficava só numa frase de tooltip, que no celular não existe. Agora é um
          bloco que a pessoa abre quando quer e some quando não quer. */}
      {comoOpen && <ComoFunciona onEscolher={(t) => { setComoOpen(false); escolher(t); }} />}

      {/* ═══ POR ONDE COMEÇAR NESTE CLIENTE ═══ */}
      {clientId && (
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-start gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${CRIA_HEX.lilas}1f`, color: CRIA_HEX.lilas }}>
              <Target className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-display font-extrabold text-foreground">
                Por onde começar {temSegmento ? `em ${sugestao.nome.toLowerCase()}` : "neste cliente"}
              </h3>
              <p className="text-[12.5px] font-body text-muted-foreground leading-relaxed mt-0.5">
                {temSegmento
                  ? sugestao.frase
                  : "O segmento deste cliente está vazio na ficha. Preencha em Informações e as sugestões ficam do nicho dele."}
              </p>
            </div>
          </div>

          <ol className="mt-4 space-y-2">
            {sugestao.passos.map((p, i) => {
              const d = PESQUISA_POR_TIPO[p.tipo];
              const Icon = ICONE[p.tipo] ?? LayoutGrid;
              return (
                <li key={i}>
                  <button
                    onClick={() => escolher(p.tipo, p.valor)}
                    className="group flex w-full items-start gap-3 rounded-2xl border border-border bg-background/60 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted font-display text-[12px] font-extrabold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-[13px] font-display font-bold text-foreground">{p.titulo}</span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-body font-bold text-muted-foreground">
                          {d?.creditos ?? 1} {(d?.creditos ?? 1) === 1 ? "crédito" : "créditos"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[12px] font-body text-muted-foreground leading-snug">{p.motivo}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 self-center text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                </li>
              );
            })}
          </ol>

          {sugestao.hashtags.length > 0 && (
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">Hashtags do nicho:</span>
              {sugestao.hashtags.map((h) => (
                <button
                  key={h}
                  onClick={() => escolher("hashtag", h)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11.5px] font-body font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  #{h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ RODANDO ═══ */}
      {running && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] px-4 py-3.5">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
          <div className="min-w-0">
            <p className="text-[13px] font-display font-bold text-foreground">Pesquisando: {running}</p>
            <p className="text-[12px] font-body text-muted-foreground leading-tight">
              Estamos lendo o perfil de verdade. Leva {def.tempo}. Pode deixar a aba aberta.
            </p>
          </div>
        </div>
      )}

      {/* ═══ CONCORRENTES DO CLIENTE ═══ */}
      {clientId && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
              Concorrentes deste cliente
            </p>
            {competidores.length > 0 && !addOpen && (
              <button onClick={() => setAddOpen(true)} className="text-[12px] font-body font-bold text-primary hover:underline">
                + adicionar
              </button>
            )}
          </div>

          {addOpen && (
            <div className="flex gap-2 mb-3">
              <Input
                autoFocus
                value={novoComp}
                onChange={(e) => setNovoComp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && novoComp.trim()) {
                    addComp.mutate({ handle: novoComp, crm_client_id: clientId },
                      { onSuccess: () => { setNovoComp(""); setAddOpen(false); } });
                  }
                  if (e.key === "Escape") { setNovoComp(""); setAddOpen(false); }
                }}
                placeholder="@concorrente"
                className="h-10 max-w-xs"
              />
              <Button
                size="sm" className="h-10"
                disabled={!novoComp.trim() || addComp.isPending}
                onClick={() => addComp.mutate({ handle: novoComp, crm_client_id: clientId },
                  { onSuccess: () => { setNovoComp(""); setAddOpen(false); } })}
              >
                {addComp.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Adicionar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-10" onClick={() => { setNovoComp(""); setAddOpen(false); }}>
                Cancelar
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {competidores.map((c) => {
              const dias = diasSemLeitura(c);
              const on = compSel === c.id;
              const frio = dias != null && dias >= 21;
              return (
                <button
                  key={c.id}
                  onClick={() => setCompSel(on ? null : c.id)}
                  className={cn(
                    "group relative text-left rounded-2xl border-2 bg-card p-3.5 transition-all hover:-translate-y-0.5",
                    on ? "shadow-sm" : "border-border hover:border-primary/40",
                  )}
                  style={on ? { borderColor: CRIA_HEX.lilas, background: `${CRIA_HEX.lilas}0a` } : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display font-extrabold text-[13px] text-white"
                      style={{ background: `linear-gradient(135deg, ${CRIA_HEX.lilas}, #a6b4f6)` }}
                    >
                      {c.handle.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-display font-bold text-foreground truncate">@{c.handle}</span>
                      <span className="block text-[11.5px] font-body text-muted-foreground truncate">
                        {dias == null ? "Nunca foi lido" : frio ? `Sem leitura há ${dias} dias` : `Lido ${haQuanto(c.last_read_at!)}`}
                      </span>
                    </span>
                  </div>

                  {(frio || dias == null) && (
                    <span className="inline-block mt-2 text-[10px] font-body font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700">
                      {dias == null ? "esperando a 1ª leitura" : "esfriando"}
                    </span>
                  )}

                  <span
                    role="button"
                    tabIndex={0}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (await confirmar({ titulo: `Tirar @${c.handle} do radar?`, descricao: "As leituras que você já fez dele continuam no histórico.", acao: "Tirar do radar" })) delComp.mutate(c.id);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive transition-colors"
                    aria-label="Tirar do radar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}

            {competidores.length === 0 && !addOpen && (
              <button
                onClick={() => setAddOpen(true)}
                className="rounded-2xl border-2 border-dashed border-border bg-card p-5 text-center transition-colors hover:border-primary/40"
              >
                <Plus className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <span className="block text-[13px] font-display font-bold text-foreground">Adicionar o 1º concorrente</span>
                <span className="block text-[11.5px] font-body text-muted-foreground mt-0.5">
                  Ele fica salvo neste cliente. Você não digita o @ de novo.
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ NOVA PESQUISA ═══ */}
      <div ref={formRef} className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border/60 px-4 sm:px-5 py-4">
          <p className="text-sm font-display font-extrabold text-foreground">
            1. O que você quer descobrir
            {compAtivo && <span className="text-primary"> sobre @{compAtivo.handle}</span>}?
          </p>
          <p className="text-[12px] font-body text-muted-foreground mt-0.5">
            Uma pesquisa por vez. Cada uma responde uma pergunta diferente.
          </p>

          <div className="mt-3.5 space-y-3.5">
            {GRUPOS.map((g) => (
              <div key={g.id}>
                <p className="text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">{g.nome}</p>
                <p className="text-[11.5px] font-body text-muted-foreground mb-2 leading-snug">{g.frase}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {PESQUISAS.filter((p) => p.grupo === (g.id as GrupoRadar)).map((p) => {
                    const on = tipoSel === p.key;
                    const Icon = ICONE[p.key] ?? LayoutGrid;
                    return (
                      <button
                        key={p.key}
                        onClick={() => escolher(p.key)}
                        className={cn(
                          "rounded-2xl border-2 p-3 text-left transition-all",
                          on ? "shadow-sm" : "border-border bg-background/50 hover:border-primary/40",
                        )}
                        style={on ? { borderColor: CRIA_HEX.lilas, background: `${CRIA_HEX.lilas}0f` } : undefined}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" style={on ? { color: CRIA_HEX.lilas } : undefined} />
                          <span className="min-w-0 flex-1 text-[13px] font-display font-bold text-foreground">{p.nome}</span>
                          <span
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                            style={on ? { background: `${CRIA_HEX.lilas}26`, color: "#4a5cc0" } : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                          >
                            {p.creditos}
                          </span>
                        </span>
                        <span className="mt-1 block text-[11.5px] font-body text-muted-foreground leading-snug">{p.pergunta}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* O QUE VOCÊ RECEBE, antes do gasto. */}
        <div className="grid gap-4 border-b border-border/60 px-4 sm:px-5 py-4 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-1.5">O que você recebe</p>
            <ul className="space-y-1">
              {def.entrega.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12.5px] font-body text-foreground leading-snug">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
            {!def.geraPautas && (
              <p className="mt-2 text-[11.5px] font-body text-muted-foreground">Esta pesquisa não gera pautas automáticas.</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="flex items-start gap-1.5 text-[12.5px] font-body text-muted-foreground leading-snug">
              <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Leva {def.tempo}. Você precisa de: {def.precisa}
            </p>
            {def.limite && (
              <p className="flex items-start gap-1.5 text-[12.5px] font-body text-amber-700 leading-snug">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {def.limite}
              </p>
            )}
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-[12px] font-body text-muted-foreground leading-snug">
              <strong className="font-display text-foreground">Quando usar:</strong> {def.exemplo}
            </p>
          </div>
        </div>

        {/* O FORMULÁRIO DESTA PESQUISA, só os campos dela. */}
        <div className="px-4 sm:px-5 py-4 space-y-3.5">
          <p className="text-sm font-display font-extrabold text-foreground">2. Responda pra pesquisar</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campos.filter((c) => {
              if (c.id === "reelLinks") return false;
              // Campo condicional: some quando o campo que o torna inútil já
              // tem valor (ex.: quantidade de reels quando há links colados,
              // porque com links a quantidade é ignorada).
              if (c.ocultarSeTemValor === "reelLinks" && linksValidos.length > 0) return false;
              if (c.ocultarSeTemValor && c.ocultarSeTemValor !== "reelLinks"
                && String(form[c.ocultarSeTemValor as keyof FormState] ?? "").trim()) return false;
              return true;
            }).map((c) => (
              <Campo key={c.id} label={c.label} ajuda={c.ajuda}>
                {c.tipo === "numero" ? (
                  <Input
                    type="number" inputMode="numeric" min={c.min} max={c.max}
                    value={form.limit}
                    onChange={(e) => setForm((f) => ({ ...f, limit: Math.max(c.min ?? 1, Math.min(c.max ?? 20, Number(e.target.value) || (c.padrao ?? 10))) }))}
                    className="h-10"
                  />
                ) : c.tipo === "data" ? (
                  <Input type="date" value={form.since} onChange={(e) => setForm((f) => ({ ...f, since: e.target.value }))} className="h-10" />
                ) : (
                  <Input
                    value={String(form[c.id as keyof FormState] ?? "")}
                    onChange={(e) => setForm((f) => ({ ...f, [c.id]: e.target.value }))}
                    placeholder={c.placeholder}
                    className="h-10"
                  />
                )}
              </Campo>
            ))}
          </div>

          {usa("reelLinks") && (
            <div className="rounded-2xl border border-border bg-muted/20 p-3">
              <p className="text-[12px] font-display font-bold text-foreground">
                {campos.find((c) => c.id === "reelLinks")?.label}
              </p>
              <p className="text-[11.5px] font-body text-muted-foreground mb-2">
                {campos.find((c) => c.id === "reelLinks")?.ajuda}
              </p>
              <div className="space-y-2">
                {form.reelLinks.map((lnk, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={lnk}
                      onChange={(e) => setForm((f) => ({ ...f, reelLinks: f.reelLinks.map((x, idx) => (idx === i ? e.target.value : x)) }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (i === form.reelLinks.length - 1 && lnk.trim()) setForm((f) => ({ ...f, reelLinks: [...f.reelLinks, ""] }));
                        }
                      }}
                      placeholder="https://instagram.com/reel/..."
                      className="h-10 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, reelLinks: f.reelLinks.length <= 1 ? [""] : f.reelLinks.filter((_, idx) => idx !== i) }))}
                      className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-destructive"
                      aria-label="Remover link"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button" variant="outline" size="sm" className="h-9 mt-2 text-xs"
                onClick={() => setForm((f) => ({ ...f, reelLinks: [...f.reelLinks, ""] }))}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar link
              </Button>
              {linksValidos.length > 0 && (
                <p className="text-[11px] font-body text-secondary mt-1.5">
                  {linksValidos.length} {linksValidos.length === 1 ? "reel" : "reels"}: transcreve exatamente {linksValidos.length === 1 ? "esse" : "esses"}.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap pt-1">
            <Button onClick={pesquisar} disabled={!!running || creditsError || (quota > 0 && custo > restantes)} size="lg" className="w-full sm:w-auto">
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {running ? `Pesquisando…` : `Pesquisar${quota > 0 ? ` · ${custo} ${custo === 1 ? "crédito" : "créditos"}` : ""}`}
            </Button>
            {creditsError ? (
              <p className="text-[12px] font-body text-destructive">
                Não consegui conferir seu saldo de créditos agora. Recarregue a página e tente de novo antes de pesquisar.
              </p>
            ) : quota > 0 && custo > restantes ? (
              <p className="text-[12px] font-body text-destructive">
                Você tem {restantes} {restantes === 1 ? "crédito" : "créditos"} e esta pesquisa custa {custo}. Compre um pacote extra pra continuar.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* ═══ HISTÓRICO DESTE ESCOPO ═══ */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-display font-extrabold text-foreground">
            {clientId ? "Pesquisas deste cliente" : "Suas pesquisas avulsas"}
          </h3>
          <p className="text-[12px] font-body text-muted-foreground">
            Cada leitura, o que ela concluiu e o que virou pauta.
          </p>
        </div>

        {/* As que falharam ou ficaram penduradas. Elas existem, gastaram tempo e
            merecem aparecer: some da tela é o que faz a pessoa desconfiar. */}
        {pendentes.length > 0 && (
          <div className="mb-3 space-y-2">
            {pendentes.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-3">
                {s.status === "error"
                  ? <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-display font-bold text-foreground truncate">
                    {PESQUISA_POR_TIPO[s.scrape_type]?.nome ?? "Pesquisa"} · @{s.input_handle.replace(/^@/, "").slice(0, 30)}
                  </p>
                  <p className="text-[11.5px] font-body text-muted-foreground leading-snug">
                    {s.status === "error" ? (s.error || "Não completou.") : "Ainda rodando. Recarregue em um minuto."}
                  </p>
                </div>
                {s.status === "error" && (
                  <button onClick={() => rodarDeNovo(s)} className="shrink-0 text-[12px] font-display font-bold text-primary hover:underline">
                    tentar de novo
                  </button>
                )}
                <button
                  onClick={async () => { if (await confirmar({ titulo: "Apagar esta pesquisa?", acao: "Apagar" })) delScrape.mutate(s.id); }}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label="Apagar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {prontas.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-14 px-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-display font-bold text-foreground">Nada foi pesquisado ainda</p>
            <p className="text-[13px] font-body text-muted-foreground mt-1 max-w-sm mx-auto">
              {clientId
                ? "Comece pelo roteiro sugerido lá em cima. Em 2 minutos você tem pauta pronta."
                : "Escolha uma pesquisa e rode a primeira leitura."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {prontas.map((s, i) => (
              <SummaryCard
                key={s.id}
                summary={s.result_summary as Record<string, unknown>}
                handle={s.input_handle}
                quando={s.created_at}
                custo={s.cost_usd}
                defaultOpen={i === 0}
                onDelete={() => delScrape.mutate(s.id)}
                ideas={ideasByScrape[s.id] || []}
                onIdeaStatus={(id, status) => upd.mutate({ id, status })}
                onIdeaDelete={(id) => del.mutate(id)}
                clientes={outrosClientes}
                aoMover={(para) => mover.mutate({ id: s.id, para })}
                aoDuplicar={(para) => copiar.mutate({ scrape: s, para, ideas: ideasByScrape[s.id] || [] })}
                aoRodarDeNovo={() => rodarDeNovo(s)}
                aoUsarReferencia={clientId ? salvarReferencia(s.id) : undefined}
                aoCriarPosts={
                  clientId && extClient
                    ? () => genPlan.mutate({ externalClientId: (extClient as { id: string }).id, ideas: ideasByScrape[s.id] || [] })
                    : undefined
                }
                criandoPosts={genPlan.isPending}
              />
            ))}
          </div>
        )}

        {orphanIdeas.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Pautas sem pesquisa vinculada
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {orphanIdeas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onStatus={(id, status) => upd.mutate({ id, status })} onDelete={(id) => del.mutate(id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMO FUNCIONA

   Três passos e a tabela honesta das oito pesquisas. Quem paga por crédito
   precisa entender o módulo sem tutorial e sem tentativa e erro.
   ═══════════════════════════════════════════════════════════════════════════ */
function ComoFunciona({ onEscolher }: { onEscolher: (t: ScrapeType) => void }) {
  const passos = [
    { t: "Escolha o que quer descobrir", d: "Cada pesquisa responde uma pergunta. Você vê a entrega e o custo antes de gastar." },
    { t: "O CRIA lê o perfil de verdade", d: "Não é estimativa: é o post, o comentário e o anúncio como estão hoje no ar." },
    { t: "Vira pauta no seu cliente", d: "As pautas caem no banco de ideias dele. Marque as boas e vire post no cronograma." },
  ];
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {passos.map((p, i) => (
          <div key={i} className="rounded-2xl border border-border bg-background/60 p-3.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg font-display text-[12px] font-extrabold text-white" style={{ background: CRIA_HEX.lilas }}>
              {i + 1}
            </span>
            <p className="mt-2 text-[13px] font-display font-bold text-foreground leading-snug">{p.t}</p>
            <p className="mt-0.5 text-[12px] font-body text-muted-foreground leading-snug">{p.d}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 mb-2 text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
        As {PESQUISAS.length} pesquisas
      </p>
      <div className="space-y-2">
        {PESQUISAS.map((p) => {
          const Icon = ICONE[p.key] ?? LayoutGrid;
          return (
            <button
              key={p.key}
              onClick={() => onEscolher(p.key)}
              className="group flex w-full items-start gap-3 rounded-2xl border border-border bg-background/50 p-3 text-left transition-colors hover:border-primary/40"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-display font-bold text-foreground">{p.nome}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-body font-bold text-muted-foreground">
                    {p.creditos} {p.creditos === 1 ? "crédito" : "créditos"}
                  </span>
                  <span className="text-[11px] font-body text-muted-foreground">{p.tempo}</span>
                </span>
                <span className="mt-0.5 block text-[12px] font-body text-muted-foreground leading-snug">{p.pergunta}</span>
                <span className="mt-1 block text-[11.5px] font-body text-muted-foreground/80 leading-snug">
                  Você precisa de: {p.precisa}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 self-center text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Campo({ label, ajuda, children }: { label: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-display font-bold text-foreground mb-1">{label}</p>
      {children}
      {ajuda && <p className="text-[11px] font-body text-muted-foreground mt-1 leading-snug">{ajuda}</p>}
    </div>
  );
}
