import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LogOut, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÕES EM UMA TELA SÓ (Walter, 06/11/2026, mockup aprovado)

   A mesma casca serve o criador (/app/configuracoes) e a social mídia
   (/socialmidia/configuracoes). Computador: menu à esquerda em três grupos,
   cada item com o estado atual ao lado, e um "Resumo da conta" que abre
   primeiro. Celular: lista agrupada no jeito dos ajustes do iPhone; tocar numa
   linha abre a seção com "voltar" no topo. A busca acha a seção por palavra
   ("senha", "pix", "tema"). Sair da conta fica separado, no fim.
   ═══════════════════════════════════════════════════════════════════════════ */

export type GrupoConfig = "voce" | "ligacoes" | "dinheiro";
export type ItemConfig = {
  id: string;
  label: string;
  grupo: GrupoConfig;
  /** Cor do marcador (bolinha no computador, quadradinho no celular). */
  cor: string;
  /** Estado curto ao lado do nome ("Studio", "2 ligadas"). */
  estado?: string;
  /** ok = verde, alerta = amarelo, vazio = cinza. */
  tom?: "ok" | "alerta" | "neutro";
  /** Palavras que a busca entende como esta seção. */
  palavras?: string[];
  /** data-tour do item, quando algum tour aponta pra ele. */
  tour?: string;
  /** Item que leva pra outra tela em vez de abrir uma seção aqui. */
  onAbrir?: () => void;
};

