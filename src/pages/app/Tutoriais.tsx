/* ═══════════════════════════════════════════════════════════════════════════
   TUTORIAIS (Walter, 02/10/2026) · mockup aprovado "Tutoriais do Cria"

   Uma tela só, montada nas duas cascas:
     /app/tutoriais          criador de conteúdo
     /socialmidia/tutoriais  social mídia (e o parceiro puro, que vê a trilha dele)
   Cada pessoa vê SÓ a sua trilha, decidida pelo lugar onde ela está no app.
   Admin escolhe a trilha num seletor, pra conferir tudo.

   ?v=<slug> abre o player. O progresso é salvo a cada 15s e no fim do vídeo,
   pelo player.js do Bunny. Se o script do player não carregar, o vídeo toca
   igual e o "Marcar como visto" continua funcionando na mão.

   Fica separado do Aprender de propósito: a decisão de 14/06 mantém o Aprender
   "Em breve" até existirem mais 2 cursos. Tutorial é ajuda do produto.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useOutletContext, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock, PlayCircle, Search } from "lucide-react";
import { ModuleHero } from "@/components/brand/ModuleHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { useSouParceiro } from "@/hooks/useParceiro";
import type { ManagerOutletContext } from "@/components/accounts/managerOutlet";
import {
  TRILHA_NOME, agruparPorModulo, duracaoTexto, thumbDoTutorial,
  useCatalogoTutoriais, useProgressoTutoriais, useSalvarProgresso,
  type Progresso, type Trilha, type Tutorial,
} from "@/hooks/useTutoriais";

/* Módulos que ainda vão ganhar vídeo. Some daqui sozinho quando o primeiro
   vídeo do módulo entra no catálogo (casado pelo código do módulo). */
const EM_PRODUCAO: Record<Trilha, { modulo: string; nome: string }[]> = {
  social_midia: [
    { modulo: "cria-gestao", nome: "Cria Gestão" },
    { modulo: "cria-caixa", nome: "Cria Caixa" },
    { modulo: "cria-captacao", nome: "Cria Captação" },
    { modulo: "cria-radar", nome: "Cria Radar" },
  ],
  criador: [],
  parceiro: [{ modulo: "parceiro", nome: "Sua fila de demandas" }],
};

function Thumb({ t, className, children }: { t: Tutorial; className?: string; children?: React.ReactNode }) {
  const [erro, setErro] = useState(false);
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-[#9E1553] to-[#E2588F]", className)}>
      {!erro && (
        <img src={thumbDoTutorial(t.slug)} alt="" loading="lazy" onError={() => setErro(true)} className="h-full w-full object-cover" />
      )}
      {erro && <PlayCircle className="absolute inset-0 m-auto h-10 w-10 text-white/80" />}
      {children}
    </div>
  );
}

function CardVideo({ t, rotulo, prog, href }: { t: Tutorial; rotulo: string; prog?: Progresso; href: string }) {
  const pct = prog?.visto ? 100 : prog?.pct ?? 0;
  return (
    <Link to={href} className="group flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-2.5 pb-3.5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Thumb t={t}>
        {t.duracao_s ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">{duracaoTexto(t.duracao_s)}</span>
        ) : null}
        {prog?.visto && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
            <Check className="h-3 w-3" /> Visto
          </span>
        )}
        {!prog?.visto && pct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30"><div className="h-full bg-[#E8458B]" style={{ width: `${pct}%` }} /></div>
        )}
      </Thumb>
      <div className="flex flex-col gap-0.5 px-1">
        <span className="text-xs font-body text-muted-foreground">{rotulo}</span>
        <span className="font-body text-[15px] font-bold leading-snug text-foreground">{t.titulo}</span>
      </div>
    </Link>
  );
}

const rotuloDe = (t: Tutorial) => (t.ordem === 0 ? "Visão geral" : `Vídeo ${t.ordem}`);

/* ─── player.js do Bunny (carrega uma vez, sob demanda) ─── */
type PlayerJs = {
  on: (ev: string, cb: (d?: { seconds?: number; duration?: number }) => void) => void;
  setCurrentTime: (s: number) => void;
};
let promessaPlayerJs: Promise<unknown> | null = null;
function carregarPlayerJs() {
  if ((window as unknown as { playerjs?: unknown }).playerjs) return Promise.resolve();
  if (!promessaPlayerJs) {
    promessaPlayerJs = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = "https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js";
      s.async = true;
      s.onload = () => ok(undefined);
      s.onerror = () => { promessaPlayerJs = null; falha(new Error("playerjs")); };
      document.head.appendChild(s);
    });
  }
  return promessaPlayerJs;
}

