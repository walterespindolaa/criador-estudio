import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clapperboard, Layers, ImageOff } from "lucide-react";
import { getDisplayImageUrl, isVideoMedia } from "@/lib/driveMedia";
import type { PortalPost } from "@/pages/AprovarPortal";

/* ═══════════════════════════════════════════════════════════════════════════
   O CLIENTE VÊ O MÊS, NÃO SÓ A FILA (Walter, 28/09/2026)

   "O cliente conseguir visualizar em formato de calendário quando encaminhado
   o Cria Post pra ele: se a social mídia colocou a data, ele não vê só o post
   pra aprovação, mas vê tanto em grid conforme a data quanto em calendário."

   Duas visões novas no link de aprovação, ao lado da lista de sempre:

     Feed        a grade do perfil como vai ficar: 3 colunas, a data mais
                 recente em cima (é assim que o Instagram empilha), com a
                 capa do Reels quando existe.
     Calendário  o mês com a miniatura de cada dia. Tocar no dia lista os
                 posts dele; tocar no post leva pra aprovação dele.

   Aprovar continua sendo na lista: aqui é pra ele ENXERGAR o conjunto.
   ═══════════════════════════════════════════════════════════════════════════ */

type Capas = Record<string, string>;

const STATUS_COR: Record<string, { cor: string; rotulo: string }> = {
  pendente: { cor: "#F59E0B", rotulo: "Aguardando você" },
  ajuste_solicitado: { cor: "#EA580C", rotulo: "Ajuste pedido" },
  aprovado: { cor: "#16A34A", rotulo: "Aprovado" },
};

/** A imagem que representa o post num quadradinho: capa do Reels, senão a
 *  primeira mídia (miniatura do Drive, do vídeo ou a própria imagem). */
export function imagemDoPost(p: PortalPost, capas: Capas): string | null {
  if (capas[p.post_id]) return capas[p.post_id];
  const m = (Array.isArray(p.media) ? p.media : [])[0];
  if (!m) return null;
  const drive = getDisplayImageUrl(m, 500);
  if (drive && /drive\.google/.test(drive)) return drive;
  if (isVideoMedia(m)) return m.thumbnail_url || null;
  return m.thumbnail_url || m.view_url || null;
}

const ehVideo = (f: string) => ["reels", "reel", "video", "shorts"].includes((f || "").toLowerCase());
const ehCarrossel = (f: string) => (f || "").toLowerCase() === "carrossel";
const ddmm = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
/** Hoje no relógio de quem está olhando. toISOString é UTC: depois das 21h
 *  no Brasil já seria amanhã (revisão 28/09). */
function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Miniatura({ p, capas, brand, grande }: { p: PortalPost; capas: Capas; brand: string | null; grande?: boolean }) {
  const src = imagemDoPost(p, capas);
  const [falhou, setFalhou] = useState(false);
  return (
    <>
      {src && !falhou
        ? <img src={src} alt="" loading="lazy" onError={() => setFalhou(true)} className="absolute inset-0 w-full h-full object-cover" />
        : (
          <span className="absolute inset-0 grid place-items-center" style={{ background: brand ? `${brand}1f` : "hsl(var(--primary) / 0.1)" }}>
            <span className="text-center px-1.5">
              <ImageOff className={grande ? "h-5 w-5 mx-auto mb-1" : "h-3.5 w-3.5 mx-auto"} style={{ color: brand ?? "hsl(var(--primary))" }} />
              {grande && <span className="block text-[10.5px] font-body font-semibold leading-tight line-clamp-3" style={{ color: brand ?? "hsl(var(--primary))" }}>{p.title}</span>}
            </span>
          </span>
        )}
      {ehVideo(p.format) && <Clapperboard className={`absolute ${grande ? "right-1.5 top-1.5 h-4 w-4" : "right-0.5 top-0.5 h-2.5 w-2.5"} text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]`} />}
      {ehCarrossel(p.format) && <Layers className={`absolute ${grande ? "right-1.5 top-1.5 h-4 w-4" : "right-0.5 top-0.5 h-2.5 w-2.5"} text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]`} />}
    </>
  );
}