const GRUPOS: { id: GrupoConfig; nome: string }[] = [
  { id: "voce", nome: "Você" },
  { id: "ligacoes", nome: "Ligações" },
  { id: "dinheiro", nome: "Dinheiro e dados" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const TOM: Record<NonNullable<ItemConfig["tom"]>, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  alerta: "text-amber-700 dark:text-amber-400",
  neutro: "text-muted-foreground",
};

export function ConfigShell({
  titulo = "Configurações",
  itens, aba, irPara, onSair, topoCelular, aviso, children,
}: {
  titulo?: string;
  itens: ItemConfig[];
  /** "resumo" = página inicial (cartões no computador, lista no celular). */
  aba: string;
  irPara: (id: string) => void;
  onSair: () => void;
  /** Cartão do perfil no topo da lista do celular. */
  topoCelular?: ReactNode;
  /** Faixa acima de tudo (ex.: "editando a conta de fulana"). */
  aviso?: ReactNode;
  /** O conteúdo das seções (TabsContent), incluindo o resumo do computador. */
  children: ReactNode;
}) {
  const [busca, setBusca] = useState("");
  // Um ramo só no DOM: as seções têm formulários e inputs de arquivo que não podem existir duas vezes.
  const celular = useIsMobile();
  const achados = useMemo(() => {
    const q = norm(busca);
    if (!q) return null;
    return itens
      .map((it) => {
        const termos = [it.label, ...(it.palavras ?? [])];
        const hit = termos.find((t) => norm(t).includes(q));
        return hit ? { it, hit: norm(hit) === norm(it.label) ? null : hit } : null;
      })
      .filter(Boolean) as { it: ItemConfig; hit: string | null }[];
  }, [busca, itens]);

  const abrir = (it: ItemConfig) => {
    setBusca("");
    if (it.onAbrir) it.onAbrir(); else irPara(it.id);
  };
  const atual = itens.find((i) => i.id === aba);
  const naLista = aba === "resumo";

  const campoBusca = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id="config-busca"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar configuração"
        aria-label="Buscar configuração"
        className="h-10 w-full rounded-xl border-2 border-foreground/80 bg-background pl-9 pr-9 text-sm font-body outline-none focus:border-primary"
      />
      {busca && (
        <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca"
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  const listaAchados = achados && (
    <div className="space-y-1">
      {achados.length === 0 ? (
        <p className="px-2 py-3 text-[13px] font-body text-muted-foreground">Nada com "{busca}". Tente "senha", "pix", "tema" ou "Instagram".</p>
      ) : achados.map(({ it, hit }) => (
        <button key={it.id} type="button" onClick={() => abrir(it)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-muted">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.cor }} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-body font-semibold text-foreground">{it.label}</span>
            {hit && <span className="block text-[11.5px] font-body text-muted-foreground truncate">{hit}</span>}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );

  return (
    <div className="pb-24 md:pb-6">
      {aviso}

      {/* ── CELULAR: lista estilo ajustes do iPhone ─────────────────────── */}
      {celular ? (
      <div>
        {naLista ? (
          <div className="space-y-4" data-tour="config-abas">
            {/* O título "Configurações" já vem do topo do layout. */}
            {campoBusca}
            {listaAchados ? (
              <div className="rounded-2xl border-2 border-foreground bg-card p-1.5 shadow-[3px_3px_0_hsl(var(--foreground))]">{listaAchados}</div>
            ) : (
              <>
                {topoCelular}
                {GRUPOS.map((g) => {
                  const doGrupo = itens.filter((i) => i.grupo === g.id);
                  if (!doGrupo.length) return null;
                  return (
                    <div key={g.id}>
                      <p className="mb-1.5 px-1 text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">{g.nome}</p>
                      <div className="overflow-hidden rounded-2xl border-2 border-foreground bg-card shadow-[3px_3px_0_hsl(var(--foreground))]">
                        {doGrupo.map((it, k) => (
                          <button key={it.id} type="button" onClick={() => abrir(it)} data-tour={it.tour}
                            className={cn("flex w-full items-center gap-3 px-3 py-3 text-left active:bg-muted", k > 0 && "border-t border-border")}>
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-display font-extrabold text-white" style={{ background: it.cor }}>
                              {it.label.charAt(0)}
                            </span>
                            <span className="min-w-0 flex-1 text-[14.5px] font-body font-semibold text-foreground">{it.label}</span>
                            {it.estado && <span className={cn("max-w-[45%] truncate text-[12px] font-body font-semibold", TOM[it.tom ?? "neutro"])}>{it.estado}</span>}
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <button type="button" onClick={onSair}
                  className="flex w-full items-center gap-2 rounded-2xl border-2 border-destructive/70 bg-card px-4 py-3 text-left text-[14.5px] font-body font-semibold text-destructive">
                  <LogOut className="h-4 w-4" /> Sair da conta
                </button>
              </>
            )}
          </div>
        ) : (
          <div>
            <button type="button" onClick={() => irPara("resumo")}
              className="-ml-1 mb-2 inline-flex items-center gap-0.5 rounded-lg px-1 py-1 text-[13.5px] font-body font-semibold text-muted-foreground">
              <ChevronLeft className="h-4 w-4" /> {titulo}
            </button>
            {children}
          </div>
        )}
      </div>
      ) : (
      /* ── COMPUTADOR: menu em grupos + conteúdo ──────────────────────── */
      <div className="grid grid-cols-[236px_minmax(0,1fr)] items-start gap-7">
        <aside className="sticky top-24 space-y-4" data-tour="config-abas">
          {campoBusca}
          {listaAchados ?? (
            <nav className="space-y-4" aria-label="Seções das configurações">
              <button type="button" onClick={() => irPara("resumo")}
                className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-body font-semibold transition-colors",
                  naLista ? "bg-foreground text-background" : "text-foreground/85 hover:bg-muted")}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FFCF03]" />
                <span className="flex-1">Resumo</span>
                <span className={cn("text-[11px] font-normal", naLista ? "text-background/70" : "text-muted-foreground")}>tudo</span>
              </button>
              {GRUPOS.map((g) => {
                const doGrupo = itens.filter((i) => i.grupo === g.id);
                if (!doGrupo.length) return null;
                return (
                  <div key={g.id}>
                    <p className="mb-1 px-3 text-[10.5px] font-body font-bold uppercase tracking-wider text-muted-foreground">{g.nome}</p>
                    <div className="space-y-0.5">
                      {doGrupo.map((it) => {
                        const on = it.id === aba;
                        return (
                          <button key={it.id} type="button" onClick={() => abrir(it)} data-tour={it.tour}
                            className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-body transition-colors",
                              on ? "bg-foreground font-bold text-background" : "font-medium text-foreground/85 hover:bg-muted")}>
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.cor }} />
                            <span className="min-w-0 flex-1 truncate">{it.label}</span>
                            {it.estado && (
                              <span className={cn("max-w-[90px] truncate text-[11px] font-semibold", on ? "text-background/75" : TOM[it.tom ?? "neutro"])}>{it.estado}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <button type="button" onClick={onSair}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-body font-semibold text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4" /> Sair da conta
              </button>
            </nav>
          )}
        </aside>
        <div className="min-w-0">
          {!naLista && atual && (
            <p className="mb-1 text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
              {GRUPOS.find((g) => g.id === atual.grupo)?.nome}
            </p>
          )}
          {children}
        </div>
      </div>
      )}
    </div>
  );
}

/* ── Peças do resumo, iguais nas duas contas ─────────────────────────────── */

/** Cartão de uma seção no resumo: título, estado e um botão de ação. */
export function CartaoResumo({ titulo, children, acao, onAcao, className, tour }: {
  titulo: string;
  children: ReactNode;
  acao: string;
  onAcao: () => void;
  className?: string;
  tour?: string;
}) {
  return (
    <section data-tour={tour}
      className={cn("flex min-w-0 flex-col rounded-2xl border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_hsl(var(--foreground))]", className)}>
      <h3 className="font-display text-[15px] font-extrabold text-foreground">{titulo}</h3>
      <div className="mt-2 flex-1 space-y-2 text-[12.5px] font-body text-muted-foreground">{children}</div>
      <div className="mt-3">
        <button type="button" onClick={onAcao}
          className="rounded-full border-2 border-foreground bg-background px-3.5 py-1.5 text-[12px] font-body font-bold text-foreground hover:bg-muted">
          {acao}
        </button>
      </div>
    </section>
  );
}

/** Selo de estado dentro dos cartões ("Instagram ligado", "falta a chave Pix"). */
export function Selo({ children, tom = "ok" }: { children: ReactNode; tom?: "ok" | "alerta" | "neutro" }) {
  return (
    <span className={cn("inline-flex max-w-full items-center truncate rounded-full border-[1.5px] px-2.5 py-0.5 text-[11.5px] font-body font-bold",
      tom === "ok" && "border-emerald-700/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
      tom === "alerta" && "border-amber-700/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      tom === "neutro" && "border-border bg-muted text-muted-foreground")}>
      {children}
    </span>
  );
}

/** Barrinha de uso (IA, espaço). */
export function Barra({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full border border-foreground/60 bg-muted">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: cor }} />
    </div>
  );
}

/** Cartão "Sair da conta" no fim do resumo, separado do resto. */
export function CartaoSair({ onSair }: { onSair: () => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-destructive/60 px-4 py-3">
      <div>
        <p className="font-display text-[14px] font-extrabold text-destructive">Sair da conta</p>
        <p className="text-[12px] font-body text-muted-foreground">Separado de tudo, no fim, com confirmação.</p>
      </div>
      <button type="button" onClick={onSair}
        className="rounded-full border-2 border-destructive/70 px-3.5 py-1.5 text-[12px] font-body font-bold text-destructive hover:bg-destructive/10">
        Sair da conta
      </button>
    </div>
  );
}

/** "há 12 min" a partir de uma data ISO. */
export function haQuanto(iso: string | null | undefined): string {
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}
