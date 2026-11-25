import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Send, CalendarClock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/useProfile";
import {
  conectarRede, formatoLinkedInDaMidia, NOME_REDE, useAgendarRede, useConexaoRede, useCrmDoPost, useCriadorTikTok,
  useMidiaDoPost, usePublicacaoRede, usePublicarAgoraRede, useVencimentoRede, type RedeNova, useVoltaDoLoginDaRede,
  usePostParaYouTube, redeLiberada, CardDoPostCtx,
} from "@/hooks/usePublicarRedes";
import { useQueryClient } from "@tanstack/react-query";
import { YT_CATEGORIAS, YT_IDIOMAS, YT_TAGS_MAX, YT_TITULO_MAX, contarTags, hashtagsDaDescricao, lerYoutube } from "@/lib/youtube";

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLICAR NO TIKTOK E NO YOUTUBE (mockup aprovado em 03/11/2026)

   Só aparece pro master (profile.role = "admin") enquanto o fluxo é testado.
   O banco e as funções também barram quem não é master.

   Regras de tela do TikTok (sem elas a auditoria reprova): nome da conta que
   vai postar, privacidade SEM valor marcado, interações desmarcadas e em cinza
   quando o criador desligou no app, conteúdo comercial com as duas opções,
   texto de consentimento acima do botão, sem marca do Cria no texto.
   YouTube: Short ou vídeo normal (o YouTube decide pelo formato; a tela avisa),
   título até 100, visibilidade e "feito para crianças" obrigatórios.

   LinkedIn perfil pessoal (mockup aprovado em 25/11/2026, "ta aprovado"):
   formato sai da mídia do post (texto, foto, carrossel de 2 a 20 fotos ou
   vídeo), texto até 3.000, quem pode ver, e aviso de reconectar nos últimos
   7 dias da conexão (o LinkedIn não renova sozinho).
   TikTok e YouTube saíram da tela em 03/11/2026 e voltaram em 25/11/2026
   (commit 42e317c da main, só master). A aba que abre é a da rede do post.
   ═══════════════════════════════════════════════════════════════════════════ */

const REDES_NA_TELA: RedeNova[] = ["linkedin", "youtube", "tiktok"];

const PRIVACIDADE: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Todo mundo",
  MUTUAL_FOLLOW_FRIENDS: "Amigos",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Só eu",
};

