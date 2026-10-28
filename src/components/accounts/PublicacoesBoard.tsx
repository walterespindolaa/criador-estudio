import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, ExternalLink, Instagram, Loader2, RotateCcw, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { hojeBR } from "@/lib/date-br";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useExternalClients, type ExternalClient } from "@/hooks/useCriaPost";
import { useDesfazerConferencia, usePublicarAgora, ehStory, type OpcoesIg } from "@/hooks/usePublicarInstagram";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConferenciaPublicacao } from "@/components/shared/ConferenciaPublicacao";
import { ConviteInstagramCliente } from "@/components/accounts/ConviteInstagramCliente";
import { CLIENT_COLORS } from "@/components/accounts/CriaPostBoard";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA POST › PUBLICAÇÕES (Walter, 28/10/2026; mockup aprovado)

   Tudo que vai pro Instagram dos clientes num lugar só:
     - Precisa de você: falta conferir e sai em menos de 2 h, não saiu,
       saiu com aviso da Meta, cliente que precisa reconectar o Instagram;
     - Hoje / Próximos dias: o post aprovado com data entra sozinho como
       "Falta conferir"; depois da conferência fica "Conferido, sai sozinho";
       sem aprovação, "Esperando o cliente" (dá pra liberar com motivo);
     - Já saiu: últimos 7 dias, pelo Cria ou pelo celular, com os números.
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

type PostPub = {
  id: string; title: string | null; format: string | null; external_client_id: string;
  scheduled_date: string | null; scheduled_time: string | null; approval_status: string | null;
  publish_status: string | null; publish_error: string | null; publish_aviso: string | null;
  auto_publish: boolean | null; publicar_em: string | null; published_at: string | null; ig_permalink: string | null;
  publish_conferido_em: string | null; publish_sem_aprovacao_motivo: string | null; ig_opcoes: OpcoesIg | null;
};
type StatusIg = { post_id: string; username: string | null; pode_publicar: boolean; motivo: string | null };
type Numeros = { post_id: string; metrics: Record<string, unknown> | null; captured_at: string | null };

type Situacao = "saiu" | "publicando" | "erro" | "conferido" | "conferir" | "esperando" | "celular" | "sem_conexao";

const SELO: Record<Situacao, { txt: string; cls: string }> = {
  saiu: { txt: "Saiu", cls: "bg-green-100 text-green-800" },
  publicando: { txt: "Publicando", cls: "bg-violet-100 text-violet-800" },
  erro: { txt: "Não saiu", cls: "bg-red-100 text-red-800" },
  conferido: { txt: "Conferido · sai sozinho", cls: "bg-sky-100 text-sky-800" },
  conferir: { txt: "Falta conferir", cls: "bg-amber-100 text-amber-900" },
  esperando: { txt: "Esperando o cliente", cls: "bg-muted text-muted-foreground" },
  celular: { txt: "Pelo celular", cls: "bg-muted text-muted-foreground" },
  sem_conexao: { txt: "Instagram não conectado", cls: "bg-red-50 text-red-800" },
};

function quando(data: string | null, hora: string | null) {
  if (!data) return "sem data";
  const hoje = hojeBR();
  const h = /^\d{1,2}:\d{2}/.test(hora ?? "") ? (hora as string).slice(0, 5) : "";
  if (data === hoje) return `hoje${h ? ` ${h}` : ""}`;
  const d = new Date(`${data}T12:00:00`);
  const dia = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
  return `${dia}${h ? ` ${h}` : ""}`;
}

function instante(data: string | null, hora: string | null): number | null {
  if (!data) return null;
  const h = /^\d{1,2}:\d{2}/.test(hora ?? "") ? (hora as string).slice(0, 5) : "09:00";
  return new Date(`${data}T${h}:00-03:00`).getTime();
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? NaN));
function fmt(v: unknown) {
  const n = num(v);
  if (!Number.isFinite(n)) return "—";
  return n >= 10_000 ? `${(n / 1000).toFixed(1).replace(".", ",")} mil` : n.toLocaleString("pt-BR");
}
function haQuanto(iso: string | null) {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `números de ${Math.max(1, min)} min atrás`;
  const h = Math.round(min / 60);
  return h < 48 ? `números de ${h} h atrás` : `números de ${Math.round(h / 24)} dias atrás`;
}

function addDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function PublicacoesBoard() {
  const { agencyOwnerId } = useActiveAccount();
  const { clients } = useExternalClients();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cli, setCli] = useState<string>("todos");
  const [conf, setConf] = useState<{ postId: string; agora: boolean; semAprovacao: boolean } | null>(null);
  const [convite, setConvite] = useState<ExternalClient | null>(null);
  const hoje = hojeBR();

  const { data: posts = [], isLoading } = useQuery<PostPub[]>({
    queryKey: ["publicacoes", agencyOwnerId, hoje],
    enabled: !!agencyOwnerId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const ini = addDias(hoje, -7), fim = addDias(hoje, 14);
      const { data, error } = await sbFrom("posts")
        .select("id,title,format,external_client_id,scheduled_date,scheduled_time,approval_status,publish_status,publish_error,publish_aviso,auto_publish,publicar_em,published_at,ig_permalink,publish_conferido_em,publish_sem_aprovacao_motivo,ig_opcoes")
        .or(`user_id.eq.${agencyOwnerId},agencia_id.eq.${agencyOwnerId}`)
        .not("external_client_id", "is", null)
        .is("deleted_at", null)
        .gte("scheduled_date", ini).lte("scheduled_date", fim)
        .order("scheduled_date", { ascending: true }).order("scheduled_time", { ascending: true, nullsFirst: true })
        .limit(300);
      if (error) throw error;
      return (data as unknown as PostPub[]) ?? [];
    },
  });

  const idsAbertos = useMemo(
    () => posts.filter((p) => p.publish_status !== "publicado" && p.approval_status !== "postado" && (p.scheduled_date ?? "") >= hoje).map((p) => p.id),
    [posts, hoje],
  );
  const { data: status = [] } = useQuery<StatusIg[]>({
    queryKey: ["publicacoes-status", idsAbertos.join(",")],
    enabled: idsAbertos.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbRpc("ig_status_publicacoes", { _post_ids: idsAbertos });
      if (error) return [];
      return (data as StatusIg[]) ?? [];
    },
  });
  const statusDe = useMemo(() => new Map(status.map((s) => [s.post_id, s])), [status]);

  const idsSaiu = useMemo(() => posts.filter((p) => p.publish_status === "publicado" || p.approval_status === "postado").map((p) => p.id), [posts]);
  const { data: numeros = [] } = useQuery<Numeros[]>({
    queryKey: ["publicacoes-numeros", idsSaiu.join(",")],
    enabled: idsSaiu.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await sbFrom("social_insights").select("post_id,metrics,captured_at").in("post_id", idsSaiu);
      return (data as unknown as Numeros[]) ?? [];
    },
  });
  const numerosDe = useMemo(() => new Map(numeros.map((n) => [n.post_id, n])), [numeros]);

  const limparAviso = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("posts").update({ publish_aviso: null } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["publicacoes"] }),
    onError: () => toast.error("Não deu pra marcar como resolvido."),
  });

  const cliente = useMemo(() => {
    const m: Record<string, { c: ExternalClient; cor: string }> = {};
    clients.forEach((c, i) => { m[c.id] = { c, cor: c.color || CLIENT_COLORS[i % CLIENT_COLORS.length] }; });
    return m;
  }, [clients]);

  const situacao = (p: PostPub): Situacao => {
    if (p.publish_status === "publicado" || p.approval_status === "postado") return "saiu";
    if (p.publish_status === "publicando") return "publicando";
    if (p.publish_status === "erro") return "erro";
    if (p.publish_status === "na_fila" && p.auto_publish) return "conferido";
    if (p.ig_opcoes?.musica_celular || p.ig_opcoes?.pelo_celular) return "celular";
    const st = statusDe.get(p.id);
    if (st && !st.pode_publicar) return "sem_conexao";
    if (p.approval_status === "aprovado") return "conferir";
    return "esperando";
  };

  const visiveis = posts.filter((p) => cli === "todos" || p.external_client_id === cli);
  const comSit = visiveis.map((p) => ({ p, s: situacao(p) }));

  // Precisa de você.
  const agoraMs = Date.now();
  const alertas: Array<{ chave: string; cliente?: ExternalClient; tag: string; tagCls: string; titulo: string; texto: string; acoes: Array<{ txt: string; fn: () => void; principal?: boolean }> }> = [];
  for (const { p, s } of comSit) {
    const c = cliente[p.external_client_id]?.c;
    const nome = p.title || "Post sem título";
    if (s === "conferir") {
      const t = instante(p.scheduled_date, p.scheduled_time);
      if (t && t - agoraMs <= 2 * 3600_000 && t > agoraMs - 5 * 60_000) {
        const min = Math.max(0, Math.round((t - agoraMs) / 60_000));
        alertas.push({ chave: `c-${p.id}`, cliente: c, tag: "FALTA CONFERIR", tagCls: "bg-amber-100 text-amber-900", titulo: nome,
          texto: `Sai ${quando(p.scheduled_date, p.scheduled_time)} (em ${min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`}). O cliente aprovou; falta alguém conferir. Sem conferência, não publica.`,
          acoes: [{ txt: "Conferir agora", principal: true, fn: () => setConf({ postId: p.id, agora: false, semAprovacao: false }) }] });
      }
    }
    if (s === "erro") {
      alertas.push({ chave: `e-${p.id}`, cliente: c, tag: "NÃO SAIU", tagCls: "bg-red-100 text-red-800", titulo: nome,
        texto: p.publish_error ?? "O Instagram recusou a publicação.",
        acoes: [
          { txt: "Tentar de novo", principal: true, fn: () => setConf({ postId: p.id, agora: true, semAprovacao: p.approval_status !== "aprovado" && !p.publish_sem_aprovacao_motivo }) },
          ...(c?.crm_client_id ? [{ txt: "Abrir o post", fn: () => navigate(`/socialmidia/clientes/${c.crm_client_id}/posts?post=${p.id}`) }] : []),
        ] });
    }
    if (s === "saiu" && p.publish_aviso) {
      alertas.push({ chave: `a-${p.id}`, cliente: c, tag: "SAIU COM AVISO", tagCls: "bg-amber-100 text-amber-900", titulo: nome, texto: p.publish_aviso,
        acoes: [
          ...(p.ig_permalink ? [{ txt: "Abrir no Instagram", principal: true, fn: () => window.open(p.ig_permalink!, "_blank", "noopener") }] : []),
          { txt: "Já arrumei", fn: () => limparAviso.mutate(p.id) },
        ] });
    }
  }
  // Cliente que precisa reconectar (um aviso por cliente, com quantos posts travam).
  const travados: Record<string, number> = {};
  for (const { p, s } of comSit) if (s === "sem_conexao" && p.approval_status === "aprovado") travados[p.external_client_id] = (travados[p.external_client_id] ?? 0) + 1;
  for (const [id, n] of Object.entries(travados)) {
    const c = cliente[id]?.c;
    alertas.push({ chave: `r-${id}`, cliente: c, tag: "RECONECTAR", tagCls: "bg-red-100 text-red-800", titulo: "Instagram sem permissão de publicar",
      texto: `${n} ${n === 1 ? "post aprovado não sai" : "posts aprovados não saem"} pelo Cria até o cliente conectar (ou reconectar) o Instagram. Mande o convite: a cliente autoriza pelo link, sem passar senha.`,
      acoes: c?.crm_client_id ? [{ txt: "Mandar convite", principal: true, fn: () => setConvite(c) }] : [] });
  }

  const faixas = [
    { k: "hoje", titulo: `Hoje · ${quando(hoje, null).replace("hoje", new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", ""))}`, sub: "na ordem do horário",
      itens: comSit.filter(({ p, s }) => p.scheduled_date === hoje && s !== "saiu") },
    { k: "prox", titulo: "Próximos dias", sub: "conferidos saem sozinhos", itens: comSit.filter(({ p, s }) => (p.scheduled_date ?? "") > hoje && s !== "saiu") },
    { k: "saiu", titulo: "Já saiu", sub: "últimos 7 dias", itens: comSit.filter(({ s }) => s === "saiu").reverse() },
  ];
  const conta = (s: Situacao) => comSit.filter((x) => x.s === s).length;

  return (
    <div className="space-y-5">
      {/* Resumo */}
      <div className="flex flex-wrap gap-2">
        {[
          { n: faixas[0].itens.length, r: "saem hoje" },
          { n: conta("conferir"), r: "faltam conferir", cls: "text-amber-700" },
          { n: alertas.length, r: "precisam de você", cls: alertas.length ? "text-red-600" : "" },
          { n: faixas[2].itens.length, r: "saíram (7 dias)" },
        ].map((x) => (
          <div key={x.r} className="rounded-2xl border bg-card px-4 py-2 min-w-[110px]">
            <p className={cn("font-display font-extrabold text-2xl leading-tight", x.cls)}>{x.n}</p>
            <p className="text-xs text-muted-foreground">{x.r}</p>
          </div>
        ))}
      </div>

      {/* Filtro por cliente */}
      <div role="group" aria-label="Filtrar por cliente" className="flex flex-wrap gap-2 items-center">
        {[{ id: "todos", nome: "Todos" }, ...clients.filter((c) => c.active !== false).map((c) => ({ id: c.id, nome: c.name }))].map((c) => {
          const on = cli === c.id;
          const cor = c.id === "todos" ? "#1C1C1A" : cliente[c.id]?.cor;
          const preso = c.id !== "todos" && !!travados[c.id];
          return (
            <button key={c.id} type="button" aria-pressed={on} onClick={() => setCli(c.id)}
              className={cn("h-10 pl-1.5 pr-3 rounded-full border text-[13px] font-semibold flex items-center gap-2 transition-colors",
                on ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted")}>
              <span className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0" style={{ background: cor }}>
                {c.id === "todos" ? clients.length : c.nome.slice(0, 2).toUpperCase()}
              </span>
              <span className="max-w-[140px] truncate">{c.nome}</span>
              {preso && <span className="w-2 h-2 rounded-full bg-red-500" title="Precisa reconectar o Instagram" />}
            </button>
          );
        })}
      </div>

      {/* Precisa de você */}
      {alertas.length > 0 && (
        <section aria-label="Precisa de você" className="rounded-3xl border border-red-200 bg-red-50/60 p-4">
          <h2 className="font-display font-bold text-lg text-red-900 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" /> Precisa de você <span className="font-body font-normal text-sm">· {alertas.length}</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alertas.map((a) => (
              <article key={a.chave} className="rounded-2xl border bg-card p-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {a.cliente && <span className="text-xs font-bold">{a.cliente.name}</span>}
                  <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5", a.tagCls)}>{a.tag}</span>
                </div>
                <p className="font-display font-bold text-[15px] leading-snug">{a.titulo}</p>
                <p className="text-[13px] text-foreground/80 leading-relaxed">{a.texto}</p>
                <div className="flex flex-wrap gap-2 mt-auto pt-1">
                  {a.acoes.map((x) => (
                    <Button key={x.txt} type="button" size="sm" variant={x.principal ? "default" : "outline"} onClick={x.fn}
                      className={cn("rounded-full h-9", x.principal && "bg-[#EA4918] hover:bg-[#d23f12] text-white")}>{x.txt}</Button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 items-start">
          {faixas.map((f) => (
            <section key={f.k} className="rounded-3xl bg-muted/50 p-3.5">
              <div className="flex items-baseline justify-between gap-2 px-1 mb-3">
                <h2 className="font-display font-bold text-lg">{f.titulo} <span className="font-body font-normal text-sm text-muted-foreground">· {f.itens.length}</span></h2>
                <span className="text-xs text-muted-foreground">{f.sub}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {f.itens.length === 0 && <p className="text-sm text-muted-foreground px-1 py-2">Nada aqui{cli !== "todos" ? " pra esse cliente" : ""}.</p>}
                {f.itens.map(({ p, s }) => (
                  <CardPublicacao key={p.id} p={p} s={s} cli={cliente[p.external_client_id]} st={statusDe.get(p.id)} numeros={numerosDe.get(p.id)}
                    onConferir={(agora, semAprovacao) => setConf({ postId: p.id, agora, semAprovacao })}
                    onAbrir={() => { const c = cliente[p.external_client_id]?.c; if (c?.crm_client_id) navigate(`/socialmidia/clientes/${c.crm_client_id}/posts?post=${p.id}`); }}
                    onConvite={() => { const c = cliente[p.external_client_id]?.c; if (c) setConvite(c); }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed px-1">
        Post aprovado e com data entra aqui como "Falta conferir" e só sai depois que alguém confere o perfil, a mídia e a legenda.
        Faltando 2 horas sem conferência, vai pro "Precisa de você" e não publica. Dá pra publicar sem a aprovação do cliente: passa pela mesma conferência e fica registrado quem liberou.
      </p>

      {conf && (
        <ConferenciaPublicacao postId={conf.postId} open onOpenChange={(v) => { if (!v) setConf(null); }} agora={conf.agora} semAprovacao={conf.semAprovacao}
          onConcluido={() => qc.invalidateQueries({ queryKey: ["publicacoes"] })} />
      )}
      <Dialog open={!!convite} onOpenChange={(v) => { if (!v) setConvite(null); }}>
        <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] rounded-3xl">
          <DialogHeader><DialogTitle className="font-display">Conectar o Instagram de {convite?.name}</DialogTitle></DialogHeader>
          {convite?.crm_client_id && <ConviteInstagramCliente crmClientId={convite.crm_client_id} nomeCliente={convite.name} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CardPublicacao({ p, s, cli, st, numeros, onConferir, onAbrir, onConvite }: {
  p: PostPub; s: Situacao; cli?: { c: ExternalClient; cor: string }; st?: StatusIg; numeros?: Numeros;
  onConferir: (agora: boolean, semAprovacao: boolean) => void; onAbrir: () => void; onConvite: () => void;
}) {
  const desfazer = useDesfazerConferencia(p.id);
  const publicar = usePublicarAgora(p.id);
  const selo = SELO[s];
  const f = (p.format ?? "").toLowerCase();
  const rotuloFmt = f === "carrossel" ? "CARROSSEL" : f === "foto" ? "FOTO" : ehStory(f) ? "STORY" : "REELS";
  const m = (numeros?.metrics ?? {}) as Record<string, unknown>;
  const op = p.ig_opcoes ?? {};
  const extras = [
    ...(op.collaborators?.length ? [`Collab @${op.collaborators[0]}${op.collaborators.length > 1 ? ` +${op.collaborators.length - 1}` : ""}`] : []),
    ...(op.trial ? ["Reels de teste"] : []),
    ...(op.user_tags?.length ? [`${op.user_tags.length} marcada${op.user_tags.length > 1 ? "s" : ""}`] : []),
    ...(p.publish_sem_aprovacao_motivo ? ["Sem aprovação do cliente"] : []),
  ];
  const btn = "h-8 px-3 rounded-full text-xs";

  return (
    <article className="rounded-2xl border bg-card p-3 flex gap-3">
      <div className={cn("shrink-0 rounded-xl w-16 grid place-items-start p-1.5", f === "foto" || f === "carrossel" ? "h-20" : "h-24")}
        style={{ background: `linear-gradient(160deg, ${cli?.cor ?? "#888"}, ${cli?.cor ?? "#888"}88)` }}>
        <span className="text-[9px] font-extrabold tracking-wide text-white bg-black/35 rounded px-1.5 py-0.5">{rotuloFmt}</span>
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold truncate max-w-[130px]">{cli?.c.name ?? "Cliente"}</span>
          <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5", selo.cls)}>{selo.txt}</span>
        </div>
        <button type="button" onClick={onAbrir} className="text-left font-display font-bold text-sm leading-snug hover:underline">{p.title || "Post sem título"}</button>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarClock className="h-3 w-3" /> {quando(p.scheduled_date, p.scheduled_time)}{st?.username ? ` · @${st.username}` : ""}
        </p>
        {extras.length > 0 && (
          <div className="flex flex-wrap gap-1">{extras.map((x) => <span key={x} className="text-[10.5px] font-semibold bg-muted rounded-full px-2 py-0.5">{x}</span>)}</div>
        )}

        {s === "saiu" && (
          <>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {[["views", "Visualiz."], ["reach", "Alcance"], ["saved", "Salvos"], ["shares", "Compart."]].map(([k, r]) => (
                <div key={k} className="rounded-lg bg-muted/60 px-1.5 py-1">
                  <p className="font-display font-extrabold text-sm leading-none">{fmt(m[k])}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{r}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">{numeros ? haQuanto(numeros.captured_at) : p.approval_status === "postado" && !p.ig_permalink ? "postado pelo celular · ligue no Instagram do cliente" : "números em até 20 min"}</span>
              {p.ig_permalink && <a href={p.ig_permalink} target="_blank" rel="noreferrer" className="text-[11px] font-semibold flex items-center gap-1 hover:underline">Ver <ExternalLink className="h-3 w-3" /></a>}
            </div>
          </>
        )}

        {s === "conferido" && (
          <>
            <p className="text-[11.5px] text-muted-foreground">Conferido{p.publish_conferido_em ? ` ${new Date(p.publish_conferido_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}{p.publish_sem_aprovacao_motivo ? ` · sem aprovação: ${p.publish_sem_aprovacao_motivo}` : ""}.</p>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" className={cn(btn, "bg-foreground text-background")} disabled={publicar.isPending} onClick={() => publicar.mutate()}>
                {publicar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3 w-3 mr-1" /> Publicar agora</>}
              </Button>
              <Button type="button" size="sm" variant="outline" className={btn} disabled={desfazer.isPending} onClick={() => desfazer.mutate()}>Desfazer conferência</Button>
            </div>
          </>
        )}
        {s === "conferir" && (
          <>
            <p className="text-[11.5px] text-muted-foreground">Aprovado pelo cliente. Só sai depois da conferência.</p>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" className={cn(btn, "bg-[#EA4918] hover:bg-[#d23f12] text-white")} onClick={() => onConferir(false, false)}>Conferir</Button>
              <Button type="button" size="sm" variant="outline" className={btn} onClick={() => onConferir(true, false)}>Publicar agora</Button>
            </div>
          </>
        )}
        {s === "esperando" && (
          <>
            <p className="text-[11.5px] text-muted-foreground">Aprovou, vem pra conferência.</p>
            <div className="flex flex-wrap gap-1.5">
              {st?.pode_publicar && (
                <Button type="button" size="sm" variant="outline" className={cn(btn, "border-amber-300 text-amber-900")} onClick={() => onConferir(false, true)}>Publicar sem aprovação</Button>
              )}
            </div>
          </>
        )}
        {s === "erro" && (
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" className={cn(btn, "bg-[#EA4918] hover:bg-[#d23f12] text-white")}
              onClick={() => onConferir(true, p.approval_status !== "aprovado" && !p.publish_sem_aprovacao_motivo)}>
              <RotateCcw className="h-3 w-3 mr-1" /> Tentar de novo
            </Button>
          </div>
        )}
        {s === "publicando" && <p className="text-[11.5px] text-violet-800 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Publicando agora.</p>}
        {s === "celular" && <p className="text-[11.5px] text-muted-foreground flex items-center gap-1"><Smartphone className="h-3 w-3" /> {p.ig_opcoes?.pelo_celular ? "Tem figurinha" : "Vai com música do Instagram"}: baixe a mídia e publique pelo app.</p>}
        {s === "sem_conexao" && (
          <>
            <p className="text-[11.5px] text-red-800">{st?.motivo ?? "O Instagram deste cliente não está conectado."}</p>
            {cli?.c.crm_client_id && (
              <div><Button type="button" size="sm" variant="outline" className={btn} onClick={onConvite}><Instagram className="h-3 w-3 mr-1" /> Mandar convite</Button></div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
