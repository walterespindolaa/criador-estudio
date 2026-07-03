import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { Wand2, Loader2, Image as ImageIcon, Download, Trash2, Lock, Sparkles, Pencil, ArrowLeft, LayoutGrid, Type as TypeIcon, TrendingUp, Newspaper, Zap, Film, Clock, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { usePosts, type Post } from "@/hooks/usePosts";
import { useHiggsfieldJobs, useDraftArt, useGenerateArt, usePollJob, useDeleteJob, useHotThemes, useNewsHook, useReelsScript, type HfJob, type HfPage, type HotTheme, type NewsHook } from "@/hooks/useHiggsfield";

type Kind = "carrossel" | "foto" | "reels";
function formatKind(fmt: string | null | undefined): Kind {
  const f = (fmt || "").toLowerCase();
  if (f === "reels" || f === "video" || f === "shorts") return "reels";
  if (f === "carrossel") return "carrossel";
  return "foto";
}

const ASPECTS = [
  { v: "4:5", label: "4:5 (feed)" },
  { v: "1:1", label: "1:1 (quadrado)" },
  { v: "9:16", label: "9:16 (story)" },
];

type ContentBlocks = { tema?: string; roteiro?: string; midia?: string; legenda?: string };

function postSource(post: Post): string {
  const b = (post.content_blocks ?? null) as ContentBlocks | null;
  const caption = (post as unknown as { caption?: string | null }).caption ?? null;
  return [b?.tema, b?.roteiro, b?.legenda, caption].filter(Boolean).join("\n\n").trim();
}

export default function CriaEstudio() {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const [sp] = useSearchParams();

  const { posts, updatePost } = usePosts();
  const producing = useMemo(() => (posts ?? []).filter((p) => p.status === "gravando"), [posts]);

  const [postId, setPostId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("carrossel");
  const [title, setTitle] = useState(sp.get("ideia") ?? "");
  const [sourceContent, setSourceContent] = useState("");
  const [format, setFormat] = useState<"carrossel" | "estatico">("carrossel");
  const [slides, setSlides] = useState(6);
  const [aspect, setAspect] = useState("4:5");
  const [resolution, setResolution] = useState("1080p");

  // Passo de revisão: textos dos slides antes de gerar as imagens.
  const [draftPages, setDraftPages] = useState<HfPage[] | null>(null);
  const [enrich, setEnrich] = useState(false);

  // Reels: roteiro por segundos.
  const [reelSeconds, setReelSeconds] = useState(30);
  const [reelScript, setReelScript] = useState<string | null>(null);

  // Perplexity (admin-only) — duas abas fixas, cada uma guarda seu resultado.
  const [themes, setThemes] = useState<HotTheme[] | null>(null);
  const [news, setNews] = useState<NewsHook | null>(null);
  const [pplxTab, setPplxTab] = useState<"themes" | "news">("themes");

  const { data: jobs = [] } = useHiggsfieldJobs();
  const draft = useDraftArt();
  const gen = useGenerateArt();
  const poll = usePollJob();
  const del = useDeleteJob();
  const hot = useHotThemes();
  const newsHook = useNewsHook();
  const reels = useReelsScript();

  // Polling enquanto houver jobs em andamento.
  const runningIds = useMemo(() => jobs.filter((j) => j.status === "running").map((j) => j.id).join(","), [jobs]);
  useEffect(() => {
    if (!runningIds) return;
    const ids = runningIds.split(",");
    const t = setInterval(() => ids.forEach((id) => poll.mutate(id)), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningIds]);

  if (!isAdmin) {
    return (
      <div className="py-20 text-center">
        <Lock className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-body text-muted-foreground">Cria Estúdio é um recurso interno (admin).</p>
      </div>
    );
  }

  const selectPost = (post: Post) => {
    const k = formatKind(post.format);
    setPostId(post.id);
    setKind(k);
    setTitle(post.title || "");
    setSourceContent(postSource(post));
    setFormat(k === "carrossel" ? "carrossel" : "estatico");
    setDraftPages(null);
    setReelScript(null);
  };

  const useFreeTheme = () => {
    setPostId(null);
    setKind(format === "carrossel" ? "carrossel" : "foto");
    setSourceContent("");
    setDraftPages(null);
    setReelScript(null);
  };

  const montar = () => {
    if (!title.trim()) return;
    draft.mutate(
      { title: title.trim(), format, slides, source_content: sourceContent || undefined, post_id: postId || undefined, enrich },
      { onSuccess: (res) => setDraftPages(res.pages) },
    );
  };

  const gerarReels = () => {
    if (!title.trim()) return;
    reels.mutate(
      { title: title.trim(), seconds: reelSeconds, source_content: sourceContent || undefined, post_id: postId || undefined, enrich },
      { onSuccess: (res) => setReelScript(res.script) },
    );
  };

  // Salva o roteiro/conteúdo gerado de volta no card do post (content_blocks.roteiro).
  const saveRoteiro = (text: string) => {
    if (!postId) { toast.error("Selecione um post de Produzindo pra salvar no card."); return; }
    const post = producing.find((p) => p.id === postId);
    const blocks = { ...((post?.content_blocks as Record<string, unknown>) ?? {}), roteiro: text };
    updatePost.mutate({ id: postId, updates: { content_blocks: blocks } }, {
      onSuccess: () => toast.success("Roteiro salvo no post!"),
      onError: () => toast.error("Não consegui salvar no post."),
    });
  };

  const saveCarrosselRoteiro = () => {
    if (!draftPages) return;
    const text = draftPages.map((p, i) => `${i === 0 ? "Capa" : `Slide ${i + 1}`}: ${p.screen_text}`).join("\n");
    saveRoteiro(text);
  };

  const pickTheme = (t: HotTheme) => {
    useFreeTheme();
    setTitle(t.titulo);
    setThemes(null);
  };

  const useNewsTheme = () => {
    if (!news?.titulo) return;
    useFreeTheme();
    setTitle(news.titulo);
    setSourceContent([news.resumo, news.angulo ? `Ângulo: ${news.angulo}` : "", news.fonte ? `Fonte: ${news.fonte}` : ""].filter(Boolean).join("\n"));
    setNews(null);
  };

  const gerar = () => {
    if (!draftPages || draftPages.length === 0) return;
    gen.mutate(
      { title: title.trim(), format, slides, aspect_ratio: aspect, resolution, pages: draftPages, post_id: postId || undefined },
      { onSuccess: () => setDraftPages(null) },
    );
  };

  // Gera UMA imagem só (o slide i) — vira um job próprio, sem apagar a revisão.
  const [genOne, setGenOne] = useState<number | null>(null);
  const gerarUm = (i: number) => {
    if (!draftPages) return;
    const pg = draftPages[i];
    const label = i === 0 ? "capa" : `slide ${i + 1}`;
    setGenOne(i);
    gen.mutate(
      { title: `${title.trim()} — ${label}`, format: "estatico", slides: 1, aspect_ratio: aspect, resolution, pages: [pg], post_id: postId || undefined },
      { onSettled: () => setGenOne(null) },
    );
  };

  const editSlideText = (i: number, val: string) => {
    setDraftPages((prev) => prev ? prev.map((p, idx) => idx === i ? { ...p, screen_text: val } : p) : prev);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm shrink-0">
          <Wand2 className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Cria Estúdio</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Pega os posts em Produzindo + seu moodboard e gera o carrossel no Higgsfield. (interno)</p>
        </div>
      </div>

      {/* ── Origem do conteúdo ── */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider">1. De onde vem o conteúdo</p>

        {/* Posts em Produzindo */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-body font-semibold text-foreground">Do meu Criando · coluna Produzindo</p>
            <span className="text-[11px] font-body text-muted-foreground">({producing.length})</span>
          </div>
          {producing.length === 0 ? (
            <p className="text-[11px] font-body text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              Nenhum post em Produzindo. Mova um post pra coluna <strong>Produzindo</strong> no Criando pra ele aparecer aqui.
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {producing.map((p) => {
                const sel = postId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPost(p)}
                    className={cn("shrink-0 w-52 text-left rounded-xl border p-3 transition-colors",
                      sel ? "border-primary bg-primary/[0.06] ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40")}
                  >
                    <p className="text-xs font-body font-semibold text-foreground line-clamp-2">{p.title || "Sem título"}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{p.format}</span>
                      {postSource(p) && <span className="text-[10px] font-body text-secondary">✓ roteiro pronto</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tema livre */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-body font-semibold text-foreground">Ou tema livre (avulso)</p>
          </div>
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (postId) useFreeTheme(); }}
            placeholder="Ex.: 5 erros que travam quem tá começando com IA"
          />
          {postId && (
            <p className="text-[11px] font-body text-primary mt-1.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Usando o post selecionado (título + roteiro). Digite aqui pra soltar e criar avulso.
            </p>
          )}

          {/* Perplexity: sugestões (admin) — duas abas fixas */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[10px] font-body text-muted-foreground">Sugestões via Perplexity · interno</span>
          </div>
          <div className="mt-2 rounded-xl border border-border overflow-hidden">
            {/* Abas */}
            <div className="flex border-b border-border bg-muted/20">
              <button
                onClick={() => setPplxTab("themes")}
                className={cn("flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-body font-semibold transition-colors",
                  pplxTab === "themes" ? "bg-card text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground")}>
                <TrendingUp className="h-3.5 w-3.5" /> Temas em alta {themes ? `(${themes.length})` : ""}
              </button>
              <button
                onClick={() => setPplxTab("news")}
                className={cn("flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-body font-semibold transition-colors",
                  pplxTab === "news" ? "bg-card text-secondary border-b-2 border-secondary -mb-px" : "text-muted-foreground hover:text-foreground")}>
                <Newspaper className="h-3.5 w-3.5" /> Newsjacking {news ? "•" : ""}
              </button>
            </div>

            {/* Conteúdo da aba ativa */}
            <div className="p-2.5">
              {pplxTab === "themes" ? (
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-full text-xs"
                    onClick={() => hot.mutate({ topic: title.trim() || undefined }, { onSuccess: (r) => { setThemes(r.themes); setPplxTab("themes"); } })} disabled={hot.isPending}>
                    {hot.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5 mr-1.5" />}
                    {themes ? "Atualizar temas" : title.trim() ? "Temas em alta ligados a esse assunto" : "Buscar temas em alta do meu nicho"}
                  </Button>
                  {themes && themes.length > 0 ? (
                    <div className="space-y-1">
                      {themes.map((t, i) => (
                        <button key={i} onClick={() => pickTheme(t)} className="w-full text-left rounded-lg px-2.5 py-1.5 hover:bg-primary/[0.06] transition-colors">
                          <p className="text-xs font-body font-semibold text-foreground">{t.titulo}</p>
                          {t.porque && <p className="text-[11px] font-body text-muted-foreground mt-0.5">{t.porque}</p>}
                        </button>
                      ))}
                    </div>
                  ) : !hot.isPending && (
                    <p className="text-[11px] font-body text-muted-foreground px-1">Clique acima pra ver 5 ganchos quentes do seu nicho agora.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-full text-xs"
                    onClick={() => newsHook.mutate({ topic: title.trim() || undefined }, { onSuccess: (r) => { setNews(r.news); setPplxTab("news"); } })} disabled={newsHook.isPending}>
                    {newsHook.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Newspaper className="h-3.5 w-3.5 mr-1.5" />}
                    {news ? "Atualizar notícia" : title.trim() ? "Notícia ligada a esse assunto" : "O que tá bombando hoje"}
                  </Button>
                  {news && (news.titulo || news.resumo) ? (
                    <div className="rounded-lg border border-secondary/25 bg-secondary/[0.04] p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="h-3.5 w-3.5 text-secondary" />
                        <p className="text-[10px] font-body font-semibold text-secondary uppercase tracking-wider">Newsjacking</p>
                      </div>
                      {news.titulo && <p className="text-sm font-body font-semibold text-foreground">{news.titulo}</p>}
                      {news.resumo && <p className="text-[11px] font-body text-muted-foreground mt-0.5">{news.resumo}</p>}
                      {news.angulo && <p className="text-[11px] font-body text-foreground mt-1"><strong>Ângulo:</strong> {news.angulo}</p>}
                      {news.fonte && <p className="text-[10px] font-body text-muted-foreground mt-0.5">Fonte: {news.fonte}</p>}
                      <Button size="sm" className="h-8 mt-2 text-xs" onClick={useNewsTheme}><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Usar como tema</Button>
                    </div>
                  ) : !newsHook.isPending && (
                    <p className="text-[11px] font-body text-muted-foreground px-1">Clique acima pra pegar uma notícia fresca do nicho pra newsjacking.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Reels: roteiro por segundos ── */}
      {kind === "reels" && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4 mt-4">
          <div className="flex items-center gap-1.5">
            <Film className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider">2. Roteiro do Reels</p>
          </div>
          {!reelScript && (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Duração (segundos)</p>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input type="number" min={10} max={180} value={reelSeconds} onChange={(e) => setReelSeconds(Math.max(10, Math.min(180, Number(e.target.value) || 30)))} className="h-9 w-24" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[15, 30, 45, 60, 90].map((s) => (
                    <button key={s} onClick={() => setReelSeconds(s)} className={cn("px-2.5 h-9 rounded-lg text-xs font-body border", reelSeconds === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{s}s</button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <button type="button" onClick={() => setEnrich((v) => !v)}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 h-9 text-xs font-body transition-colors",
                      enrich ? "border-secondary bg-secondary/10 text-secondary" : "border-border text-muted-foreground hover:border-secondary/40")}>
                    <TrendingUp className="h-3.5 w-3.5" /> Enriquecer com dados atuais
                  </button>
                  <Button onClick={gerarReels} disabled={reels.isPending || !title.trim()} className="h-9">
                    {reels.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Film className="h-4 w-4 mr-2" />}
                    Gerar roteiro
                  </Button>
                </div>
              </div>
              <p className="text-[11px] font-body text-muted-foreground">A IA entrega o roteiro marcado por tempo (gancho → desenvolvimento → CTA) a partir do seu roteiro/legenda. Você ajusta e fatia dentro do sistema. Reels não usa o Higgsfield.</p>
            </>
          )}
          {reelScript && (
            <div className="space-y-3">
              <Textarea value={reelScript} onChange={(e) => setReelScript(e.target.value)} rows={12} className="text-sm leading-relaxed" />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => saveRoteiro(reelScript)} disabled={updatePost.isPending || !postId} className="h-9">
                  {updatePost.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar no post
                </Button>
                <Button variant="outline" onClick={gerarReels} disabled={reels.isPending} className="h-9">
                  {reels.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Film className="h-4 w-4 mr-2" />}
                  Refazer
                </Button>
                <button onClick={() => setReelScript(null)} className="text-[11px] font-body text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> voltar
                </button>
                {!postId && <span className="text-[11px] font-body text-muted-foreground">Selecione um post de Produzindo pra salvar no card.</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Config (carrossel/foto) ── */}
      {kind !== "reels" && (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4 mt-4">
        <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider">2. {kind === "foto" ? "Imagem" : "Formato"}</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo</p>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["carrossel", "estatico"] as const).map((f) => (
                <button key={f} onClick={() => { setFormat(f); if (!postId) setKind(f === "carrossel" ? "carrossel" : "foto"); }} className={cn("px-3 h-9 text-sm font-body", format === f ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{f === "carrossel" ? "Carrossel" : "Estático"}</button>
              ))}
            </div>
          </div>
          {format === "carrossel" && (
            <div>
              <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Páginas</p>
              <Input type="number" min={2} max={10} value={slides} onChange={(e) => setSlides(Math.max(2, Math.min(10, Number(e.target.value) || 6)))} className="h-9 w-20" />
            </div>
          )}
          <div>
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Proporção</p>
            <div className="flex gap-1">
              {ASPECTS.map((a) => (
                <button key={a.v} onClick={() => setAspect(a.v)} className={cn("px-2.5 h-9 rounded-lg text-xs font-body border", aspect === a.v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{a.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Resolução</p>
            <div className="flex gap-1">
              {["720p", "1080p"].map((r) => (
                <button key={r} onClick={() => setResolution(r)} className={cn("px-2.5 h-9 rounded-lg text-xs font-body border", resolution === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{r}</button>
              ))}
            </div>
          </div>
          {!draftPages && (
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={() => setEnrich((v) => !v)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 h-9 text-xs font-body transition-colors",
                  enrich ? "border-secondary bg-secondary/10 text-secondary" : "border-border text-muted-foreground hover:border-secondary/40")}>
                <TrendingUp className="h-3.5 w-3.5" />
                Enriquecer com dados atuais
              </button>
              <Button onClick={montar} disabled={draft.isPending || !title.trim()} className="h-9">
                {draft.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />}
                {kind === "foto" ? "Gerar ideia" : "Montar textos"}
              </Button>
            </div>
          )}
        </div>
        <p className="text-[11px] font-body text-muted-foreground">A IA monta {kind === "foto" ? "a ideia de conteúdo" : "o texto de cada slide"} a partir do roteiro/legenda + sua marca (moodboard). Com <strong>Enriquecer com dados atuais</strong> ligado, o Perplexity busca estatísticas e fatos recentes (com fonte) pra dar autoridade. Você revisa antes de gerar {kind === "foto" ? "a imagem" : "as imagens"} — o Higgsfield só é acionado depois que você aprovar.</p>
      </div>
      )}

      {/* ── Revisão dos slides ── */}
      {kind !== "reels" && draftPages && (
        <div className="bg-card border border-primary/30 ring-1 ring-primary/10 rounded-2xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-body font-semibold text-primary uppercase tracking-wider">3. Revise os textos dos slides</p>
            <button onClick={() => setDraftPages(null)} className="ml-auto text-[11px] font-body text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> voltar
            </button>
          </div>
          <div className="space-y-2.5">
            {draftPages.map((pg, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-body font-bold text-primary uppercase tracking-wide">
                    {i === 0 ? "Capa" : pg.role || `Slide ${i + 1}`} · {i + 1}/{draftPages.length}
                  </span>
                  {kind !== "foto" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                      onClick={() => gerarUm(i)} disabled={gen.isPending}>
                      {gen.isPending && genOne === i ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                      Gerar só este
                    </Button>
                  )}
                </div>
                <Textarea
                  value={pg.screen_text}
                  onChange={(e) => editSlideText(i, e.target.value)}
                  rows={2}
                  className="w-full text-sm resize-none bg-card"
                  placeholder="Texto que vai na tela desse slide…"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button onClick={gerar} disabled={gen.isPending} className="h-9">
              {gen.isPending && genOne === null ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {kind === "foto" ? "Gerar imagem" : "Gerar todas de uma vez"}
            </Button>
            <Button variant="outline" onClick={montar} disabled={draft.isPending} className="h-9">
              {draft.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />}
              Refazer textos
            </Button>
            {postId && (
              <Button variant="ghost" onClick={saveCarrosselRoteiro} disabled={updatePost.isPending} className="h-9">
                {updatePost.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar no post
              </Button>
            )}
            <span className="text-[11px] font-body text-muted-foreground">Só agora gasta crédito do Higgsfield.</span>
          </div>
        </div>
      )}

      {/* ── Jobs ── */}
      <div className="mt-6 space-y-5">
        {jobs.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl py-14 text-center">
            <ImageIcon className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-body text-foreground font-medium">Nada gerado ainda</p>
            <p className="text-xs font-body text-muted-foreground mt-1">Escolha um post em Produzindo (ou digite um tema) e monte os textos.</p>
          </div>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} onDelete={() => del.mutate(job.id)} />)
        )}
      </div>
    </motion.div>
  );
}

function JobCard({ job, onDelete }: { job: HfJob; onDelete: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-display font-bold text-foreground truncate">{job.title}</p>
        <span className={cn("text-[10px] font-body px-1.5 py-0.5 rounded-full",
          job.status === "done" ? "bg-secondary/15 text-secondary" : job.status === "error" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
          {job.status === "running" ? "gerando…" : job.status === "done" ? "pronto" : job.status === "partial" ? "parcial" : "erro"}
        </span>
        <span className="text-[11px] font-body text-muted-foreground">{job.format} · {job.aspect_ratio}</span>
        <button onClick={onDelete} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
      </div>
      {job.error && <p className="text-xs font-body text-destructive mb-2">{job.error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {job.pages.map((pg, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden bg-muted/30">
            <div className="aspect-[4/5] relative flex items-center justify-center">
              {pg.image_url ? (
                <img src={pg.image_url} alt={pg.role} className="absolute inset-0 w-full h-full object-cover" />
              ) : (pg.status || "").startsWith("err") || pg.status === "failed" || pg.status === "nsfw" ? (
                <span className="text-[11px] font-body text-destructive px-2 text-center">falhou ({pg.status})</span>
              ) : (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              )}
            </div>
            <div className="p-2">
              <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase">{i === 0 ? "capa" : pg.role}</p>
              {pg.screen_text && <p className="text-[11px] font-body text-foreground line-clamp-2 mt-0.5">{pg.screen_text}</p>}
              {pg.image_url && (
                <a href={pg.image_url} target="_blank" rel="noreferrer" download className="text-[11px] font-body text-primary flex items-center gap-1 mt-1 hover:underline">
                  <Download className="h-3 w-3" /> baixar
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
