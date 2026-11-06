import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/date-br";
import type { StructuredGoal, Milestone } from "@/hooks/useGoals";
import type { Post } from "@/hooks/usePosts";
import type { Reflection } from "@/hooks/useReflections";

/* ═══════════════════════════════════════════════════════════════════════════
   METAS EM QUADRO (Walter, 06/11/2026, mockup aprovado)

   Cada meta mostra o número de agora, a régua até o alvo e três post-its: o que
   falta, o ritmo e, com prazo, quanto precisa por mês. Embaixo, à mão, a
   previsão de quando chega. A visão anual ganhou os números e a reflexão do mês
   virou uma página de diário que salva sozinha, com as páginas anteriores.
   Tudo é conta em cima do que já está gravado: nada novo no banco.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CATEGORIAS = [
  { value: "seguidores", label: "Seguidores", cor: "#BFE8C6" },
  { value: "posts", label: "Posts", cor: "#FFE58A" },
  { value: "vendas", label: "Vendas", cor: "#FFD3E8" },
  { value: "engajamento", label: "Engajamento", cor: "#D7E3FF" },
  { value: "receita", label: "Receita", cor: "#FFD6C7" },
  { value: "geral", label: "Geral", cor: "#EDE7DA" },
];
export const STATUS = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "pausada", label: "Pausada" },
];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const sombra = "shadow-[5px_5px_0_hsl(var(--foreground))]";

/* ─── duplicadas: mesmo título (sem acento/caixa), categoria e alvo ─── */
const chave = (g: StructuredGoal) =>
  `${g.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()}|${g.category}|${g.target_value ?? 0}`;
export function gruposDuplicados(goals: StructuredGoal[]): StructuredGoal[][] {
  const m = new Map<string, StructuredGoal[]>();
  for (const g of goals) {
    const k = chave(g);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(g);
  }
  return [...m.values()].filter((v) => v.length > 1);
}

export function AvisoDuplicadas({ grupo, onFicarComUma, ocupado }: { grupo: StructuredGoal[]; onFicarComUma: () => void; ocupado: boolean }) {
  return (
    <div className="relative rounded-[4px] bg-[#FFC6E1] text-[#1d1b18] px-4 py-3 -rotate-[0.4deg] shadow-[3px_4px_0_rgba(0,0,0,.14)] flex items-center gap-3">
      <span aria-hidden className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-20 rotate-2 bg-white/70" />
      <div className="min-w-0 flex-1">
        <p className="font-display font-extrabold text-[15px] leading-tight">Você tem {grupo.length} metas iguais</p>
        <p className="text-[12.5px] font-body truncate">"{grupo[0].title}"</p>
      </div>
      <button type="button" onClick={onFicarComUma} disabled={ocupado}
        className="shrink-0 h-8 rounded-full border-2 border-[#1d1b18] bg-white px-3.5 text-[12px] font-body font-extrabold disabled:opacity-60">
        {ocupado ? "Ajustando..." : "Ficar com uma"}
      </button>
    </div>
  );
}

