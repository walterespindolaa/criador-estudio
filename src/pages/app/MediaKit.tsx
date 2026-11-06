import { useMemo, useRef, useState, useEffect, type ReactNode, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { IdCard, Download, Pencil, Instagram, Upload, FileText, Trash2, ExternalLink, Loader2, Plus, X, RefreshCw, Link2, Copy, Eye, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useSocialConnection, useDailyMetrics, useMediaInsights, useSyncInstagram, useSocialAccountOwner, connectInstagram, totaisConta30d } from "@/hooks/useSocialInsights";
import { useMediaKitProfile, useSaveMediaKitProfile, useCustomMediaKit, useVersoesKit, useAberturasKit, KIT_ACCENTS, type MediaKitProfile, type KitService } from "@/hooks/useMediaKit";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AutoMediaKit, type KitStats, type KitTopPost } from "@/components/mediakit/AutoMediaKit";
import { DesenhoCapaCria } from "@/components/criakut/CapaCriakut";
import { CAPAS_KIT, estiloCapa, lerMostrar, limparSlug, slugValido, slugDaVersao, type MostrarKit } from "@/lib/mediaKitCapas";
import { usePdfExport, LARGURA_A4 } from "@/hooks/usePdfExport";
import { useTier } from "@/hooks/useTier";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { confirmar } from "@/components/shared/Confirm";
import { cn } from "@/lib/utils";

/* MEDIA KIT PRA MANDAR PRA MARCA (Walter, 06/11/2026; mockup aprovado).
   À esquerda "Mandar pra marca" (link público, PDF, versão por marca, capa,
   o que aparece, aviso mensal e quem abriu); à direita o kit como a marca vai
   ver. No celular o kit vem primeiro e uma barra fixa leva Copiar link, PDF e
   Editar. O PDF próprio e o link do Canva moram na aba "Meu PDF". */

/** Domínio curto da bio: o kit mora em criaclub.bio/nome/kit. */
const DOMINIO_LINK = "criaclub.bio";

const ROTULOS_MOSTRAR: { k: keyof MostrarKit; nome: string }[] = [
  { k: "numeros", nome: "Números do Instagram" },
  { k: "audiencia", nome: "Audiência" },
  { k: "desempenho", nome: "Desempenho 30 dias" },
  { k: "conteudos", nome: "Melhores conteúdos" },
  { k: "valores", nome: "Formatos e valores" },
];