function Player({ t, lista, prog, base }: { t: Tutorial; lista: Tutorial[]; prog?: Progresso; base: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const salvar = useSalvarProgresso();
  const ultimo = useRef({ segundos: prog?.segundos ?? 0, pct: prog?.pct ?? 0, salvoEm: 0 });
  const retomarDe = useRef(prog && !prog.visto && prog.pct < 95 ? prog.segundos : 0);
  const salvarRef = useRef(salvar.mutate);
  salvarRef.current = salvar.mutate;

  const i = lista.findIndex((x) => x.id === t.id);
  const anterior = i > 0 ? lista[i - 1] : null;
  const proximo = i >= 0 && i < lista.length - 1 ? lista[i + 1] : null;

  useEffect(() => {
    retomarDe.current = prog && !prog.visto && prog.pct < 95 ? prog.segundos : 0;
    ultimo.current = { segundos: prog?.segundos ?? 0, pct: prog?.pct ?? 0, salvoEm: 0 };
    let vivo = true;
    carregarPlayerJs().then(() => {
      if (!vivo || !iframeRef.current) return;
      const PJ = (window as unknown as { playerjs: { Player: new (el: HTMLIFrameElement) => PlayerJs } }).playerjs;
      const p = new PJ.Player(iframeRef.current);
      p.on("ready", () => {
        if (retomarDe.current > 5) p.setCurrentTime(retomarDe.current);
        p.on("timeupdate", (d) => {
          const seg = d?.seconds ?? 0;
          const dur = d?.duration || t.duracao_s || 0;
          if (!dur) return;
          const pct = (seg / dur) * 100;
          ultimo.current = { ...ultimo.current, segundos: seg, pct };
          const agora = Date.now();
          if (agora - ultimo.current.salvoEm > 15000) {
            ultimo.current.salvoEm = agora;
            salvarRef.current({ tutorial_id: t.id, segundos: seg, pct, visto: pct >= 90 });
          }
        });
        p.on("ended", () => {
          ultimo.current.salvoEm = Date.now();
          salvarRef.current({ tutorial_id: t.id, segundos: t.duracao_s ?? 0, pct: 100, visto: true });
        });
      });
    }).catch(() => { /* sem player.js: o vídeo toca igual, só não guarda a posição */ });
    return () => {
      vivo = false;
      const u = ultimo.current;
      if (u.segundos > 3 && Date.now() - u.salvoEm > 2000) {
        salvarRef.current({ tutorial_id: t.id, segundos: u.segundos, pct: u.pct, visto: u.pct >= 90 });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id]);

  const visto = !!prog?.visto;
  const src = `https://iframe.mediadelivery.net/embed/${t.bunny_library_id}/${t.bunny_video_id}?autoplay=true&preload=true&responsive=true`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link to={base} className="inline-flex min-h-[44px] items-center gap-2 font-body text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Todos os tutoriais
        </Link>
        <span className="font-body text-sm text-muted-foreground">{t.modulo_nome} · vídeo {i + 1} de {lista.length}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="flex flex-col gap-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-lg">
            <iframe
              key={t.id}
              ref={iframeRef}
              src={src}
              title={t.titulo}
              loading="eager"
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-2xl flex-col gap-1">
              <span className="font-body text-xs font-bold uppercase tracking-wider text-[#B3195E] dark:text-[#F08DB8]">{t.modulo_nome} · {rotuloDe(t)}</span>
              <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{t.titulo}</h1>
              {t.descricao && <p className="font-body text-[15px] leading-relaxed text-muted-foreground">{t.descricao}</p>}
            </div>
            <Button
              variant={visto ? "default" : "outline"}
              className={cn("min-h-[44px] gap-2 rounded-full", visto && "bg-emerald-600 hover:bg-emerald-700")}
              aria-pressed={visto}
              onClick={() => salvar.mutate({
                tutorial_id: t.id,
                segundos: ultimo.current.segundos,
                pct: visto ? ultimo.current.pct : 100,
                forcarVisto: !visto,
              })}
            >
              <Check className="h-4 w-4" /> {visto ? "Visto" : "Marcar como visto"}
            </Button>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            {anterior ? (
              <Button variant="outline" className="min-h-[44px] rounded-full" asChild>
                <Link to={`${base}?v=${anterior.slug}`}><ArrowLeft className="mr-1.5 h-4 w-4" /> {anterior.titulo}</Link>
              </Button>
            ) : <span />}
            {proximo && (
              <Button className="min-h-[44px] rounded-full bg-[#E8458B] text-white hover:bg-[#D23A7C]" asChild>
                <Link to={`${base}?v=${proximo.slug}`}>Próximo: {proximo.titulo} <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-baseline justify-between px-1 pb-2">
            <h2 className="font-display text-lg font-bold">{t.modulo_nome}</h2>
            <span className="font-body text-xs text-muted-foreground">{lista.length} vídeos</span>
          </div>
          {lista.map((v) => {
            const atual = v.id === t.id;
            return (
              <Link
                key={v.id}
                to={`${base}?v=${v.slug}`}
                aria-current={atual ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-2 transition-colors",
                  atual ? "bg-[#FCE3EE] shadow-[inset_3px_0_0_#E8458B] dark:bg-[#E8458B]/15" : "hover:bg-accent/60",
                )}
              >
                <Thumb t={v} className="w-28 shrink-0 rounded-lg">
                  {v.duracao_s ? <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[11px] text-white">{duracaoTexto(v.duracao_s)}</span> : null}
                </Thumb>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-body text-xs text-muted-foreground">{atual ? "Assistindo agora" : rotuloDe(v)}</span>
                  <span className="font-body text-sm font-bold leading-snug">{v.titulo}</span>
                </div>
              </Link>
            );
          })}
        </aside>
      </div>
    </div>
  );
}

export default function Tutoriais() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const ctx = useOutletContext<Partial<ManagerOutletContext> | undefined>();
  const { profile } = useProfile();
  const naAgencia = pathname.startsWith("/socialmidia");
  const { data: souParceiro } = useSouParceiro();
  const ehAdmin = profile?.role === "admin";

  const trilhaDoLugar: Trilha = naAgencia ? (ctx?.parceiroPuro ? "parceiro" : "social_midia") : "criador";
  const [trilhaAdmin, setTrilhaAdmin] = useState<Trilha | null>(null);
  const trilha = ehAdmin && trilhaAdmin ? trilhaAdmin : trilhaDoLugar;
  // Social mídia que também produz pra outras agências vê as duas trilhas.
  const trilhas: Trilha[] = trilha === "social_midia" && souParceiro && !ehAdmin ? ["social_midia", "parceiro"] : [trilha];

  const base = naAgencia ? "/socialmidia/tutoriais" : "/app/tutoriais";
  const { data: catalogo = [], isLoading } = useCatalogoTutoriais();
  const { data: progresso = {} } = useProgressoTutoriais();
  const [busca, setBusca] = useState("");

  const daTrilha = useMemo(() => catalogo.filter((t) => trilhas.includes(t.publico)), [catalogo, trilhas.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const modulos = useMemo(() => agruparPorModulo(daTrilha), [daTrilha]);

  const slug = params.get("v");
  const abrindo = slug ? daTrilha.find((t) => t.slug === slug) ?? (ehAdmin ? catalogo.find((t) => t.slug === slug) : undefined) : undefined;

  useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  if (abrindo) {
    const doModulo = catalogo.filter((t) => t.publico === abrindo.publico && t.modulo === abrindo.modulo);
    return (
      <div className="mx-auto w-full max-w-7xl">
        <Player t={abrindo} lista={doModulo} prog={progresso[abrindo.id]} base={base} />
      </div>
    );
  }

  const vistos = daTrilha.filter((t) => progresso[t.id]?.visto).length;
  const continuar = daTrilha
    .map((t) => ({ t, p: progresso[t.id] }))
    .filter((x) => x.p && !x.p.visto && x.p.pct > 2 && x.p.pct < 95)
    .sort((a, b) => (b.p!.atualizado_em > a.p!.atualizado_em ? 1 : -1))[0];

  const termo = busca.trim().toLowerCase();
  const modulosFiltrados = termo
    ? modulos.map((m) => ({ ...m, videos: m.videos.filter((v) => `${v.titulo} ${v.descricao ?? ""} ${m.nome}`.toLowerCase().includes(termo)) })).filter((m) => m.videos.length)
    : modulos;

  const codigos = new Set(daTrilha.map((t) => t.modulo));
  const emProducao = trilhas.flatMap((tr) => EM_PRODUCAO[tr]).filter((m) => !codigos.has(m.modulo));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <ModuleHero
        title="Tutoriais"
        subtitle="Vídeos curtos com a tela do Cria. Um assunto por vídeo, no seu ritmo."
        color="rosa"
        actions={ehAdmin ? (
          <Select value={trilha} onValueChange={(v) => setTrilhaAdmin(v as Trilha)}>
            <SelectTrigger className="h-9 w-[210px] bg-background/70" aria-label="Trilha (só admin)"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TRILHA_NOME) as Trilha[]).map((k) => <SelectItem key={k} value={k}>Trilha: {TRILHA_NOME[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : undefined}
      >
        {daTrilha.length > 0 && (
          <div className="flex max-w-md items-center gap-3 pb-5 font-body text-sm text-muted-foreground">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-[#E8458B] transition-all" style={{ width: `${(vistos / daTrilha.length) * 100}%` }} />
            </div>
            <span className="shrink-0">Você já viu {vistos} de {daTrilha.length}</span>
          </div>
        )}
      </ModuleHero>

      {continuar && !termo && (
        <section className="mb-8 grid items-center gap-5 rounded-3xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,320px)_1fr] sm:p-5">
          <Link to={`${base}?v=${continuar.t.slug}`} aria-label={`Continuar: ${continuar.t.titulo}`}>
            <Thumb t={continuar.t} className="rounded-2xl">
              <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8458B]/95 text-white shadow-lg">
                <PlayCircle className="h-7 w-7" />
              </span>
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/30"><div className="h-full bg-[#E8458B]" style={{ width: `${continuar.p!.pct}%` }} /></div>
            </Thumb>
          </Link>
          <div className="flex flex-col items-start gap-2">
            <span className="font-body text-xs font-bold uppercase tracking-wider text-[#B3195E] dark:text-[#F08DB8]">Continue de onde parou</span>
            <h2 className="font-display text-xl font-bold leading-tight sm:text-2xl">{continuar.t.titulo}</h2>
            <span className="font-body text-sm text-muted-foreground">{continuar.t.modulo_nome} · {rotuloDe(continuar.t)} · {Math.round(continuar.p!.pct)}% assistido</span>
            <Button className="mt-1 min-h-[44px] rounded-full bg-[#E8458B] px-5 text-white hover:bg-[#D23A7C]" asChild>
              <Link to={`${base}?v=${continuar.t.slug}`}><PlayCircle className="mr-1.5 h-4 w-4" /> Continuar</Link>
            </Button>
          </div>
        </section>
      )}

      {daTrilha.length > 3 && (
        <div className="relative mb-6 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: aprovação, relatório, link..." aria-label="Buscar vídeo" className="h-11 rounded-full pl-9" />
        </div>
      )}

      {isLoading && <p className="font-body text-sm text-muted-foreground">Carregando os vídeos...</p>}

      {!isLoading && daTrilha.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center font-body text-muted-foreground">
          Os vídeos da sua trilha estão sendo gravados. Assim que o primeiro ficar pronto, ele aparece aqui.
        </div>
      )}

      {termo && modulosFiltrados.length === 0 && (
        <p className="font-body text-sm text-muted-foreground">Nenhum vídeo com "{busca}".</p>
      )}

      <div className="flex flex-col gap-10">
        {modulosFiltrados.map((m) => {
          const min = Math.max(1, Math.round(m.videos.reduce((s, v) => s + (v.duracao_s ?? 0), 0) / 60));
          return (
            <section key={`${m.publico}:${m.modulo}`} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  {trilhas.length > 1 && <span className="font-body text-xs font-bold uppercase tracking-wider text-[#B3195E] dark:text-[#F08DB8]">{TRILHA_NOME[m.publico]}</span>}
                  <h2 className="font-display text-2xl font-bold">{m.nome}</h2>
                </div>
                <span className="inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> {m.videos.length} {m.videos.length === 1 ? "vídeo" : "vídeos"} · {min} min
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {m.videos.map((v) => (
                  <CardVideo key={v.id} t={v} rotulo={rotuloDe(v)} prog={progresso[v.id]} href={`${base}?v=${v.slug}`} />
                ))}
              </div>
            </section>
          );
        })}

        {!termo && emProducao.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-xl font-bold text-muted-foreground">Em produção</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {emProducao.map((m) => (
                <div key={m.modulo} className="flex flex-col gap-1 rounded-2xl border border-dashed border-border bg-card/60 p-4">
                  <span className="font-display text-lg font-bold">{m.nome}</span>
                  <span className="font-body text-xs text-muted-foreground">Vídeos chegando</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