/* ─── o cartão da meta ─── */
export function CartaoMeta({
  goal, marcos, aberto, onAbrir, auto, ritmoMes, today,
  onValor, onStatus, onRemover, onMarco, onNovoMarco, onRemoverMarco,
}: {
  goal: StructuredGoal;
  marcos: Milestone[];
  aberto: boolean;
  onAbrir: () => void;
  /** Meta de seguidores com Instagram ligado: o número vem sozinho. */
  auto: boolean;
  /** Ritmo dos últimos 30 dias (só seguidores, do Instagram). */
  ritmoMes: number | null;
  today: string;
  onValor: (v: number) => void;
  onStatus: (s: string) => void;
  onRemover: () => void;
  onMarco: (m: Milestone) => void;
  onNovoMarco: (nome: string) => void;
  onRemoverMarco: (id: string) => void;
}) {
  const cat = CATEGORIAS.find((c) => c.value === goal.category) ?? CATEGORIAS[5];
  const alvo = goal.target_value ?? 0;
  const atual = goal.current_value ?? 0;
  const pct = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0;
  const faltam = Math.max(0, alvo - atual);
  const feitos = marcos.filter((m) => m.completed).length;
  const [valor, setValor] = useState(String(atual));
  const [novoMarco, setNovoMarco] = useState("");
  useEffect(() => { setValor(String(atual)); }, [atual]);

  // Prazo: quantos meses faltam e quanto precisa por mês.
  const prazo = goal.end_date ? parseDateOnly(goal.end_date) : null;
  const hoje = parseDateOnly(today);
  const mesesAtePrazo = prazo ? Math.max(0, (prazo.getFullYear() - hoje.getFullYear()) * 12 + (prazo.getMonth() - hoje.getMonth()) + (prazo.getDate() >= hoje.getDate() ? 0 : -1)) : null;
  const diasAtePrazo = prazo ? Math.ceil((prazo.getTime() - hoje.getTime()) / 86400000) : null;
  const precisaPorMes = prazo && faltam > 0 ? Math.ceil(faltam / Math.max(1, mesesAtePrazo ?? 1)) : null;
  const atrasada = !!prazo && (diasAtePrazo ?? 0) < 0 && goal.status !== "concluida";

  // Previsão no ritmo atual (só onde existe ritmo medido).
  let previsao: string | null = null;
  if (goal.status === "concluida" || (alvo > 0 && faltam === 0)) previsao = "meta batida.";
  else if (ritmoMes != null && alvo > 0) {
    if (ritmoMes <= 0) previsao = "no ritmo atual não chega: o número não subiu nos últimos 30 dias.";
    else {
      const meses = Math.ceil(faltam / ritmoMes);
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + meses, 1);
      previsao = `no ritmo atual chega em ${meses <= 1 ? "até um mês" : `${MESES_LONGO[d.getMonth()]} de ${d.getFullYear()}`}.`;
    }
  }

  const corBarra = goal.category === "seguidores" ? "#00A652" : goal.category === "posts" ? "#FFCF03" : "#EB4918";
  const postits: { titulo: string; valor: string; cor: string }[] = [];
  if (alvo > 0) postits.push({ titulo: "faltam", valor: fmt(faltam), cor: "#FFCF03" });
  if (ritmoMes != null) postits.push({ titulo: "ritmo dos últimos 30 dias", valor: `${ritmoMes >= 0 ? "+" : ""}${fmt(ritmoMes)} por mês`, cor: "#BFE8C6" });
  else if (diasAtePrazo != null) postits.push({ titulo: atrasada ? "prazo" : "dias até o prazo", valor: atrasada ? "passou" : fmt(diasAtePrazo), cor: "#BFE8C6" });
  if (precisaPorMes != null && prazo) postits.push({ titulo: `pra chegar até ${MESES[prazo.getMonth()]}/${prazo.getFullYear()}`, valor: `+${fmt(precisaPorMes)} por mês`, cor: "#D7E3FF" });
  else if (marcos.length) postits.push({ titulo: "marcos", valor: `${feitos} de ${marcos.length}`, cor: "#D7E3FF" });

  return (
    <div className={cn("rounded-2xl border-2 border-foreground bg-card", sombra)}>
      <button type="button" onClick={onAbrir} className="w-full text-left p-4 sm:p-5" aria-expanded={aberto}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-full border-[1.5px] border-foreground px-2 py-px text-[10px] font-body font-extrabold uppercase tracking-wide text-[#1d1b18]" style={{ background: cat.cor }}>{cat.label}</span>
          <span className="text-[12px] font-body italic text-[#00A652]">{auto ? "atualiza sozinha pelo Instagram" : "você atualiza"}</span>
          {goal.status !== "em_andamento" && (
            <span className="text-[11px] font-body font-bold text-muted-foreground">{STATUS.find((s) => s.value === goal.status)?.label}</span>
          )}
          {atrasada && <span className="text-[11px] font-body font-bold text-[#D93A12]">prazo passou</span>}
        </div>
        <p className="font-display font-extrabold text-[18px] leading-snug mt-1.5">{goal.title}</p>
        <div className="flex items-end gap-2 mt-1">
          <span className="font-display font-extrabold text-[34px] leading-none tabular-nums">{fmt(atual)}</span>
          {alvo > 0 && <span className="text-[13px] font-body text-muted-foreground mb-1">de {fmt(alvo)}</span>}
          <span className="ml-auto font-display font-extrabold text-[22px] leading-none text-[#EB4918] tabular-nums">{pct}%</span>
        </div>
        {alvo > 0 && (
          <>
            <div className="relative mt-3 h-6 rounded-md border-2 border-foreground bg-[#FFFCF3] dark:bg-background overflow-hidden">
              <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: corBarra }} />
              <div className="absolute inset-0 grid grid-cols-10">
                {Array.from({ length: 10 }).map((_, i) => <span key={i} className={cn(i > 0 && "border-l border-foreground/70")} />)}
              </div>
            </div>
            <div className="flex justify-between text-[10px] font-body text-muted-foreground tabular-nums mt-0.5">
              <span>0</span><span className="hidden sm:inline">{fmt(alvo / 4)}</span><span>{fmt(alvo / 2)}</span><span className="hidden sm:inline">{fmt((alvo * 3) / 4)}</span><span>{fmt(alvo)}</span>
            </div>
          </>
        )}
        {postits.length > 0 && (
          <div className={cn("grid gap-2 mt-3", postits.length === 3 ? "grid-cols-2 sm:grid-cols-3" : postits.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
            {postits.map((p, i) => (
              <div key={p.titulo} className={cn("rounded-[3px] px-3 py-2 text-[#1d1b18] shadow-[2px_3px_0_rgba(0,0,0,.13)]", i % 2 ? "rotate-[0.5deg]" : "-rotate-[0.5deg]", postits.length === 3 && i === 2 && "col-span-2 sm:col-span-1")} style={{ background: p.cor }}>
                <p className="text-[11px] font-body leading-tight">{p.titulo}</p>
                <p className="font-display font-extrabold text-[17px] leading-tight tabular-nums">{p.valor}</p>
              </div>
            ))}
          </div>
        )}
        {(previsao || (!goal.end_date && alvo > 0 && goal.status !== "concluida")) && (
          <p className="mt-3 text-[13px] font-body italic text-foreground/80">
            {previsao}{!goal.end_date && alvo > 0 && goal.status !== "concluida" && <> Defina um prazo pra ver quanto precisa por mês.</>}
          </p>
        )}
      </button>

      {aberto && (
        <div className="border-t-2 border-dashed border-foreground/30 px-4 sm:px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {alvo > 0 && !auto && (
              <label className="flex items-center gap-2 text-[12.5px] font-body font-semibold">
                Onde estou
                <input type="number" value={valor} onChange={(e) => setValor(e.target.value)}
                  onBlur={() => { const n = parseFloat(valor); if (!Number.isNaN(n) && n !== atual) onValor(n); }}
                  className="h-9 w-28 rounded-lg border-2 border-foreground bg-background px-2 text-[13px] tabular-nums" />
                <span className="text-muted-foreground">de {fmt(alvo)}</span>
              </label>
            )}
            <label className="flex items-center gap-2 text-[12.5px] font-body font-semibold">
              Situação
              <select value={goal.status ?? "em_andamento"} onChange={(e) => onStatus(e.target.value)}
                className="h-9 rounded-lg border-2 border-foreground bg-background px-2 text-[13px]">
                {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
          {goal.observation && <p className="text-[13px] font-body italic text-muted-foreground">{goal.observation}</p>}
          <div>
            <p className="font-display font-extrabold text-[14px] mb-1.5">Marcos <span className="text-[12px] font-body font-semibold text-muted-foreground">{feitos} de {marcos.length}</span></p>
            <div className="space-y-1">
              {marcos.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => onMarco(m)} aria-label={m.completed ? "Desmarcar" : "Marcar"}
                    className={cn("grid h-5 w-5 place-items-center rounded-[4px] border-2 border-foreground", m.completed && "bg-[#00A652] text-white")}>
                    {m.completed && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <span className={cn("flex-1 text-[13.5px] font-body", m.completed && "line-through text-muted-foreground")}>{m.name}</span>
                  <button type="button" onClick={() => onRemoverMarco(m.id)} aria-label="Remover marco" className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); if (!novoMarco.trim()) return; onNovoMarco(novoMarco.trim()); setNovoMarco(""); }}>
              <input value={novoMarco} onChange={(e) => setNovoMarco(e.target.value)} placeholder="Novo marco e Enter"
                className="flex-1 min-w-0 h-9 rounded-lg border-2 border-foreground/30 focus:border-foreground bg-background px-3 text-[13px] font-body outline-none" />
              <button type="submit" disabled={!novoMarco.trim()} className="grid h-9 w-9 place-items-center rounded-lg border-2 border-foreground bg-card disabled:opacity-40" aria-label="Adicionar marco"><Plus className="h-4 w-4" /></button>
            </form>
          </div>
          <button type="button" onClick={onRemover} className="text-[12px] font-body font-bold text-destructive inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Remover meta</button>
        </div>
      )}
    </div>
  );
}