export default function MediaKit() {
  const { profile } = useActiveProfile();
  const { user } = useAuth();
  const { data: conn } = useSocialConnection();
  const { data: daily = [] } = useDailyMetrics(30);
  const { data: media = [] } = useMediaInsights();
  const { data: kit } = useMediaKitProfile();
  const save = useSaveMediaKitProfile();
  const custom = useCustomMediaKit();
  const sync = useSyncInstagram();
  const { versoes, semTabela, criar: criarVersao, atualizar: atualizarVersao, excluir: excluirVersao } = useVersoesKit();
  const { data: aberturas } = useAberturasKit();
  // Conectar/atualizar são ações do DONO da conta ativa (a edge de sync roda com
  // o JWT de quem clica; gestora conectaria/atualizaria a conta errada).
  const { isOwnAccount, contaParaConectar, podeAtualizar } = useSocialAccountOwner();
  const { exportPdf } = usePdfExport();
  const { isPaidOrTrial, isLoading: tierLoading } = useTier();
  const printRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  const [aba, setAba] = useState<"auto" | "pdf">("auto");
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [form, setForm] = useState<MediaKitProfile | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [versaoId, setVersaoId] = useState<string | null>(null);
  const [novaVersao, setNovaVersao] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState("");
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { if (kit && !form) setForm(kit); }, [kit, form]);
  useEffect(() => { if (kit?.link != null) setLinkInput(kit.link); }, [kit?.link]);
  useEffect(() => {
    if (slugInput || !kit) return;
    setSlugInput(kit.slug ?? limparSlug(conn?.username || profile?.name || ""));
  }, [kit, conn?.username, profile?.name, slugInput]);

  const versao = versoes.find((v) => v.id === versaoId) ?? null;
  // A configuração que está na tela: a do kit geral ou a da versão escolhida
  // (o que a versão não define, herda do geral).
  const base = (form ?? kit) as MediaKitProfile | undefined;
  const capaAtual = versao?.capa ?? base?.capa ?? "cria";
  const corAtual = versao?.accent ?? base?.accent ?? "#0061EE";
  const mostrarAtual = lerMostrar({ ...lerMostrar(base?.mostrar), ...(versao?.mostrar ?? {}) });

  const linkPublico = kit?.publico && kit.slug ? `${DOMINIO_LINK}/${kit.slug}/kit${versao ? `/${versao.slug}` : ""}` : null;

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      // Largura de folha: sem isso o PDF saía com o conteúdo medido pela
      // largura da TELA (faixa branca de um lado, corte do outro).
      await exportPdf(printRef, `media-kit-${(conn?.username || profile?.name || "cria").replace(/\W+/g, "-").toLowerCase()}${versao ? `-${versao.slug}` : ""}`, { larguraFixa: LARGURA_A4 });
    } catch (e) {
      console.error("media kit pdf failed", e);
      toast.error("Não consegui gerar o PDF agora.");
    } finally {
      setDownloading(false);
    }
  };

  const copiarLink = async () => {
    if (!linkPublico) {
      painelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      toast("Crie o seu link primeiro, aqui embaixo.");
      return;
    }
    try { await navigator.clipboard.writeText(`https://${linkPublico}`); setCopiado(true); setTimeout(() => setCopiado(false), 1800); toast.success("Link copiado. É só colar pra marca."); }
    catch { toast.error("Não consegui copiar. Segure o link pra copiar."); }
  };

  const criarLink = async () => {
    const s = limparSlug(slugInput);
    if (!slugValido(s)) { toast.error("Use de 3 a 40 letras, números, ponto ou hífen."); return; }
    try {
      await save.mutateAsync({ slug: s, publico: true });
      setForm((f) => (f ? { ...f, slug: s, publico: true } : f));
      setSlugInput(s);
      toast.success("Link no ar.");
    } catch { /* o toast do erro sai no hook */ }
  };

  /** Capa, cor e blocos: no geral salva no kit; numa versão, salva na versão. */
  const mudarConfig = (patch: { capa?: string; accent?: string; mostrar?: Partial<MostrarKit> }) => {
    if (versao) {
      atualizarVersao.mutate({ id: versao.id, ...(patch.capa !== undefined ? { capa: patch.capa } : {}), ...(patch.accent !== undefined ? { accent: patch.accent } : {}),
        ...(patch.mostrar ? { mostrar: { ...(versao.mostrar ?? {}), ...patch.mostrar } } : {}) });
      return;
    }
    const mostrar = patch.mostrar ? { ...lerMostrar(base?.mostrar), ...patch.mostrar } : undefined;
    const extra: Partial<MediaKitProfile> = {};
    // A seção antiga "Melhores conteúdos" (show_top_posts) segue o botão novo.
    if (patch.mostrar && "conteudos" in patch.mostrar) extra.show_top_posts = !!patch.mostrar.conteudos;
    const p: Partial<MediaKitProfile> = { ...(patch.capa !== undefined ? { capa: patch.capa } : {}), ...(patch.accent !== undefined ? { accent: patch.accent } : {}), ...(mostrar ? { mostrar } : {}), ...extra };
    setForm((f) => (f ? { ...f, ...p } : f));
    save.mutate(p);
  };

  const criarNovaVersao = async () => {
    const nome = (novaVersao ?? "").trim();
    if (!nome) return;
    const slug = slugDaVersao(nome);
    if (slug.length < 2) { toast.error("Dê um nome com pelo menos 2 letras."); return; }
    try {
      const v = await criarVersao.mutateAsync({ nome, slug, capa: capaAtual, accent: corAtual, mostrar: mostrarAtual });
      setVersaoId(v.id);
      setNovaVersao(null);
    } catch { /* toast no hook */ }
  };

  const saveLink = async () => {
    const url = linkInput.trim();
    if (url && !/^https?:\/\//i.test(url)) { toast.error("O link precisa começar com http:// ou https://"); return; }
    await save.mutateAsync({ link: url || null });
    toast.success(url ? "Link salvo!" : "Link removido.");
  };

  const stats: KitStats = useMemo(() => {
    const followers = [...daily].reverse().find((d) => d.followers != null)?.followers ?? 0;
    const firstFollowers = daily.find((d) => d.followers != null)?.followers ?? 0;
    const followersGrowth = followers && firstFollowers ? followers - firstFollowers : 0;
    const reachMonth = daily.reduce((s, d) => s + (d.reach ?? 0), 0);
    // Totais de conta de 30 dias do jeito certo (antes somava o total de 30
    // dias gravado em cada dia, e o número saía multiplicado).
    const tot = totaisConta30d(daily);
    const interactions = tot.interactions ?? 0;
    const engagementPct = reachMonth > 0 ? Math.min(100, (interactions / reachMonth) * 100) : 0;
    const saves = media.reduce((s, m) => s + (m.metrics?.saved ?? m.metrics?.saves ?? 0), 0);
    const profileViews = tot.profileViews ?? 0;
    const accountsEngaged = tot.accountsEngaged ?? 0;
    const postsCount = media.length;
    const reachPosts = media.filter((m) => (m.metrics?.reach ?? 0) > 0);
    const avgReach = reachPosts.length ? Math.round(reachPosts.reduce((s, m) => s + (m.metrics?.reach ?? 0), 0) / reachPosts.length) : 0;
    return { followers, reachMonth, engagementPct, saves, profileViews, accountsEngaged, interactions, postsCount, avgReach, followersGrowth };
  }, [daily, media]);

  const liveKitForPosts = (form ?? kit) as MediaKitProfile | undefined;
  const topPosts: KitTopPost[] = useMemo(() => {
    const mapear = (m: (typeof media)[number]): KitTopPost => ({
      title: m.posts?.title || (m.caption || "").slice(0, 60) || "Publicação",
      format: m.posts?.format || (m.media_type === "VIDEO" ? "Reels" : m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : "Foto"),
      reach: m.metrics?.reach ?? 0,
      saves: m.metrics?.saved ?? m.metrics?.saves ?? 0,
      thumbnail_url: m.thumbnail_url,
    });
    // Escolhidos a dedo: a pessoa mostra os posts com mais a ver com a marca
    // que vai contratá-la, não necessariamente os de maior alcance.
    const escolhidos = liveKitForPosts?.featured_post_ids ?? null;
    if (escolhidos && escolhidos.length > 0) {
      return escolhidos
        .map((id) => media.find((m) => m.id === id))
        .filter((m): m is (typeof media)[number] => !!m)
        .slice(0, 3)
        .map(mapear);
    }
    // Automático: os 3 de maior alcance dos últimos 90 dias (é o que o título
    // diz e é a mesma conta do link público).
    const desde = Date.now() - 90 * 86400000;
    return [...media]
      .filter((m) => !m.posted_at || new Date(m.posted_at).getTime() >= desde)
      .map(mapear).sort((a, b) => b.reach - a.reach).slice(0, 3);
  }, [media, liveKitForPosts?.featured_post_ids]);

  // Quando os números foram puxados por último (pedido do Walter: a marca
  // precisa saber de quando são os dados).
  const dataDados = useMemo(() => {
    const ultimaDaily = [...daily].map((d) => d.date).filter(Boolean).sort().pop();
    const iso = ultimaDaily || conn?.updated_at || null;
    if (!iso) return null;
    try { return new Date(String(iso).length === 10 ? `${iso}T12:00:00` : String(iso)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); } catch { return null; }
  }, [daily, conn?.updated_at]);

  const handle = conn?.username ? `@${conn.username}` : (profile?.name ? `@${profile.name.split(" ")[0].toLowerCase()}` : "@voce");

  const doSave = async () => {
    if (!form) return;
    // Só os campos do formulário: capa, link e blocos já salvam na hora no painel.
    const { capa: _c, slug: _s, publico: _p, mostrar: _m, aviso_mensal: _a, ...dados } = form;
    await save.mutateAsync(dados);
    setEditing(false);
    toast.success("Media kit atualizado!");
  };

  const patchService = (i: number, p: Partial<KitService>) =>
    setForm((f) => f ? { ...f, services: (f.services ?? []).map((s, idx) => idx === i ? { ...s, ...p } : s) } : f);

  const liveKit = (form ?? kit) as MediaKitProfile | undefined;

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) custom.upload.mutate(file);
    e.target.value = "";
  };

  // Foto própria do kit: a do IG vem de CDN que expira e a foto sumia do PDF.
  // Sobe pro bucket avatars (público) e grava a URL estável no kit.
  const [uploadingKitPhoto, setUploadingKitPhoto] = useState(false);
  const onKitPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.id || !form) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem."); return; }
    setUploadingKitPhoto(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/media-kit-foto-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((f) => f ? { ...f, avatar_url: data.publicUrl } : f);
    } catch {
      toast.error("Não consegui subir a foto.");
    } finally {
      setUploadingKitPhoto(false);
    }
  };

  const toggleFeatured = (id: string) => {
    setForm((f) => {
      if (!f) return f;
      const atual = f.featured_post_ids ?? [];
      if (atual.includes(id)) return { ...f, featured_post_ids: atual.filter((x) => x !== id) };
      if (atual.length >= 3) { toast.error("Escolha no máximo 3 posts."); return f; }
      return { ...f, featured_post_ids: [...atual, id] };
    });
  };

  const abrirEdicao = () => {
    setEditing((v) => !v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!tierLoading && !isPaidOrTrial) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-pink-400 flex items-center justify-center mx-auto mb-4"><Lock className="h-6 w-6 text-white" /></div>
        <h1 className="text-2xl font-display font-extrabold text-foreground">Media Kit é dos planos Pro e Studio</h1>
        <p className="text-sm font-body text-muted-foreground mt-2">Monte um portfólio profissional com os números reais do seu Instagram (ou suba o seu PDF) pra fechar publis. Disponível a partir do plano Pro.</p>
        <Button asChild className="mt-5"><Link to="/app/assinar">Conhecer os planos</Link></Button>
      </div>
    );
  }

  const chave = "rounded-full border-2 border-foreground px-3.5 py-1.5 text-xs font-body font-bold transition-colors";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-40 md:pb-0">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-pink-400 flex items-center justify-center shadow-sm shrink-0">
          <IdCard className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Media Kit</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Pronto pra mandar pra marca: um link que se atualiza sozinho, o PDF e a sua versão de cada marca.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <button type="button" onClick={() => setAba("auto")} className={cn(chave, aba === "auto" ? "bg-foreground text-background" : "bg-card text-foreground")}>Kit automático</button>
        <button type="button" data-tour="mediakit-personalizado" onClick={() => setAba("pdf")} className={cn(chave, aba === "pdf" ? "bg-foreground text-background" : "bg-card text-foreground")}>Meu PDF</button>
      </div>

      {aba === "auto" && (
      <section data-tour="mediakit-automatico" className="mb-8">
        {!conn ? (
          <div className="border border-dashed border-border rounded-2xl py-14 px-6 text-center">
            <Instagram className="h-7 w-7 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-body text-foreground font-medium">{isOwnAccount ? "Conecte o Instagram pra gerar o media kit" : "Instagram ainda não conectado"}</p>
            <p className="text-xs font-body text-muted-foreground mt-1 mb-4">
              {isOwnAccount
                ? "Os números, audiência e melhores posts são puxados automaticamente."
                : "Peça pro dono da conta conectar o Instagram dele em Insights pra gerar o media kit com os números reais."}
            </p>
            {isOwnAccount && (
              <Button onClick={() => connectInstagram(null, null, contaParaConectar)} className="gap-2"><Instagram className="h-4 w-4" /> Conectar Instagram</Button>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
            {/* ===== O KIT (primeiro no celular) ===== */}
            <div className="order-1 lg:order-2 min-w-0">
              <div className="hidden md:flex items-center justify-end gap-2 mb-3 flex-wrap">
                {versao && <span className="mr-auto text-xs font-body font-semibold text-muted-foreground">Versão: <b className="text-foreground">{versao.nome}</b></span>}
                {podeAtualizar && (
                  <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending} className="gap-1.5"><RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} /> Atualizar números</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Editar dados</Button>
              </div>

            {editing && form && (
              <div className="bg-card border border-border rounded-2xl p-4 mb-4 space-y-4">
                {/* Identidade do kit: nome próprio, foto estável e cor de destaque
                   (pedidos do Walter, 31/08: nome editável, foto escolhível e
                   cores que não pareçam aleatórias). */}
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[200px] flex-1">
                    <Field label="Nome no kit">
                      <input value={form.display_name ?? ""} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder={profile?.name ?? "Seu nome"} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-body outline-none focus:ring-1 focus:ring-primary/30" />
                    </Field>
                  </div>
                  <div>
                    <p className="text-xs font-body text-muted-foreground mb-1.5">Foto do kit</p>
                    <div className="flex items-center gap-2">
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-muted grid place-items-center shrink-0">
                        {(form.avatar_url ?? profile?.avatar_url) ? (
                          <img src={form.avatar_url ?? profile?.avatar_url ?? ""} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <IdCard className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={onKitPhoto} />
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                          {uploadingKitPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Trocar foto
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Bio (frase de apresentação)"><textarea value={form.bio ?? profile?.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-card p-2.5 text-sm font-body outline-none resize-none focus:ring-1 focus:ring-primary/30" /></Field>
                  <Field label="Nichos (separe por vírgula)"><input value={form.niche ?? profile?.niche ?? ""} onChange={(e) => setForm({ ...form, niche: e.target.value })} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-body outline-none focus:ring-1 focus:ring-primary/30" /></Field>
                  <Field label="Contato (e-mail/WhatsApp)"><input value={form.contact ?? ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="voce@email.com" className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-body outline-none focus:ring-1 focus:ring-primary/30" /></Field>
                  <Field label="Top cidades"><input value={form.cities ?? ""} onChange={(e) => setForm({ ...form, cities: e.target.value })} placeholder="São Paulo, Rio, BH" className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-body outline-none focus:ring-1 focus:ring-primary/30" /></Field>
                </div>

                <div>
                  <p className="text-xs font-body text-muted-foreground mb-2">Audiência por idade (%)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(form.audience ?? []).map((b, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input value={b.label} onChange={(e) => setForm({ ...form, audience: form.audience!.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) })} className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none" />
                        <input type="number" value={b.pct} onChange={(e) => setForm({ ...form, audience: form.audience!.map((x, idx) => idx === i ? { ...x, pct: Number(e.target.value) } : x) })} className="w-14 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-body text-muted-foreground">Gênero %</span>
                  <label className="text-xs flex items-center gap-1.5">Mulheres <input type="number" value={form.gender?.women ?? 60} onChange={(e) => setForm({ ...form, gender: { women: Number(e.target.value), men: 100 - Number(e.target.value) } })} className="w-14 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none" /></label>
                  <span className="text-xs text-muted-foreground">Homens {100 - (form.gender?.women ?? 60)}%</span>
                </div>

                <div>
                  <p className="text-xs font-body text-muted-foreground mb-2">Formatos de parceria e valores</p>
                  <div className="space-y-2">
                    {(form.services ?? []).map((s, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 grid sm:grid-cols-[1fr_1.4fr_auto] gap-2">
                          <input value={s.name} onChange={(e) => patchService(i, { name: e.target.value })} placeholder="Nome" className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none" />
                          <input value={s.desc} onChange={(e) => patchService(i, { desc: e.target.value })} placeholder="Descrição" className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none" />
                          <input value={s.price} onChange={(e) => patchService(i, { price: e.target.value })} placeholder="R$ 0" className="w-24 rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none" />
                        </div>
                        <button onClick={() => setForm({ ...form, services: form.services!.filter((_, idx) => idx !== i) })} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Remover"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button onClick={() => setForm({ ...form, services: [...(form.services ?? []), { name: "", desc: "", price: "R$ 0" }] })} className="text-xs font-body text-primary flex items-center gap-1.5 mt-1"><Plus className="h-3.5 w-3.5" /> Adicionar formato</button>
                  </div>
                </div>

                {/* Melhores conteúdos: opcional e escolhível (a pessoa pode querer
                   mostrar posts que casam com a marca, não os de maior alcance). */}
                <div>
                  <p className="text-xs font-body text-foreground font-medium mb-2">Melhores conteúdos</p>
                  {media.length > 0 && (
                    <>
                      <p className="text-xs font-body text-muted-foreground mb-2">
                        Escolha até 3 posts pra destacar. Sem escolha, entram os 3 de maior alcance. As capas vêm do Instagram: se alguma sumir, clique em Atualizar lá em cima.
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {[...media].slice(0, 12).map((m) => {
                          const sel = (form.featured_post_ids ?? []).includes(m.id);
                          const titulo = m.posts?.title || (m.caption || "").slice(0, 40) || "Publicação";
                          return (
                            <button key={m.id} type="button" onClick={() => toggleFeatured(m.id)} title={titulo}
                              className={`relative aspect-[4/5] rounded-lg overflow-hidden border-2 transition-all ${sel ? "border-primary ring-2 ring-primary/30" : "border-border opacity-80 hover:opacity-100"}`}>
                              {m.thumbnail_url ? (
                                <img src={m.thumbnail_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <span className="absolute inset-0 grid place-items-center bg-muted text-[9px] font-body text-muted-foreground p-1 text-center">{titulo}</span>
                              )}
                              {sel && (
                                <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold grid place-items-center">
                                  {(form.featured_post_ids ?? []).indexOf(m.id) + 1}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {(form.featured_post_ids ?? []).length > 0 && (
                        <button type="button" onClick={() => setForm({ ...form, featured_post_ids: null })} className="text-xs font-body text-primary mt-2">
                          Voltar pro top 3 automático
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => { setForm(kit ?? null); setEditing(false); }}>Cancelar</Button>
                  <Button size="sm" onClick={doSave} disabled={save.isPending} className="gap-1.5">{save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Salvar</Button>
                </div>
              </div>
            )}

              <div className="max-w-[860px]">
                {liveKit && (
                  <AutoMediaKit
                    ref={printRef}
                    name={liveKit.display_name?.trim() || profile?.name || "Seu nome"}
                    handle={handle}
                    /* A foto do perfil do Cria (URL estável) vem ANTES da do IG:
                       o CDN do Instagram expira e a foto sumia do kit. */
                    avatarUrl={liveKit.avatar_url ?? profile?.avatar_url ?? conn?.profile_picture_url ?? null}
                    niche={liveKit.niche ?? profile?.niche ?? ""}
                    bio={liveKit.bio ?? profile?.bio ?? ""}
                    kit={{ ...liveKit, accent: corAtual }}
                    stats={stats}
                    posts={topPosts}
                    updatedAt={dataDados}
                    capa={capaAtual}
                    mostrar={mostrarAtual}
                  />
                )}
              </div>
            </div>

            {/* ===== MANDAR PRA MARCA ===== */}
            <aside ref={painelRef} className="order-2 lg:order-1 lg:sticky lg:top-4 scroll-mt-4 rounded-[22px] border-2 border-foreground bg-card p-4 shadow-[5px_5px_0_hsl(var(--foreground))]">
              <p className="font-display font-extrabold text-lg leading-tight">Mandar pra marca</p>

              {linkPublico ? (
                <>
                  <div className="mt-3 flex items-center gap-2 rounded-xl border-[1.5px] border-foreground bg-background px-3 py-2">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-body font-semibold">{linkPublico}</span>
                    <a href={`https://${linkPublico}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Abrir o link"><Eye className="h-3.5 w-3.5" /></a>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => void copiarLink()} className="gap-1.5">{copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiado ? "Copiado" : "Copiar link"}</Button>
                    <Button size="sm" variant="outline" onClick={() => void downloadPdf()} disabled={downloading} className="gap-1.5">{downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Baixar PDF</Button>
                  </div>
                  <p className="mt-2 text-[11.5px] font-body text-muted-foreground leading-snug">O link sempre mostra os números do dia. O PDF é a foto de agora.</p>
                  {!versao && (
                    <label className="mt-2 flex items-center justify-between gap-2 text-[12.5px] font-body">
                      Link no ar
                      <Switch checked={!!kit?.publico} onCheckedChange={(v) => { setForm((f) => (f ? { ...f, publico: v } : f)); save.mutate({ publico: v }); }} />
                    </label>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 text-[12.5px] font-body text-muted-foreground leading-snug">Crie um link que abre bonito no celular da marca e sempre mostra os números do dia.</p>
                  <div className="mt-2 flex items-center rounded-xl border-[1.5px] border-foreground bg-background pl-3 pr-1 py-1">
                    <span className="text-[12px] font-body text-muted-foreground whitespace-nowrap">{DOMINIO_LINK}/</span>
                    <input value={slugInput} onChange={(e) => setSlugInput(limparSlug(e.target.value))} placeholder="seunome" aria-label="Endereço do link"
                      className="min-w-0 flex-1 bg-transparent px-0.5 py-1.5 text-[12.5px] font-body font-semibold outline-none" />
                    <span className="text-[12px] font-body text-muted-foreground pr-1">/kit</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => void criarLink()} disabled={save.isPending || !slugInput}>Criar meu link</Button>
                    <Button size="sm" variant="outline" onClick={() => void downloadPdf()} disabled={downloading} className="gap-1.5">{downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Baixar PDF</Button>
                  </div>
                </>
              )}

              {/* VERSÃO */}
              <Bloco titulo="Versão">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setVersaoId(null)} className={pilula(!versao)}>Geral</button>
                  {versoes.map((v) => (
                    <button key={v.id} type="button" onClick={() => setVersaoId(v.id)} className={pilula(versao?.id === v.id)}>{v.nome}</button>
                  ))}
                  {novaVersao === null && !semTabela && (
                    <button type="button" onClick={() => setNovaVersao("")} className={cn(pilula(false), "inline-flex items-center gap-1")}><Plus className="h-3 w-3" /> versão</button>
                  )}
                </div>
                {novaVersao !== null && (
                  <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void criarNovaVersao(); }}>
                    <input autoFocus value={novaVersao} onChange={(e) => setNovaVersao(e.target.value)} placeholder="Ex.: Marca de moda" maxLength={60}
                      className="min-w-0 flex-1 h-8 rounded-full border border-border bg-background px-3 text-xs font-body outline-none focus:border-primary" />
                    <Button type="submit" size="sm" className="h-8 px-3" disabled={!novaVersao.trim() || criarVersao.isPending}>Criar</Button>
                    <button type="button" onClick={() => setNovaVersao(null)} className="h-8 w-8 grid place-items-center rounded-full text-muted-foreground" aria-label="Cancelar"><X className="h-3.5 w-3.5" /></button>
                  </form>
                )}
                <p className="mt-1.5 text-[11.5px] font-body text-muted-foreground leading-snug">
                  {semTabela ? "As versões por marca entram assim que o banco for atualizado." : "Cada versão tem o próprio link e escolhe a capa, a cor e o que mostrar."}
                </p>
                {versao && (
                  <button type="button" className="mt-1 text-[11.5px] font-body font-semibold text-destructive underline"
                    onClick={async () => { if (await confirmar({ titulo: `Excluir a versão "${versao.nome}"?`, descricao: "O link dessa versão para de abrir. O kit geral continua.", acao: "Excluir", destrutivo: true })) { excluirVersao.mutate(versao.id); setVersaoId(null); } }}>
                    Excluir esta versão
                  </button>
                )}
              </Bloco>

              {/* CAPA */}
              <Bloco titulo="Capa">
                <div className="grid grid-cols-4 gap-1.5">
                  {CAPAS_KIT.map((c) => {
                    const est = estiloCapa(c.id, corAtual);
                    const on = capaAtual === c.id;
                    return (
                      <button key={c.id} type="button" onClick={() => mudarConfig({ capa: c.id })} title={c.nome} aria-pressed={on}
                        className={cn("group text-left", on ? "" : "opacity-85 hover:opacity-100")}>
                        <span className={cn("relative block h-9 rounded-lg overflow-hidden border-2", on ? "border-foreground ring-2 ring-foreground/25" : "border-border")} style={{ background: est.fundo }}>
                          {est.desenho && <DesenhoCapaCria tipo={est.desenho} />}
                          {est.mancha && <span className="absolute -right-2 -top-3 h-7 w-9 rounded-full" style={{ background: est.mancha }} />}
                          <span className="absolute left-1.5 bottom-1 h-3 w-3 rounded-full border-2" style={{ borderColor: est.aro, background: "#E6E1D6" }} />
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-body font-semibold text-muted-foreground">{c.nome}</span>
                      </button>
                    );
                  })}
                </div>
                {capaAtual === "cor" && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {KIT_ACCENTS.map((c) => (
                      <button key={c} type="button" onClick={() => mudarConfig({ accent: c })} aria-label={`Cor ${c}`}
                        className={cn("h-6 w-6 rounded-full border border-black/10", corAtual.toLowerCase() === c.toLowerCase() && "ring-2 ring-offset-2 ring-foreground")} style={{ background: c }} />
                    ))}
                    <label className="relative h-6 w-6 rounded-full border border-dashed border-foreground/40 grid place-items-center cursor-pointer overflow-hidden" title="Outra cor">
                      <Plus className="h-3 w-3 text-muted-foreground" />
                      <input type="color" value={/^#[0-9a-f]{6}$/i.test(corAtual) ? corAtual : "#0061EE"} onChange={(e) => mudarConfig({ accent: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Escolher outra cor" />
                    </label>
                  </div>
                )}
              </Bloco>

              {/* O QUE APARECE */}
              <Bloco titulo="O que aparece">
                {ROTULOS_MOSTRAR.map(({ k, nome }) => (
                  <label key={k} className="flex items-center justify-between gap-2 py-1 text-[13px] font-body">
                    {nome}
                    <Switch checked={mostrarAtual[k]} onCheckedChange={(v) => mudarConfig({ mostrar: { [k]: v } })} />
                  </label>
                ))}
              </Bloco>

              {/* ATUALIZAÇÃO */}
              <Bloco titulo="Atualização">
                <div className="flex items-center justify-between gap-2 py-1 text-[13px] font-body">
                  Números ao vivo <span className="text-[11.5px] font-bold text-emerald-700">a cada 20 min</span>
                </div>
                <label className="flex items-center justify-between gap-2 py-1 text-[13px] font-body">
                  Me avisar todo dia 1º pra revisar
                  <Switch checked={base?.aviso_mensal !== false} onCheckedChange={(v) => { setForm((f) => (f ? { ...f, aviso_mensal: v } : f)); save.mutate({ aviso_mensal: v }); }} />
                </label>
                <p className="text-[11.5px] font-body text-muted-foreground leading-snug">No aviso você confere audiência e valores, que são preenchidos à mão.</p>
              </Bloco>

              {/* QUEM ABRIU */}
              <Bloco titulo="Quem abriu">
                <p className="text-[13px] font-body">
                  {!linkPublico ? "Aparece depois que o link estiver no ar."
                    : aberturas == null ? "Ainda sem dados."
                    : <><b>{aberturas.semana}</b> {aberturas.semana === 1 ? "abertura" : "aberturas"} nos últimos 7 dias <span className="text-muted-foreground">· {aberturas.total} no total</span></>}
                </p>
              </Bloco>
            </aside>
          </div>
        )}
      </section>
      )}

      {/* ===== Meu PDF ===== */}
      {aba === "pdf" && (
      <section>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-body text-muted-foreground leading-relaxed mb-4">
            Prefere desenhar do seu jeito? Edite no Canva (ou onde quiser), exporte em PDF e suba aqui. Fica disponível pra baixar e compartilhar como portfólio.
          </p>

          {custom.file ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0"><FileText className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground truncate">{custom.file.name}</p>
                  <p className="text-xs font-body text-muted-foreground">Enviado em {new Date(custom.file.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={custom.openFile} className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Abrir</Button>
                <label className="cursor-pointer">
                  <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"><Upload className="h-3.5 w-3.5" /> Trocar</span>
                </label>
                <Button variant="ghost" size="sm" aria-label="Remover media kit personalizado" onClick={async () => { if (await confirmar({ titulo: "Remover o media kit personalizado?", descricao: "O arquivo enviado é apagado. O media kit automático continua.", acao: "Remover", destrutivo: true })) custom.remove.mutate(); }} className="gap-1.5 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ) : (
            <label className="block cursor-pointer border border-dashed border-border rounded-xl py-10 px-6 text-center hover:border-primary/40 transition-colors">
              <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
              {custom.upload.isPending ? (
                <Loader2 className="h-6 w-6 text-primary mx-auto animate-spin" />
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm font-body text-foreground font-medium">Subir meu PDF</p>
                  <p className="text-xs font-body text-muted-foreground mt-1">PDF até 15 MB</p>
                </>
              )}
            </label>
          )}

          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-sm font-body text-foreground font-medium flex items-center gap-2 mb-1"><Link2 className="h-4 w-4 text-primary" /> Ou cole um link</p>
            <p className="text-xs font-body text-muted-foreground mb-3">Tem o media kit no Canva, Notion, Behance ou Google Drive? Cole o link público aqui.</p>
            <div className="flex gap-2 flex-wrap">
              <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://canva.com/..." className="flex-1 min-w-[200px] rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-body outline-none focus:ring-1 focus:ring-primary/30" />
              <Button variant="outline" size="sm" onClick={saveLink} disabled={save.isPending} className="gap-1.5">Salvar link</Button>
              {kit?.link && <Button variant="ghost" size="sm" onClick={() => window.open(kit.link!, "_blank", "noopener")} className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Abrir</Button>}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* BARRA DO CELULAR: o kit ocupa a tela e as ações ficam à mão. */}
      {aba === "auto" && conn && (
        <div className="md:hidden fixed inset-x-3 z-40 flex gap-2" style={{ bottom: "calc(84px + env(safe-area-inset-bottom))" }}>
          <Button className="flex-1 gap-1.5 shadow-[0_3px_0_hsl(var(--foreground))] border-2 border-foreground" onClick={() => void copiarLink()}>
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {linkPublico ? (copiado ? "Copiado" : "Copiar link") : "Criar link"}
          </Button>
          <Button variant="outline" className="flex-1 gap-1.5 bg-card border-2 border-foreground" onClick={() => void downloadPdf()} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
          </Button>
          <Button variant="outline" className="gap-1.5 bg-card border-2 border-foreground" onClick={abrirEdicao}><Pencil className="h-4 w-4" /> Editar</Button>
        </div>
      )}
    </motion.div>
  );
}

function pilula(on: boolean) {
  return cn("rounded-full border-[1.5px] px-3 py-1 text-xs font-body font-bold transition-colors",
    on ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-foreground/60 hover:border-foreground");
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-3 border-t-[1.5px] border-dashed border-border pt-3">
      <p className="mb-1.5 text-[10.5px] font-body font-extrabold uppercase tracking-[.07em] text-muted-foreground">{titulo}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-body text-muted-foreground mb-1.5">{label}</p>
      {children}
    </div>
  );
}
