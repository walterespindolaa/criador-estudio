import { useState } from "react";
import { CircleDot, Eye, MessageCircle, Reply, MousePointerClick, Share2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeStoriesSummary, fmtNum, type StoryLike } from "./insightsUtils";

// Bloco de STORIES: agrega alcance, respostas, taxa de resposta e navegação dos
// stories capturados (eles somem em 24h, então trabalhamos com o snapshot coletado).
// 28/10/2026 (mockup aprovado): visualizações, compartilhamentos, visitas ao
// perfil e seguidores por story, a navegação quebrada por gesto e uma tira
// com cada story. A coleta guarda a última leitura antes de a Meta apagar.

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Eye; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[11px] font-body uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-display font-extrabold text-foreground">{value}</p>
      {sub && <p className="text-[11px] font-body text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

type StoryComCapa = StoryLike & { thumbnail_url?: string | null; permalink?: string | null; id?: string };

const soma = (l: StoryLike[], k: string) => l.reduce((a, s) => a + Number(s.metrics?.[k] ?? 0), 0);
const tem = (l: StoryLike[], k: string) => l.some((s) => !!s.metrics && k in s.metrics);

function navegacao(m: Record<string, number>): string | null {
  const fwd = Number(m.navigation_tap_forward ?? 0), back = Number(m.navigation_tap_back ?? 0);
  const exit = Number(m.navigation_tap_exit ?? 0), next = Number(m.navigation_swipe_forward ?? 0);
  const tot = fwd + back + exit + next;
  if (!tot) return null;
  const p = (v: number) => `${Math.round((v / tot) * 100)}%`;
  return `${p(fwd)} foram pro próximo, ${p(back)} voltaram, ${p(next)} pularam de perfil, ${p(exit)} saíram`;
}

const NUMS: Array<[string, string]> = [["views", "visualizações"], ["reach", "alcance"], ["replies", "respostas"], ["shares", "compartilhamentos"],
  ["profile_visits", "visitas ao perfil"], ["follows", "seguidores"], ["profile_activity", "ações no perfil"], ["reposts", "reposts"]];

export function StoriesSummary({ stories }: { stories: StoryComCapa[] | undefined | null }) {
  const s = computeStoriesSummary(stories);
  const todos = stories ?? [];
  const lista = [...todos].sort((a, b) => String(b.posted_at ?? "").localeCompare(String(a.posted_at ?? "")));
  const [sel, setSel] = useState(0);

  if (!s.hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <CircleDot className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-body text-foreground font-medium">Sem stories no período</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
          Stories somem em 24h; capturamos os que estavam no ar na última sincronização. Publique stories e volte após atualizar.
        </p>
      </div>
    );
  }

  const atual = lista[Math.min(sel, lista.length - 1)];
  const am = (atual?.metrics ?? {}) as Record<string, number>;
  const nav = navegacao(am);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Eye} label="Alcance" value={fmtNum(s.reach)} sub={`${fmtNum(s.avgReach)} por story · ${s.count} stories`} />
        <Stat icon={MessageCircle} label="Respostas" value={fmtNum(s.replies)} sub={s.reach > 0 ? `${s.replyRate.toFixed(1)}% do alcance` : undefined} />
        {tem(todos, "shares")
          ? <Stat icon={Share2} label="Compartilhamentos" value={fmtNum(soma(todos, "shares"))} />
          : <Stat icon={Reply} label="Taxa de resposta" value={s.reach > 0 ? `${s.replyRate.toFixed(1)}%` : "-"} sub="respostas ÷ alcance" />}
        {tem(todos, "profile_visits")
          ? <Stat icon={UserRound} label="Visitas ao perfil" value={fmtNum(soma(todos, "profile_visits"))}
              sub={tem(todos, "follows") ? `+${fmtNum(soma(todos, "follows"))} seguidores` : undefined} />
          : <Stat icon={MousePointerClick} label="Navegação" value={fmtNum(s.navigation)} sub="toques e saídas" />}
      </div>

      {lista.length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-display font-bold">Story por story</p>
          <p className="text-[11px] text-muted-foreground">A Meta apaga os números do story em 24 h e só mostra com 5 visualizações ou mais. O Cria guarda a última leitura.</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {lista.slice(0, 20).map((st, i) => (
              <button key={st.id ?? i} type="button" aria-pressed={i === sel} aria-label={`Story ${i + 1}`} onClick={() => setSel(i)}
                className={cn("shrink-0 w-14 h-24 rounded-xl overflow-hidden bg-muted border-2 relative", i === sel ? "border-foreground" : "border-transparent")}>
                {st.thumbnail_url && <img src={st.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/50 rounded px-1">
                  {st.posted_at ? new Date(st.posted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {NUMS.filter(([k]) => k in am).map(([k, r]) => (
              <div key={k} className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="font-display font-extrabold text-lg leading-none">{fmtNum(am[k])}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{r}</p>
              </div>
            ))}
            {!NUMS.some(([k]) => k in am) && <p className="col-span-full text-xs text-muted-foreground">Sem números deste story (menos de 5 visualizações ou expirou antes da coleta).</p>}
          </div>
          {nav && <p className="mt-2 text-xs text-muted-foreground">Navegação: {nav}.</p>}
        </div>
      )}
    </div>
  );
}