/* ─── posts por mês, com o número em cima de cada barra ─── */
export function PostsPorMes({ posts }: { posts: Post[] }) {
  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth();
  const contas = useMemo(() => {
    const c = Array(12).fill(0) as number[];
    for (const p of posts) {
      if (!p.scheduled_date) continue;
      const d = parseDateOnly(p.scheduled_date);
      if (d.getFullYear() === ano) c[d.getMonth()]++;
    }
    return c;
  }, [posts, ano]);
  const max = Math.max(1, ...contas);
  // No celular: os 6 meses que terminam no mês atual.
  const iniCel = Math.max(0, Math.min(6, mesAtual - 5));
  return (
    <div className={cn("rounded-2xl border-2 border-foreground bg-card p-4 sm:p-5", sombra)}>
      <p className="font-display font-extrabold text-[16px]">Posts por mês em {ano} <span className="text-[12px] font-body font-semibold text-muted-foreground">posts agendados</span></p>
      <div className="mt-3 grid grid-cols-6 sm:grid-cols-12 gap-1.5 items-end h-36">
        {contas.map((n, i) => (
          <div key={i} className={cn("flex flex-col items-center justify-end h-full min-w-0", (i < iniCel || i > iniCel + 5) && "hidden sm:flex")}>
            {n > 0 && <span className="text-[11px] font-body font-extrabold tabular-nums mb-0.5">{n}</span>}
            <div className={cn("w-full max-w-[34px] rounded-t-md border-2 border-foreground", i === mesAtual ? "bg-[#EB4918]" : "bg-[#E9E1CF]")}
              style={{ height: n > 0 ? `${Math.max(8, (n / max) * 100)}px` : "3px", borderBottomWidth: n > 0 ? 2 : 0 }} />
            <span className="text-[10.5px] font-body text-muted-foreground mt-1">{MESES[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── reflexão: página de diário ─── */
export type CampoReflexao = "biz_worked" | "biz_blocked" | "content_best" | "content_rhythm" | "focus_execution" | "focus_lessons";
export const PERGUNTAS: { key: CampoReflexao; rotulo: string; dica: string }[] = [
  { key: "biz_worked", rotulo: "O que funcionou", dica: "O que deu certo este mês?" },
  { key: "biz_blocked", rotulo: "O que travou", dica: "O que atrapalhou ou ficou pendente?" },
  { key: "content_best", rotulo: "Melhor conteúdo do mês", dica: "Qual post se destacou?" },
  { key: "content_rhythm", rotulo: "Ritmo de produção", dica: "Como foi sua consistência?" },
  { key: "focus_execution", rotulo: "Execução e foco", dica: "Como foi sua disciplina?" },
  { key: "focus_lessons", rotulo: "Aprendizados", dica: "O que aprendeu?" },
];

export function DiarioDoMes({ mesNome, valores, onSalvarCampo, salvando }: {
  mesNome: string;
  valores: Record<CampoReflexao, string>;
  onSalvarCampo: (k: CampoReflexao, v: string) => void;
  salvando: boolean;
}) {
  const [aberta, setAberta] = useState<CampoReflexao | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [verTodas, setVerTodas] = useState(false);
  const feitas = PERGUNTAS.filter((p) => valores[p.key]?.trim()).length;
  const abrir = (k: CampoReflexao) => {
    if (aberta && aberta !== k && rascunho !== (valores[aberta] ?? "")) onSalvarCampo(aberta, rascunho);
    if (aberta === k) { if (rascunho !== (valores[k] ?? "")) onSalvarCampo(k, rascunho); setAberta(null); return; }
    setAberta(k); setRascunho(valores[k] ?? "");
  };
  return (
    <div className="space-y-1">
      {PERGUNTAS.map((p, i) => {
        const ok = !!valores[p.key]?.trim();
        const on = aberta === p.key;
        return (
          <div key={p.key} className={cn(i >= 3 && !verTodas && !on && "hidden sm:block")}>
            <button type="button" onClick={() => abrir(p.key)} className="w-full flex items-center gap-2.5 py-1.5 text-left">
              <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border-2 border-foreground", ok && "bg-[#00A652] text-white")}>
                {ok && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="flex-1 text-[14px] font-body font-semibold">{p.rotulo}</span>
              <span className={cn("text-[12px] font-body italic", ok ? "text-[#00A652]" : "text-muted-foreground")}>
                {on ? "escrevendo" : ok ? "respondida" : "responder"}
              </span>
            </button>
            {on && (
              <div className="ml-7 mb-2 rounded-xl border-2 border-foreground bg-card p-3">
                <p className="text-[12.5px] font-body font-bold mb-1">{p.dica}</p>
                <textarea autoFocus value={rascunho} onChange={(e) => setRascunho(e.target.value)}
                  onBlur={() => { if (rascunho !== (valores[p.key] ?? "")) onSalvarCampo(p.key, rascunho); }}
                  rows={3} placeholder="escreva aqui..." className="w-full resize-y bg-transparent outline-none text-[14px] font-body" />
              </div>
            )}
          </div>
        );
      })}
      {!verTodas && (
        <button type="button" onClick={() => setVerTodas(true)} className="sm:hidden w-full flex items-center gap-2.5 py-1.5 text-left">
          <span className="h-5 w-5 rounded-[4px] border-2 border-foreground" />
          <span className="flex-1 text-[14px] font-body font-semibold">Mais 3 perguntas</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
      <p className="text-[12px] font-body italic text-muted-foreground pt-1">
        {salvando ? "salvando..." : `${feitas} de 6 · salva sozinha ao sair do campo`}
      </p>
      <span className="sr-only">{mesNome}</span>
    </div>
  );
}

/* Reflexões dos meses anteriores (só leitura do que já está gravado). */
export function useReflexoesAnteriores(mesAtual: string) {
  const { activeAccountId } = useActiveAccount();
  return useQuery<Reflection[]>({
    queryKey: ["reflexoes-anteriores", activeAccountId, mesAtual],
    enabled: !!activeAccountId,
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_reflections").select("*")
        .eq("user_id", activeAccountId!).lt("month", mesAtual).order("month", { ascending: false }).limit(12);
      if (error) throw error;
      return (data ?? []) as Reflection[];
    },
  });
}

export function nomeDoMes(isoMes: string, curto = false) {
  const d = parseDateOnly(isoMes);
  return curto ? MESES[d.getMonth()] : MESES_LONGO[d.getMonth()];
}