const SELO: Record<string, { txt: string; cls: string }> = {
  rascunho: { txt: "Rascunho", cls: "bg-muted text-muted-foreground" },
  na_fila: { txt: "Agendado", cls: "bg-sky-100 text-sky-800" },
  publicando: { txt: "Enviando", cls: "bg-violet-100 text-violet-800" },
  processando: { txt: "Processando", cls: "bg-violet-100 text-violet-800" },
  publicado: { txt: "Publicado", cls: "bg-green-100 text-green-800" },
  erro: { txt: "Não saiu", cls: "bg-amber-100 text-amber-900" },
  cancelado: { txt: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

function Opcao({ ativo, desligado, onClick, children }: { ativo: boolean; desligado?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" disabled={desligado} onClick={onClick}
      className={cn("flex-1 min-h-[40px] rounded-xl border px-3 text-[13px] font-body font-bold transition-colors",
        ativo ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-muted/40",
        desligado && "opacity-50 cursor-not-allowed")}>
      {children}
    </button>
  );
}

function Marca({ marcado, desligado, onClick, children, nota }: { marcado: boolean; desligado?: boolean; onClick: () => void; children: React.ReactNode; nota?: string }) {
  return (
    <button type="button" disabled={desligado} onClick={onClick}
      className={cn("w-full flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[13px] font-body", desligado && "opacity-50 cursor-not-allowed")}>
      <span className={cn("h-4 w-4 shrink-0 rounded-[5px] border-[1.5px]", marcado ? "bg-primary border-primary" : "border-muted-foreground/50")} />
      <span className="flex-1">{children}</span>
      {nota && <span className="text-[11px] text-muted-foreground">{nota}</span>}
    </button>
  );
}

export type AoVivo = { data: string | null; hora: string | null };

export function PublicarNasRedes({ postId, legenda, titulo, plataforma, aoVivo, antesDeAgir, onAgendou, onPublicou }: {
  postId: string; legenda?: string | null; titulo?: string | null; plataforma?: string | null;
  /** Data e hora que estão na tela agora (o YouTube programa por elas). */
  aoVivo?: AoVivo;
  /** Grava o que está pendente no editor antes de publicar (o painel lê o post salvo). */
  antesDeAgir?: () => Promise<void>;
  /** A rede do post agendou ou publicou: o editor alinha a coluna (25/11/2026). */
  onAgendou?: (ligado: boolean) => void;
  onPublicou?: () => void;
}) {
  const { profile } = useProfile();
  const master = profile?.role === "admin";
  // LinkedIn pra todos desde 25/11/2026; YouTube e TikTok só o master vê.
  const redesDaPessoa = REDES_NA_TELA.filter((r) => redeLiberada(r, master));
  /* Post de TikTok ou YouTube: a caixa já abre na rede dele. Post de Instagram:
     fica fechada numa linha (é opcional, não pode pesar no editor). */
  const daRede = redesDaPessoa.includes(plataforma as RedeNova) ? (plataforma as RedeNova) : null;
  const [rede, setRede] = useState<RedeNova>(daRede ?? redesDaPessoa[0]);
  const [aberto, setAberto] = useState(!!daRede);
  useEffect(() => { if (daRede) { setRede(daRede); setAberto(true); } }, [daRede]);

  // Volta do login da rede: avisa, recarrega as conexões e limpa a URL.
  useVoltaDoLoginDaRede();

  if (!redesDaPessoa.length) return null;
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)}
        className="w-full flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-3.5 py-2.5 text-left hover:bg-muted/40">
        <span className="text-[12.5px] font-body font-semibold text-muted-foreground">{master ? "Publicar também no LinkedIn, YouTube ou TikTok" : "Publicar também no LinkedIn"}</span>
        {master && <span className="ml-auto text-[10.5px] font-body font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-900">YouTube e TikTok: só master</span>}
      </button>
    );
  }
  return (
    <CardDoPostCtx.Provider value={{ plataforma, onAgendou, onPublicou }}>
    <div className="rounded-2xl border border-border bg-card p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-body font-bold text-foreground">Publicar também em</p>
        {master && <span className="text-[10.5px] font-body font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-900">YouTube e TikTok: só master</span>}
        {!daRede && <button type="button" onClick={() => setAberto(false)} className="ml-auto text-[12px] font-body text-muted-foreground hover:text-foreground">fechar</button>}
      </div>
      {redesDaPessoa.length > 1 && <div className="flex gap-1.5">
        {redesDaPessoa.map((r) => (
          <button key={r} type="button" onClick={() => setRede(r)}
            className={cn("rounded-full px-3 py-1.5 text-[12px] font-body font-bold", rede === r ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
            {NOME_REDE[r]}
          </button>
        ))}
      </div>}
      {rede === "linkedin"
        ? <PainelLinkedIn key="li" postId={postId} legenda={legenda} />
        : rede === "tiktok"
          ? <PainelTikTok key="tt" postId={postId} legenda={legenda} />
          : <PainelYouTube key="yt" postId={postId} titulo={titulo} aoVivo={aoVivo} antesDeAgir={antesDeAgir} />}
    </div>
    </CardDoPostCtx.Provider>
  );
}

function Cabecalho({ postId, rede }: { postId: string; rede: RedeNova }) {
  const pub = usePublicacaoRede(postId, rede).data;
  const agendar = useAgendarRede(postId, rede);
  if (!pub || pub.status === "cancelado") return null;
  const s = SELO[pub.status] ?? SELO.rascunho;
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className={cn("text-[11px] font-body font-bold rounded-full px-2 py-0.5", s.cls)}>{s.txt}</span>
        {pub.status === "na_fila" && (
          <button type="button" className="ml-auto text-[12px] font-body text-muted-foreground hover:text-foreground"
            onClick={() => agendar.mutate({ ligar: false, opcoes: {} })}>cancelar</button>
        )}
        {pub.permalink && (
          <a href={pub.permalink} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12px] font-body font-bold text-primary">
            Ver no {NOME_REDE[rede]} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {pub.erro && pub.status !== "publicado" && <p className="text-[12px] font-body text-amber-900 flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{pub.erro}</p>}
      {/* Saiu com um porém (ex.: o YouTube recusou a miniatura). */}
      {pub.erro && pub.status === "publicado" && <p className="text-[12px] font-body text-muted-foreground flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{pub.erro}</p>}
      {pub.status === "publicado" && programadoPara(pub.opcoes) && (
        <p className="text-[12px] font-body text-foreground">Programado no YouTube: sai sozinho em <b>{programadoPara(pub.opcoes)}</b>.</p>
      )}
      {pub.status === "processando" && <p className="text-[12px] font-body text-muted-foreground">{rede === "youtube"
        ? "O vídeo já subiu. Falta a miniatura, que entra quando o YouTube terminar de processar. Esta caixa atualiza sozinha."
        : `O ${NOME_REDE[rede]} leva alguns minutos pra processar o vídeo. Esta caixa atualiza sozinha.`}</p>}
    </div>
  );
}

function Conectar({ postId, rede, motivo }: { postId: string; rede: RedeNova; motivo: string | null }) {
  const crm = useCrmDoPost(postId).data ?? null;
  const [indo, setIndo] = useState(false);
  return (
    <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
      <p className="text-[12.5px] font-body text-muted-foreground">{motivo ?? `O ${NOME_REDE[rede]} deste perfil ainda não está conectado ao Cria.`}</p>
      <Button size="sm" className="rounded-xl" disabled={indo} onClick={async () => { setIndo(true); await conectarRede(rede, crm); setIndo(false); }}>
        {indo ? <Loader2 className="h-4 w-4 animate-spin" /> : `Conectar ${NOME_REDE[rede]}`}
      </Button>
    </div>
  );
}

function Botoes({ podeAgendar, ocupado, onAgendar, onAgora, travado }: { podeAgendar: boolean; ocupado: boolean; onAgendar: () => void; onAgora: () => void; travado: boolean }) {
  return (
    // Quebra em duas linhas quando não cabe (Walter, 25/11/2026: "o botao de
    // publicar agora ta cortado" na coluna do editor no computador).
    <div className="flex flex-wrap gap-2">
      <Button className="grow basis-[13rem] rounded-xl" disabled={!podeAgendar || ocupado || travado} onClick={onAgendar}>
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CalendarClock className="h-4 w-4 mr-1.5" />Agendar na data do post</>}
      </Button>
      <Button variant="outline" className="grow basis-[9rem] rounded-xl" disabled={!podeAgendar || ocupado || travado} onClick={onAgora}>
        <Send className="h-4 w-4 mr-1.5" />Publicar agora
      </Button>
    </div>
  );
}

function PainelTikTok({ postId, legenda }: { postId: string; legenda?: string | null }) {
  const cx = useConexaoRede(postId, "tiktok");
  const pub = usePublicacaoRede(postId, "tiktok").data;
  const conectado = !!cx.data?.connection_id && !!cx.data?.pode_publicar;
  const criador = useCriadorTikTok(postId, conectado);
  const agendar = useAgendarRede(postId, "tiktok");
  const agora = usePublicarAgoraRede(postId, "tiktok");

  const [texto, setTexto] = useState("");
  const [privacidade, setPrivacidade] = useState<string>("");
  const [comentario, setComentario] = useState(false);
  const [dueto, setDueto] = useState(false);
  const [costura, setCostura] = useState(false);
  const [comercial, setComercial] = useState(false);
  const [suaMarca, setSuaMarca] = useState(false);
  const [deMarca, setDeMarca] = useState(false);
  const [ia, setIa] = useState(false);
  useEffect(() => { setTexto(pub?.texto ?? legenda ?? ""); }, [pub?.texto, legenda]);

  if (cx.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!conectado) return <><Cabecalho postId={postId} rede="tiktok" /><Conectar postId={postId} rede="tiktok" motivo={cx.data?.motivo ?? null} /></>;
  if (criador.isLoading) return <p className="text-[12.5px] font-body text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Consultando a conta do TikTok…</p>;
  if (criador.error) return <p className="text-[12.5px] font-body text-amber-900">{(criador.error as Error).message}</p>;
  const c = criador.data;
  const opcoesPriv = c?.privacidades ?? [];
  const comercialIncompleto = comercial && !suaMarca && !deMarca;
  const somenteEuProibido = deMarca && privacidade === "SELF_ONLY";
  const travado = pub?.status === "publicando" || pub?.status === "processando" || pub?.status === "publicado";
  const podeAgendar = !!privacidade && !comercialIncompleto && !somenteEuProibido && texto.length <= 2200;
  const opcoes = {
    privacy_level: privacidade, disable_comment: !comentario, disable_duet: !dueto, disable_stitch: !costura,
    brand_content_toggle: comercial && deMarca, brand_organic_toggle: comercial && suaMarca, is_aigc: ia,
  };

  return (
    <div className="space-y-3">
      <Cabecalho postId={postId} rede="tiktok" />
      <div className="flex items-center gap-2.5">
        {c?.foto ? <img src={c.foto} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-muted" />}
        <div className="min-w-0"><p className="text-[13px] font-body font-bold truncate">{c?.nome ?? "Conta do TikTok"}{c?.usuario ? ` · @${c.usuario}` : ""}</p><p className="text-[11.5px] font-body text-muted-foreground">Vai sair nesta conta do TikTok{c?.duracaoMaxSeg ? ` · vídeo de até ${Math.floor(c.duracaoMaxSeg / 60)} min` : ""}</p></div>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Texto do post</p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={2200}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13.5px] font-body" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Quem pode ver</p>
        <select value={privacidade} onChange={(e) => setPrivacidade(e.target.value)}
          className="w-full h-10 rounded-xl border border-border bg-card px-3 text-[13.5px] font-body">
          <option value="" disabled>Escolha…</option>
          {opcoesPriv.map((p) => <option key={p} value={p} disabled={deMarca && p === "SELF_ONLY"}>{PRIVACIDADE[p] ?? p}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Permitir</p>
        <Marca marcado={comentario} desligado={c?.comentarioDesligado} nota={c?.comentarioDesligado ? "desligado no app" : undefined} onClick={() => setComentario((v) => !v)}>Comentários</Marca>
        <Marca marcado={dueto} desligado={c?.duetoDesligado} nota={c?.duetoDesligado ? "desligado no app" : undefined} onClick={() => setDueto((v) => !v)}>Dueto</Marca>
        <Marca marcado={costura} desligado={c?.costuraDesligada} nota={c?.costuraDesligada ? "desligado no app" : undefined} onClick={() => setCostura((v) => !v)}>Costura</Marca>
      </div>
      <div className="rounded-xl border border-border p-3 space-y-2">
        <label className="flex items-center gap-2.5 text-[13px] font-body font-bold"><Switch checked={comercial} onCheckedChange={(v) => { setComercial(v); if (!v) { setSuaMarca(false); setDeMarca(false); } }} />Divulgar conteúdo comercial</label>
        {comercial && (
          <div className="space-y-1.5">
            <Marca marcado={suaMarca} onClick={() => setSuaMarca((v) => !v)}>Sua marca <span className="text-muted-foreground font-normal">(aparece "Conteúdo promocional")</span></Marca>
            <Marca marcado={deMarca} onClick={() => setDeMarca((v) => !v)}>Conteúdo de marca <span className="text-muted-foreground font-normal">(aparece "Parceria paga")</span></Marca>
            {comercialIncompleto && <p className="text-[12px] font-body text-amber-900">Marque se é a sua marca, conteúdo de marca, ou os dois.</p>}
            {somenteEuProibido && <p className="text-[12px] font-body text-amber-900">Conteúdo de marca não pode sair como "Só eu". Escolha outra privacidade.</p>}
          </div>
        )}
      </div>
      <Marca marcado={ia} onClick={() => setIa((v) => !v)}>Tem conteúdo feito com IA</Marca>
      <p className="text-[11.5px] font-body text-muted-foreground leading-snug">
        Ao publicar, você concorda com a <a className="underline" href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer">Confirmação de Uso de Música</a> do TikTok
        {comercial && deMarca && <> e com a <a className="underline" href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer">Política de Conteúdo de Marca</a></>}.
        O TikTok leva alguns minutos pra processar o vídeo.
      </p>
      <Botoes podeAgendar={podeAgendar} travado={travado} ocupado={agendar.isPending || agora.isPending}
        onAgendar={() => agendar.mutate({ ligar: true, opcoes, texto })}
        onAgora={() => agora.mutate({ opcoes, texto })} />
    </div>
  );
}

/** "dd/mm às hh:mm" do publishAt, se ainda não chegou. */
function programadoPara(opcoes: Record<string, unknown> | null | undefined): string | null {
  const q = typeof opcoes?.publishAt === "string" ? Date.parse(opcoes.publishAt) : NaN;
  if (!Number.isFinite(q) || q <= Date.now()) return null;
  return new Date(q).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(", ", " às ");
}

/* YOUTUBE (Walter, 25/11/2026, mockup aprovado). O que é do vídeo (título,
   descrição, tags, miniatura, categoria) se escreve no post; a caixa só mostra
   o que vai junto e pergunta o que é da publicação: tipo, visibilidade,
   crianças e quando. "Na data do post" com vídeo público sobe já e fica
   programado no próprio YouTube (publishAt); não listado ou privado, o robô
   do Cria publica na hora. */
function PainelYouTube({ postId, titulo: tituloTela, aoVivo, antesDeAgir }: { postId: string; titulo?: string | null; aoVivo?: AoVivo; antesDeAgir?: () => Promise<void> }) {
  const qc = useQueryClient();
  const cx = useConexaoRede(postId, "youtube");
  const pub = usePublicacaoRede(postId, "youtube").data;
  const conectado = !!cx.data?.connection_id && !!cx.data?.pode_publicar;
  const post = usePostParaYouTube(postId, conectado).data;
  const agendar = useAgendarRede(postId, "youtube");
  const agora = usePublicarAgoraRede(postId, "youtube");
  const [tipo, setTipo] = useState<"short" | "video">("short");
  const [visib, setVisib] = useState<"" | "public" | "unlisted" | "private">("");
  const [criancas, setCriancas] = useState<null | boolean>(null);
  const [ia, setIa] = useState(false);
  const [quando, setQuando] = useState<"agora" | "data">("data");
  useEffect(() => {
    const o = (pub?.opcoes ?? {}) as Record<string, unknown>;
    if (o.tipo === "short" || o.tipo === "video") setTipo(o.tipo);
  }, [pub?.opcoes]);

  if (cx.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!conectado) return <><Cabecalho postId={postId} rede="youtube" /><Conectar postId={postId} rede="youtube" motivo={cx.data?.motivo ?? null} /></>;

  const yt = lerYoutube(post?.youtube);
  const tituloVideo = (yt.titulo || post?.title || tituloTela || "").trim();
  const descricao = post?.caption ?? "";
  const hs = hashtagsDaDescricao(descricao);
  const caps = (descricao.match(/^\d{1,2}:\d{2}(?::\d{2})? \S/gm) ?? []).length;
  const tags = yt.tags ?? [];
  const categoria = YT_CATEGORIAS.find((c) => c.id === (yt.categoria ?? "22"))?.nome ?? "Pessoas e blogs";
  const idioma = YT_IDIOMAS.find((c) => c.id === (yt.idioma ?? "pt-BR"))?.nome ?? "Português";

  // Data e hora do post: a da tela, se o editor estiver aberto; senão a salva. Brasil é UTC-3 o ano todo.
  const data = aoVivo?.data ?? post?.scheduled_date ?? null;
  const hora = (aoVivo?.hora ?? post?.scheduled_time ?? "09:00").slice(0, 5);
  const instante = data ? new Date(`${data}T${hora}:00-03:00`) : null;
  const dataValida = !!instante && instante.getTime() > Date.now() + 15 * 60_000;
  const diaTxt = instante ? instante.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(".", "") : "";
  const travado = pub?.status === "publicando" || pub?.status === "processando" || pub?.status === "publicado";
  const pronto = !!visib && criancas !== null && tituloVideo.length > 0;
  const podeAgendar = pronto && (quando === "agora" || dataValida);
  const opcoes = { privacyStatus: visib, selfDeclaredMadeForKids: criancas, containsSyntheticMedia: ia, tipo };

  const agir = async (f: () => void) => {
    try { await antesDeAgir?.(); } catch { /* o auto-save já avisa o erro */ }
    await qc.invalidateQueries({ queryKey: ["post-para-youtube", postId] });
    f();
  };
  const publicar = () => void agir(() => {
    if (quando === "agora") { agora.mutate({ opcoes, titulo: null, texto: null }); return; }
    if (visib === "public") { agora.mutate({ opcoes: { ...opcoes, publishAt: instante!.toISOString() }, titulo: null, texto: null }); return; }
    agendar.mutate({ ligar: true, opcoes, titulo: null, texto: null });
  });
  const rotuloBotao = quando === "agora" ? "Publicar agora"
    : visib === "public" ? `Enviar e programar pra ${instante ? instante.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "a data do post"}`
    : "Agendar na data do post";

  const Item = ({ cor, children, extra }: { cor: string; children: React.ReactNode; extra?: string }) => (
    <div className="flex items-center gap-2.5 rounded-2xl bg-muted/40 px-3 py-2 text-[13px] font-body font-bold">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", cor)} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {extra && <span className="text-[11.5px] font-semibold text-muted-foreground tabular-nums">{extra}</span>}
    </div>
  );

  return (
    <div className="space-y-3">
      <Cabecalho postId={postId} rede="youtube" />
      <div className="flex items-center gap-2.5 rounded-2xl bg-muted/40 p-2.5">
        <div className="relative h-9 w-9 shrink-0 rounded-full bg-foreground text-background grid place-items-center font-display text-[15px] font-extrabold">
          {(cx.data?.username ?? "Y").replace(/^@/, "").slice(0, 1).toUpperCase()}
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-[#E62117]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-body font-extrabold">{cx.data?.username ?? "Canal conectado"}</p>
          <p className="text-[11.5px] font-body text-muted-foreground">canal conectado</p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Tipo</p>
        <div className="flex gap-2"><Opcao ativo={tipo === "short"} onClick={() => setTipo("short")}>Short</Opcao><Opcao ativo={tipo === "video"} onClick={() => setTipo("video")}>Vídeo normal</Opcao></div>
        <p className="text-[11.5px] font-body text-muted-foreground">
          {tipo === "short" ? "Sai como Short se o vídeo for vertical ou quadrado e tiver até 3 minutos. Senão, sai como vídeo normal." : "Vídeo vertical e curto o YouTube trata como Short mesmo assim."}
        </p>
      </div>

      <div className="relative space-y-1.5 rounded-2xl border border-border p-3">
        <span className="absolute -top-2.5 right-3 rotate-3 rounded-full border-2 border-card bg-[#00A652] px-2.5 py-0.5 font-display text-[11.5px] font-extrabold text-white">tudo do post</span>
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Vai junto</p>
        <Item cor="bg-primary" extra={`${tituloVideo.length}/${YT_TITULO_MAX}`}>{tituloVideo || "Sem título"}</Item>
        <Item cor="bg-[#0061EE]">{caps ? `${caps} capítulos` : "Sem capítulos"} · {hs.length ? `${Math.min(hs.length, 3)} hashtags em cima do título` : "sem hashtag"}</Item>
        <Item cor="bg-[#FF77B9]" extra={`${contarTags(tags)}/${YT_TAGS_MAX}`}>{tags.length ? `${tags.length} tags` : "Sem tags"}</Item>
        <Item cor="bg-[#FFCF03]">{yt.miniatura_url ? "Miniatura própria" : "Capa automática do YouTube"}</Item>
        <Item cor="bg-[#00A652]">{categoria} · {idioma}</Item>
        <p className="text-[11.5px] font-body text-muted-foreground">Pra mudar, edite no post. A caixa não repete os campos.</p>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Visibilidade</p>
        <div className="flex gap-2"><Opcao ativo={visib === "public"} onClick={() => setVisib("public")}>Pública</Opcao><Opcao ativo={visib === "unlisted"} onClick={() => setVisib("unlisted")}>Não listada</Opcao><Opcao ativo={visib === "private"} onClick={() => setVisib("private")}>Privada</Opcao></div>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">É conteúdo feito para crianças?</p>
        <div className="flex gap-2"><Opcao ativo={criancas === true} onClick={() => setCriancas(true)}>Sim</Opcao><Opcao ativo={criancas === false} onClick={() => setCriancas(false)}>Não</Opcao></div>
      </div>
      <Marca marcado={ia} onClick={() => setIa((v) => !v)}>Tem cena feita com IA que parece real</Marca>

      <div className="space-y-1.5">
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Quando</p>
        <div className="flex gap-2"><Opcao ativo={quando === "agora"} onClick={() => setQuando("agora")}>Agora</Opcao><Opcao ativo={quando === "data"} onClick={() => setQuando("data")}>Na data do post</Opcao></div>
        {quando === "data" && (dataValida ? (
          <div className="relative flex overflow-hidden rounded-2xl bg-[#FFCF03] text-foreground">
            <div className="min-w-[84px] border-r-2 border-dashed border-black/25 px-3 py-2.5 text-center">
              <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em]">{diaTxt.split(",")[0]}</p>
              <p className="font-display text-[30px] font-extrabold leading-[0.9]">{instante!.getDate()}</p>
              <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em]">{instante!.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</p>
            </div>
            <div className="flex flex-col justify-center px-3.5">
              <p className="font-display text-[22px] font-extrabold leading-none">{hora}</p>
              <p className="mt-1 text-[12px] font-body font-bold">{visib === "public" ? "o próprio YouTube publica" : "o Cria publica na hora"}</p>
            </div>
            <span className="absolute -top-[7px] left-[77px] h-3.5 w-3.5 rounded-full bg-card" />
            <span className="absolute -bottom-[7px] left-[77px] h-3.5 w-3.5 rounded-full bg-card" />
          </div>
        ) : (
          <p className="rounded-xl bg-amber-100 px-3 py-2 text-[12.5px] font-body text-amber-900">
            {data ? "A data do post já passou ou está a menos de 15 minutos. Mude a data no post ou publique agora." : "O post ainda não tem data. Escolha a data e a hora no post ou publique agora."}
          </p>
        ))}
        {quando === "data" && dataValida && visib === "public" && (
          <p className="text-[11.5px] font-body text-muted-foreground leading-snug">O vídeo sobe agora como privado e programado. Na hora marcada o YouTube solta sozinho, já processado. Mudou a data do post depois? Ajuste no YouTube Studio.</p>
        )}
      </div>

      {pub?.status === "publicado" && !programadoPara(pub.opcoes) && <p className="text-[12px] font-body text-green-800 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Já está no YouTube.</p>}
      <p className="text-[11.5px] font-body text-muted-foreground text-center">Ao publicar, você concorda com os Termos do YouTube.</p>
      <Button className="w-full h-12 rounded-full text-[15px] font-extrabold" disabled={!podeAgendar || travado || agendar.isPending || agora.isPending} onClick={publicar}>
        {agendar.isPending || agora.isPending
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <>{quando === "agora" ? <Send className="h-4 w-4 mr-2" /> : <CalendarClock className="h-4 w-4 mr-2" />}{rotuloBotao}</>}
      </Button>
    </div>
  );
}

function PainelLinkedIn({ postId, legenda }: { postId: string; legenda?: string | null }) {
  const cx = useConexaoRede(postId, "linkedin");
  const pub = usePublicacaoRede(postId, "linkedin").data;
  const conectado = !!cx.data?.connection_id && !!cx.data?.pode_publicar;
  const vence = useVencimentoRede(postId, "linkedin", conectado).data ?? null;
  const midia = useMidiaDoPost(postId, conectado).data;
  const crm = useCrmDoPost(postId).data ?? null;
  const agendar = useAgendarRede(postId, "linkedin");
  const agora = usePublicarAgoraRede(postId, "linkedin");
  const [texto, setTexto] = useState("");
  const [visib, setVisib] = useState<"PUBLIC" | "CONNECTIONS">("PUBLIC");
  useEffect(() => {
    setTexto(pub?.texto ?? legenda ?? "");
    const v = (pub?.opcoes as Record<string, unknown> | null)?.visibility;
    if (v === "PUBLIC" || v === "CONNECTIONS") setVisib(v);
  }, [pub?.texto, pub?.opcoes, legenda]);

  if (cx.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!conectado) return <><Cabecalho postId={postId} rede="linkedin" /><Conectar postId={postId} rede="linkedin" motivo={cx.data?.motivo ?? "O LinkedIn deste perfil ainda não está conectado ao Cria. A conexão vale por 60 dias; o Cria avisa antes de vencer."} /></>;

  const dias = vence ? Math.ceil((new Date(vence).getTime() - Date.now()) / 86_400_000) : null;
  const venceTxt = vence ? new Date(vence).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null;
  const f = midia ? formatoLinkedInDaMidia(midia) : null;
  const erroMidia = f && "erro" in f ? f.erro : null;
  const travado = pub?.status === "publicando" || pub?.status === "processando" || pub?.status === "publicado";
  const semTexto = !!f && !("erro" in f) && f.formato === "texto" && !texto.trim();
  const podeAgendar = !!f && !erroMidia && !semTexto && texto.length <= 3000;
  const opcoes = { visibility: visib };

  return (
    <div className="space-y-3">
      <Cabecalho postId={postId} rede="linkedin" />
      {dias !== null && dias <= 7 && (
        <div className="rounded-xl bg-amber-100 px-3 py-2 text-[12.5px] font-body text-amber-900 flex items-start gap-2">
          <span className="flex-1">A conexão com o LinkedIn vence em {Math.max(dias, 0)} dia{dias === 1 ? "" : "s"}. O LinkedIn não renova sozinho.</span>
          <button type="button" className="font-bold underline shrink-0" onClick={() => void conectarRede("linkedin", crm)}>Reconectar</button>
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-[#0A66C2] text-white grid place-items-center text-[12px] font-body font-bold shrink-0">{(cx.data?.username ?? "in").slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0">
          <p className="text-[13px] font-body font-bold truncate">{cx.data?.username ?? "Perfil do LinkedIn"}</p>
          <p className="text-[11.5px] font-body text-muted-foreground">Vai sair no perfil pessoal{venceTxt ? ` · conexão vale até ${venceTxt}` : ""}</p>
        </div>
      </div>
      {f && !erroMidia && "rotulo" in f && <span className="inline-flex rounded-full bg-[#E8F1FB] px-2.5 py-1 text-[12px] font-body font-bold text-[#0A66C2]">{f.rotulo}</span>}
      {erroMidia && <p className="rounded-xl bg-amber-100 px-3 py-2 text-[12.5px] font-body text-amber-900">{erroMidia}</p>}
      <div className="space-y-1">
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Texto do post <span className="normal-case font-normal">({texto.length}/3000)</span></p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={3000}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13.5px] font-body" />
        {semTexto && <p className="text-[12px] font-body text-amber-900">Post sem foto nem vídeo precisa de texto.</p>}
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Quem pode ver</p>
        <div className="flex gap-2"><Opcao ativo={visib === "PUBLIC"} onClick={() => setVisib("PUBLIC")}>Todo mundo</Opcao><Opcao ativo={visib === "CONNECTIONS"} onClick={() => setVisib("CONNECTIONS")}>Só conexões</Opcao></div>
      </div>
      <p className="text-[11.5px] font-body text-muted-foreground leading-snug">Hashtag continua clicável. O LinkedIn não agenda: o Cria publica na data e hora do post.</p>
      {pub?.status === "publicado" && <p className="text-[12px] font-body text-green-800 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Já está no LinkedIn.</p>}
      <Botoes podeAgendar={podeAgendar} travado={travado} ocupado={agendar.isPending || agora.isPending}
        onAgendar={() => agendar.mutate({ ligar: true, opcoes, texto })}
        onAgora={() => agora.mutate({ opcoes, texto })} />
    </div>
  );
}
