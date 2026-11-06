import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpDown, Check, Loader2, RotateCcw, Search, X } from "lucide-react";
import {
  useTrashedPosts, useTrashedClients, useRestoreMany, usePurgeMany, type TrashRow,
} from "@/hooks/useTrash";
import { confirmar } from "@/components/shared/Confirm";
import { Sticker } from "@/components/shared/Sticker";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   A LIXEIRA COMO CESTO DE PAPÉIS (Walter, 07/11/2026, mockup aprovado)

   Antes era uma lista corrida, um item por vez, sem busca e sem dizer o que
   estava pra sumir. Agora: o que vence primeiro vem primeiro ("Some esta
   semana"), o resto agrupado pelo mês em que foi excluído, cada item como um
   papel com a etiqueta do tipo e os dias que faltam, seleção em lote e prévia
   ao lado (no celular, ao tocar).

   A regra dos 30 dias é a do robô trash-purge-daily (todo dia às 3h17).
   Hoje entram post e cliente. A tela já aceita outros tipos pelo mapa TIPOS:
   ideia, roteiro e pasta entram quando essas tabelas tiverem deleted_at.
   ═══════════════════════════════════════════════════════════════════════════ */

const DIAS = 30;
const TIPOS: Record<string, { nome: string; plural: string; cor: string; texto?: string }> = {
  post: { nome: "Post", plural: "Posts", cor: "#EB4918" },
  client: { nome: "Cliente", plural: "Clientes", cor: "#0061EE" },
  ideia: { nome: "Ideia", plural: "Ideias", cor: "#FF77B9" },
  roteiro: { nome: "Roteiro", plural: "Roteiros", cor: "#00A652" },
  pasta: { nome: "Pasta", plural: "Pastas", cor: "#FFCF03", texto: "#0A0A0A" },
};
const tipoDe = (k: string) => TIPOS[k] ?? { nome: k, plural: k, cor: "#555" };

function diasRestantes(deletedAt: string): number {
  const some = new Date(deletedAt).getTime() + DIAS * 86400000;
  return Math.max(0, Math.ceil((some - Date.now()) / 86400000));
}
const chave = (r: TrashRow) => `${r.kind}:${r.id}`;
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const mesNome = (iso: string) => {
  const d = new Date(iso);
  const nome = d.toLocaleDateString("pt-BR", { month: "long" });
  const ano = d.getFullYear() === new Date().getFullYear() ? "" : ` de ${d.getFullYear()}`;
  return nome.charAt(0).toUpperCase() + nome.slice(1) + ano;
};

export default function Lixeira() {
  const { data: posts = [], isLoading: lp } = useTrashedPosts();
  const { data: clients = [], isLoading: lc } = useTrashedClients();
  const restaurar = useRestoreMany();
  const apagar = usePurgeMany();
  const mobile = useIsMobile();

  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string>("tudo");
  const [ordem, setOrdem] = useState<"vence" | "recente">("vence");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [previa, setPrevia] = useState<string | null>(null);

  const todos = useMemo(() => [...clients, ...posts], [clients, posts]);
  const loading = lp || lc;

  const contagem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of todos) m[r.kind] = (m[r.kind] ?? 0) + 1;
    return m;
  }, [todos]);
  const somemSemana = todos.filter((r) => diasRestantes(r.deleted_at) <= 7).length;

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return todos
      .filter((r) => (tipo === "tudo" || r.kind === tipo) && (!t || `${r.label} ${r.detalhe ?? ""}`.toLowerCase().includes(t)))
      .sort((a, b) => ordem === "vence" ? a.deleted_at.localeCompare(b.deleted_at) : b.deleted_at.localeCompare(a.deleted_at));
  }, [todos, busca, tipo, ordem]);

  // "Some esta semana" primeiro; o resto pelo mês em que foi excluído.
  const grupos = useMemo(() => {
    const semana = filtrados.filter((r) => diasRestantes(r.deleted_at) <= 7);
    const resto = filtrados.filter((r) => diasRestantes(r.deleted_at) > 7);
    const porMes = new Map<string, TrashRow[]>();
    for (const r of resto) {
      const k = mesNome(r.deleted_at);
      porMes.set(k, [...(porMes.get(k) ?? []), r]);
    }
    const g: { titulo: string; urgente?: boolean; itens: TrashRow[] }[] = [];
    if (semana.length) g.push({ titulo: "Some esta semana", urgente: true, itens: semana });
    for (const [titulo, itens] of porMes) g.push({ titulo, itens });
    return g;
  }, [filtrados]);

  const selecionados = todos.filter((r) => sel.has(chave(r)));
  const itemPrevia = todos.find((r) => chave(r) === previa) ?? null;

  const alternar = (r: TrashRow) => setSel((s) => {
    const n = new Set(s); const k = chave(r);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const limparSel = () => setSel(new Set());

  const restaurarItens = (itens: TrashRow[]) =>
    restaurar.mutate(itens.map(({ id, kind }) => ({ id, kind })), {
      onSuccess: () => { setSel((s) => { const n = new Set(s); itens.forEach((i) => n.delete(chave(i))); return n; }); setPrevia(null); },
    });
  const apagarItens = async (itens: TrashRow[]) => {
    const um = itens.length === 1;
    const ok = await confirmar({
      titulo: um ? `Apagar "${itens[0].label}" de vez?` : `Apagar ${itens.length} itens de vez?`,
      descricao: "Isso não dá pra desfazer nem pela lixeira.",
      acao: "Apagar de vez", destrutivo: true,
    });
    if (!ok) return;
    apagar.mutate(itens.map(({ id, kind }) => ({ id, kind })), {
      onSuccess: () => { setSel((s) => { const n = new Set(s); itens.forEach((i) => n.delete(chave(i))); return n; }); setPrevia(null); },
    });
  };

  const tiposPresentes = Object.keys(TIPOS).filter((k) => (contagem[k] ?? 0) > 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className={cn("pb-24 md:pb-6", selecionados.length > 0 && "pb-40 md:pb-24")}>
      {/* TOPO: o cesto e o resumo que importa. */}
      <div data-tour="lixeira-header" className="flex items-center gap-3 sm:gap-4 mb-4">
        <Cesto className="w-14 h-12 sm:w-[86px] sm:h-[72px] shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight leading-none">Lixeira</h1>
          <p className="text-muted-foreground font-body text-[13px] mt-1.5">
            {todos.length === 0 ? `O que você excluir fica aqui por ${DIAS} dias.` : (
              <>
                {todos.length} {todos.length === 1 ? "item" : "itens"}
                <span className="hidden sm:inline"> · o que passa de {DIAS} dias some sozinho</span>
                {somemSemana > 0 && <b className="text-[#EB4918]">. {somemSemana} {somemSemana === 1 ? "some" : "somem"} esta semana.</b>}
              </>
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></div>
      ) : todos.length === 0 ? (
        <div className="relative overflow-hidden border border-dashed border-border rounded-2xl py-16 text-center">
          <Sticker name="selo-social-club-verde" className="absolute -bottom-5 -right-4 w-32 opacity-[0.08]" />
          <Sticker name="selo-social-club-verde" className="mx-auto mb-3 w-[72px]" />
          <p className="text-sm font-body text-foreground font-medium">Lixeira vazia</p>
          <p className="text-xs font-body text-muted-foreground mt-1">O que você excluir aparece aqui por {DIAS} dias.</p>
        </div>
      ) : (
        <>
          {/* BUSCA E FILTRO */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no que foi jogado fora"
              className="w-full h-11 rounded-full border-[1.5px] border-foreground/80 bg-card pl-11 pr-10 text-sm font-body outline-none focus:border-primary" />
            {busca && (
              <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Pilula on={tipo === "tudo"} onClick={() => setTipo("tudo")}>Tudo <span className="opacity-70">{todos.length}</span></Pilula>
            {tiposPresentes.map((k) => (
              <Pilula key={k} on={tipo === k} onClick={() => setTipo(k)}>{tipoDe(k).plural} <span className="opacity-70">{contagem[k]}</span></Pilula>
            ))}
            {/* Botão que alterna (o select nativo do iPhone ficava gigante e cortado). */}
            <button type="button" onClick={() => setOrdem((o) => (o === "vence" ? "recente" : "vence"))}
              className="ml-auto shrink-0 h-8 rounded-full border border-border bg-card px-3 text-xs font-body font-bold text-foreground inline-flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" /> {ordem === "vence" ? "Vence primeiro" : "Mais recentes"}
            </button>
          </div>

          {filtrados.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border py-10 text-center">
              <p className="text-sm font-display font-bold text-foreground">Nada com essa busca</p>
              <p className="text-[13px] font-body text-muted-foreground mt-1">Limpe a busca ou troque o tipo.</p>
            </div>
          ) : (
            <div className="mt-3 grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
              <div data-tour="lixeira-itens" className="space-y-5 min-w-0">
                {grupos.map((g) => (
                  <section key={g.titulo}>
                    <div className="flex items-center gap-3 mb-2.5">
                      <h2 className={cn("text-[13px] font-display font-extrabold", g.urgente ? "text-[#EB4918]" : "text-foreground")}>{g.titulo}</h2>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {g.itens.map((r, i) => (
                        <Papel key={chave(r)} row={r} inclinacao={i % 2 ? 0.45 : -0.5}
                          marcado={sel.has(chave(r))} emPrevia={previa === chave(r)}
                          onMarcar={() => alternar(r)} onAbrir={() => setPrevia(chave(r))} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {/* PRÉVIA (computador) */}
              <aside className="hidden lg:block sticky top-4">
                <p className="text-[13px] font-display font-extrabold text-foreground mb-2.5">Prévia</p>
                {itemPrevia ? (
                  <Previa row={itemPrevia} onRestaurar={() => restaurarItens([itemPrevia])} onApagar={() => void apagarItens([itemPrevia])} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] font-body text-muted-foreground">
                    Toque num item pra ver quando foi excluído e quanto falta pra sumir.
                  </div>
                )}
              </aside>
            </div>
          )}
        </>
      )}

      {/* PRÉVIA (celular): sobe ao tocar no item. */}
      {mobile && (
        <Drawer open={!!itemPrevia} onOpenChange={(o) => { if (!o) setPrevia(null); }}>
          <DrawerContent className="px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <DrawerTitle className="sr-only">{itemPrevia?.label ?? "Prévia"}</DrawerTitle>
            {itemPrevia && (
              <div className="pt-2">
                <Previa row={itemPrevia} solta onRestaurar={() => restaurarItens([itemPrevia])} onApagar={() => void apagarItens([itemPrevia])} />
              </div>
            )}
          </DrawerContent>
        </Drawer>
      )}

      {/* BARRA DO LOTE */}
      {selecionados.length > 0 && (
        <div className="fixed inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[min(760px,calc(100vw-8rem))] bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-5 z-40 rounded-2xl bg-[#0A0A0A] text-white shadow-2xl px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={limparSel} aria-label="Limpar seleção" className="shrink-0 rounded-full p-1 text-white/70 hover:text-white"><X className="h-4 w-4" /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-body font-extrabold whitespace-nowrap">{selecionados.length} {selecionados.length === 1 ? "selecionado" : "selecionados"}</p>
            <p className="hidden sm:block text-[11.5px] font-body text-white/60 truncate">{selecionados.map((s) => s.label).join(", ")}</p>
          </div>
          <button type="button" disabled={restaurar.isPending} onClick={() => restaurarItens(selecionados)}
            className="shrink-0 h-9 rounded-full bg-[#00A652] px-4 text-[13px] font-body font-bold inline-flex items-center gap-1.5 disabled:opacity-60">
            {restaurar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            <span className="sm:hidden">Restaurar</span><span className="hidden sm:inline">Restaurar {selecionados.length === 1 ? "" : `os ${selecionados.length}`}</span>
          </button>
          <button type="button" disabled={apagar.isPending} onClick={() => void apagarItens(selecionados)}
            className="shrink-0 h-9 rounded-full border border-white/60 px-4 text-[13px] font-body font-bold disabled:opacity-60">
            <span className="sm:hidden">Apagar</span><span className="hidden sm:inline">Apagar de vez</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

function Pilula({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("shrink-0 h-8 rounded-full border px-3.5 text-xs font-body font-bold transition-colors",
        on ? "bg-foreground text-background border-foreground" : "border-border bg-card text-foreground/80 hover:border-foreground/40")}>
      {children}
    </button>
  );
}

/* Um papel: fundo com dobras leves, etiqueta do tipo e os dias que faltam. */
function Papel({ row, inclinacao, marcado, emPrevia, onMarcar, onAbrir }: {
  row: TrashRow; inclinacao: number; marcado: boolean; emPrevia: boolean; onMarcar: () => void; onAbrir: () => void;
}) {
  const t = tipoDe(row.kind);
  const dias = diasRestantes(row.deleted_at);
  const perto = dias <= 7;
  return (
    <div
      role="button" tabIndex={0} onClick={onAbrir} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir(); } }}
      className={cn("relative cursor-pointer rounded-[14px] border bg-card px-3.5 py-3 text-left transition-all hover:-translate-y-0.5",
        "shadow-[2px_3px_0_rgba(0,0,0,.08)]",
        emPrevia ? "border-[#0061EE] ring-2 ring-[#0061EE]/30" : "border-border",
        marcado && "border-foreground")}
      style={{
        transform: `rotate(${inclinacao}deg)`,
        backgroundImage: "linear-gradient(115deg, transparent 46%, rgba(0,0,0,.035) 47%, transparent 49%), linear-gradient(62deg, transparent 58%, rgba(0,0,0,.03) 59%, transparent 61%)",
      }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={(e) => { e.stopPropagation(); onMarcar(); }} aria-pressed={marcado}
          aria-label={marcado ? `Desmarcar ${row.label}` : `Marcar ${row.label}`}
          className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2 transition-colors",
            marcado ? "bg-foreground border-foreground text-background" : "border-foreground/40 bg-card")}>
          {marcado && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-body font-extrabold uppercase tracking-wide" style={{ background: t.cor, color: t.texto ?? "#fff" }}>{t.nome}</span>
        <span className={cn("ml-auto font-display font-extrabold italic text-[15px] -rotate-2", perto ? "text-[#EB4918]" : "text-foreground/80")}>
          {dias === 0 ? "hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}`}
        </span>
      </div>
      <p className="mt-2 text-[14px] font-body font-bold text-foreground leading-snug line-clamp-2">{row.label}</p>
      <p className="text-[11.5px] font-body text-muted-foreground mt-0.5 truncate">
        {row.detalhe ? `${row.detalhe} · ` : ""}excluído {dataCurta(row.deleted_at)}
      </p>
    </div>
  );
}

function Previa({ row, solta, onRestaurar, onApagar }: { row: TrashRow; solta?: boolean; onRestaurar: () => void; onApagar: () => void }) {
  const t = tipoDe(row.kind);
  const dias = diasRestantes(row.deleted_at);
  const quando = new Date(row.deleted_at);
  return (
    <div className={cn(!solta && "rounded-2xl border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_hsl(var(--foreground))]")}>
      <span className="rounded-full px-2 py-0.5 text-[10px] font-body font-extrabold uppercase tracking-wide" style={{ background: t.cor, color: t.texto ?? "#fff" }}>{t.nome}</span>
      <p className="mt-2 text-lg font-display font-extrabold text-foreground leading-tight">{row.label}</p>
      {row.detalhe && <p className="text-[12.5px] font-body text-muted-foreground mt-0.5">{row.detalhe}</p>}
      <p className="text-[12.5px] font-body text-muted-foreground mt-2">
        Excluído em {quando.toLocaleDateString("pt-BR")} às {quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="mt-3 font-display font-extrabold italic text-[#EB4918] text-[17px] -rotate-1">
        {dias === 0 ? "some hoje à noite" : `some em ${dias} ${dias === 1 ? "dia" : "dias"}`}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onRestaurar}
          className="flex-1 h-10 rounded-full bg-[#00A652] text-white text-[13px] font-body font-bold border-2 border-foreground shadow-[0_3px_0_hsl(var(--foreground))] inline-flex items-center justify-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
        </button>
        <button type="button" onClick={onApagar}
          className="flex-1 h-10 rounded-full bg-card text-foreground text-[13px] font-body font-bold border-2 border-foreground">
          Apagar de vez
        </button>
      </div>
    </div>
  );
}

/* O cesto de papéis do topo, desenhado à mão no estilo do Cria. */
function Cesto({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 110 92" className={className} aria-hidden>
      <path d="M14 22h82l-9 66H23z" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="2.5" className="text-foreground" />
      <path d="M30 30l6 52M55 30v52M80 30l-6 52M18 46h74M20 64h70" stroke="currentColor" strokeWidth="1.5" opacity=".3" className="text-foreground" />
      <circle cx="40" cy="16" r="13" fill="#FFCF03" stroke="currentColor" strokeWidth="2" className="text-foreground" />
      <circle cx="64" cy="12" r="11" fill="#FF77B9" stroke="currentColor" strokeWidth="2" className="text-foreground" />
      <circle cx="80" cy="19" r="9" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="2" className="text-foreground" />
      <path d="M33 12l6 5M45 10l-4 7M60 7l6 6M76 16l6 4" stroke="currentColor" strokeWidth="1.3" className="text-foreground" />
    </svg>
  );
}