/* ── FEED ─────────────────────────────────────────────────────────────────── */
export function PortalFeed({ posts, capas, brand, aoAbrir }: {
  posts: PortalPost[]; capas: Capas; brand: string | null; aoAbrir: (id: string) => void;
}) {
  // O Instagram empilha do mais novo pro mais antigo: a data mais distante
  // fica no canto de cima. Sem data vai pro fim, com o selo "sem data".
  const ordem = useMemo(() => [...posts]
    .filter((p) => (p.format || "").toLowerCase() !== "story")
    .sort((a, b) => {
      if (!a.scheduled_date && !b.scheduled_date) return 0;
      if (!a.scheduled_date) return 1;
      if (!b.scheduled_date) return -1;
      return b.scheduled_date.localeCompare(a.scheduled_date);
    }), [posts]);
  const stories = posts.length - ordem.length;

  if (ordem.length === 0) {
    return <p className="text-center text-sm font-body text-muted-foreground py-10">Nenhum post de feed neste link.</p>;
  }
  return (
    <div>
      <p className="text-[12.5px] font-body text-muted-foreground text-center mb-3">
        Assim o seu perfil vai ficar. Toque num post pra ver e aprovar.
      </p>
      <div className="grid grid-cols-3 gap-0.5 rounded-2xl overflow-hidden border border-border bg-border max-w-[560px] mx-auto">
        {ordem.map((p) => {
          const st = STATUS_COR[p.approval_status];
          return (
            <button key={p.post_id} type="button" onClick={() => aoAbrir(p.post_id)}
              className="relative aspect-[3/4] bg-muted overflow-hidden group focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={`${p.title}${p.scheduled_date ? `, ${ddmm(p.scheduled_date)}` : ""}${st ? `, ${st.rotulo}` : ""}`}>
              <Miniatura p={p} capas={capas} brand={brand} grande />
              <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/55 to-transparent" />
              <span className="absolute left-1.5 bottom-1.5 text-[11px] font-body font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
                {p.scheduled_date ? ddmm(p.scheduled_date) : "sem data"}
              </span>
              {st && (
                <span className="absolute left-1.5 top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: st.cor }} title={st.rotulo} />
              )}
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-3 mt-3 flex-wrap text-[11.5px] font-body text-muted-foreground">
        {Object.values(STATUS_COR).map((s) => (
          <span key={s.rotulo} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.cor }} /> {s.rotulo}
          </span>
        ))}
      </div>
      {stories > 0 && (
        <p className="text-center text-[11.5px] font-body text-muted-foreground mt-2">
          {stories} story{stories === 1 ? "" : "s"} fora da grade (story não fica no perfil). Estão no calendário e na lista.
        </p>
      )}
    </div>
  );
}

/* ── CALENDÁRIO DO MÊS ────────────────────────────────────────────────────── */
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export function PortalMes({ posts, capas, brand, aoAbrir }: {
  posts: PortalPost[]; capas: Capas; brand: string | null; aoAbrir?: (id: string) => void;
}) {
  const comData = useMemo(() => posts.filter((p) => !!p.scheduled_date)
    .sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "")), [posts]);
  const semData = posts.length - comData.length;

  // Abre no mês do primeiro post pendente; senão no do primeiro com data.
  const inicial = useMemo(() => {
    const alvo = comData.find((p) => p.approval_status !== "aprovado") ?? comData[0];
    const iso = alvo?.scheduled_date ?? hojeLocal();
    return { ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) - 1 };
  }, [comData]);
  const [ref, setRef] = useState(inicial);
  /* Se a aba abriu antes dos posts chegarem, o mês inicial era o de hoje e
     ficava. Na primeira vez que chegam posts com data, pula pro mês certo. */
  const sincronizou = useRef(comData.length > 0);
  useEffect(() => {
    if (!sincronizou.current && comData.length > 0) { sincronizou.current = true; setRef(inicial); }
  }, [comData.length, inicial]);
  const [dia, setDia] = useState<string | null>(null);
  const accent = brand ?? "hsl(var(--primary))";

  if (comData.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CalendarDays className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-body text-muted-foreground">Nenhum post com data ainda.</p>
      </div>
    );
  }

  const porDia = new Map<string, PortalPost[]>();
  for (const p of comData) porDia.set(p.scheduled_date!, [...(porDia.get(p.scheduled_date!) ?? []), p]);

  const primeiro = new Date(ref.ano, ref.mes, 1);
  const diasNoMes = new Date(ref.ano, ref.mes + 1, 0).getDate();
  const vazios = primeiro.getDay();
  const iso = (d: number) => `${ref.ano}-${String(ref.mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const hoje = hojeLocal();
  // "setembro de 2026" -> "Setembro de 2026" (o capitalize do CSS faria "De").
  const nomeMes = (() => { const t = primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); })();
  const andar = (n: number) => { setDia(null); setRef((r) => { const d = new Date(r.ano, r.mes + n, 1); return { ano: d.getFullYear(), mes: d.getMonth() }; }); };
  const doDia = dia ? porDia.get(dia) ?? [] : [];

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => andar(-1)} aria-label="Mês anterior" className="h-10 w-10 grid place-items-center rounded-xl border border-border bg-card hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
        <p className="font-display font-extrabold text-foreground">{nomeMes}</p>
        <button type="button" onClick={() => andar(1)} aria-label="Próximo mês" className="h-10 w-10 grid place-items-center rounded-xl border border-border bg-card hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {SEMANA.map((s, i) => <span key={i} className="text-[11px] font-body font-bold text-muted-foreground">{s}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: vazios }).map((_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: diasNoMes }).map((_, i) => {
          const d = i + 1;
          const k = iso(d);
          const lista = porDia.get(k) ?? [];
          const p0 = lista[0];
          const ativo = dia === k;
          return (
            <button key={k} type="button" disabled={lista.length === 0} onClick={() => setDia(ativo ? null : k)}
              className={`relative aspect-square rounded-lg overflow-hidden border text-left transition-shadow ${lista.length ? "border-transparent hover:shadow-md" : "border-border/60 bg-card"} ${ativo ? "ring-2 ring-offset-1" : ""}`}
              style={ativo ? { ["--tw-ring-color" as string]: accent } : undefined}
              aria-label={`${d}${lista.length ? `, ${lista.length} post${lista.length > 1 ? "s" : ""}` : ""}`}>
              {p0 && <Miniatura p={p0} capas={capas} brand={brand} />}
              {p0 && <span className="absolute inset-0 bg-gradient-to-b from-black/45 to-transparent to-50%" />}
              <span className={`absolute left-1 top-0.5 text-[11px] font-display font-extrabold ${p0 ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]" : k === hoje ? "" : "text-muted-foreground"}`}
                style={!p0 && k === hoje ? { color: accent } : undefined}>{d}</span>
              {lista.length > 1 && (
                <span className="absolute right-0.5 bottom-0.5 min-w-[16px] h-4 px-1 rounded-full bg-white/90 text-[10px] font-bold grid place-items-center text-foreground">{lista.length}</span>
              )}
              {p0 && STATUS_COR[p0.approval_status] && lista.length === 1 && (
                <span className="absolute right-1 bottom-1 w-2 h-2 rounded-full ring-1 ring-white" style={{ backgroundColor: STATUS_COR[p0.approval_status].cor }} />
              )}
            </button>
          );
        })}
      </div>

      {/* O dia escolhido: a lista dele, e cada post leva pra aprovação. */}
      {dia && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-3 space-y-2">
          <p className="text-[12px] font-body font-bold text-muted-foreground capitalize">
            {new Date(dia + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          {doDia.map((p) => (
            <button key={p.post_id} type="button" onClick={() => aoAbrir?.(p.post_id)} disabled={!aoAbrir}
              className="w-full flex items-center gap-3 rounded-xl border border-border px-2.5 py-2 text-left hover:bg-muted/40 transition-colors">
              <span className="relative w-11 h-14 rounded-lg overflow-hidden bg-muted shrink-0"><Miniatura p={p} capas={capas} brand={brand} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-body font-bold text-foreground truncate">{p.title}</span>
                <span className="block text-[12px] font-body text-muted-foreground capitalize">{p.format}{p.scheduled_time ? ` · ${p.scheduled_time.slice(0, 5)}` : ""}</span>
              </span>
              {STATUS_COR[p.approval_status] && (
                <span className="shrink-0 text-[11px] font-body font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUS_COR[p.approval_status].cor }}>
                  {STATUS_COR[p.approval_status].rotulo}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {semData > 0 && (
        <p className="text-center text-[11.5px] font-body text-muted-foreground mt-3">
          {semData} post{semData === 1 ? "" : "s"} ainda sem data (estão na lista).
        </p>
      )}
    </div>
  );
}
