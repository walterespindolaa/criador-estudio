import { useMemo, useState } from "react";
import { History, Search, Loader2, AlertTriangle, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/shared/Confirm";
import { SummaryCard } from "@/components/hubcria/ResultadoPesquisa";
import { PESQUISA_POR_TIPO } from "@/lib/radar-catalogo";
import { useCrmClients } from "@/hooks/useCrm";
import {
  useAllScrapes, useAllCreativeIdeas, useDeleteScrape, useDeleteIdea, useUpdateIdeaStatus,
  useMoveScrape, useCopyScrapeToClient,
  type CreativeIdea,
} from "@/hooks/useHubCria";

/* ═══════════════════════════════════════════════════════════════════════════
   O HISTÓRICO DE TUDO

   O histórico só existia DENTRO de um cliente. Quem paga pelo módulo abria a
   tela e não conseguia responder três perguntas básicas:
     · o que eu já pesquisei esse mês?
     · onde foi parar aquela leitura que eu fiz semana passada?
     · essa pesquisa serve pro outro cliente, como eu mando pra lá?

   Aqui está tudo junto, com busca por @, filtro por cliente e por tipo, e as
   ações de mover, copiar e excluir em cada card. Copiar não gasta crédito: o
   resultado já está no banco, é o mesmo dado.
   ═══════════════════════════════════════════════════════════════════════════ */

const PAGINA = 10;

/** "@https://www.instagram.com/reel/XYZ" vira "reel XYZ"; @perfil fica @perfil. */
function handleCurto(h: string): string {
  const limpo = h.replace(/^@/, "");
  const m = /instagram\.com\/(reels?|p|tv)\/([^/?#]+)/i.exec(limpo);
  if (m) return `${m[1].startsWith("reel") ? "reel" : "post"} ${m[2].slice(0, 11)}`;
  if (/^https?:\/\//i.test(limpo)) return "link";
  return `@${limpo.slice(0, 30)}`;
}

export function HistoricoRadar() {
  const { data: scrapes = [], isLoading } = useAllScrapes();
  const { data: ideas = [] } = useAllCreativeIdeas();
  const { data: carteira = [] } = useCrmClients();
  const delScrape = useDeleteScrape();
  const delIdeia = useDeleteIdea();
  const updIdeia = useUpdateIdeaStatus();
  const mover = useMoveScrape();
  const copiar = useCopyScrapeToClient();

  const [busca, setBusca] = useState("");
  const [cliente, setCliente] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [quantos, setQuantos] = useState(PAGINA);
  /* POR CLIENTE (Walter, 06/11/2026: "aparece o histórico de todos os clientes
     misturado"). Em "Todos os clientes" a lista vira um grupo por cliente,
     fechado, com quantas leituras tem e a última; abre um de cada vez. */
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);
  const [verFalhas, setVerFalhas] = useState(false);

  const nomeCliente = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of carteira) m[c.id] = c.display_name || c.name;
    return m;
  }, [carteira]);

  const listaClientes = useMemo(
    () => carteira.map((c) => ({ id: c.id, nome: c.display_name || c.name })),
    [carteira],
  );

  const ideasByScrape = useMemo(() => {
    const m: Record<string, CreativeIdea[]> = {};
    for (const i of ideas) {
      const k = (i as { scrape_id?: string | null }).scrape_id;
      if (k) (m[k] ||= []).push(i);
    }
    return m;
  }, [ideas]);

  const prontas = useMemo(() => scrapes.filter((s) => s.status === "done" && s.result_summary), [scrapes]);
  const falhas = useMemo(() => scrapes.filter((s) => s.status === "error"), [scrapes]);

  // Tipos que realmente aparecem no histórico: filtro com opção vazia é ruído.
  const tiposPresentes = useMemo(
    () => Array.from(new Set(prontas.map((s) => s.scrape_type))),
    [prontas],
  );

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase().replace(/^@/, "");
    return prontas.filter((s) => {
      if (cliente === "avulsas" ? s.crm_client_id != null : cliente !== "todos" && s.crm_client_id !== cliente) return false;
      if (tipo !== "todos" && s.scrape_type !== tipo) return false;
      if (!t) return true;
      const alvo = `${s.input_handle} ${nomeCliente[s.crm_client_id ?? ""] ?? ""}`.toLowerCase();
      return alvo.includes(t);
    });
  }, [prontas, busca, cliente, tipo, nomeCliente]);

  const visiveis = filtradas.slice(0, quantos);

  const grupos = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; itens: typeof filtradas }>();
    for (const s of filtradas) {
      const id = s.crm_client_id ?? "__avulsas";
      const nome = s.crm_client_id ? nomeCliente[s.crm_client_id] ?? "Cliente removido" : "Pesquisas avulsas";
      if (!m.has(id)) m.set(id, { id, nome, itens: [] });
      m.get(id)!.itens.push(s);
    }
    // Quem leu por último vem primeiro (a lista já chega do mais novo pro mais velho).
    return [...m.values()];
  }, [filtradas, nomeCliente]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-display font-extrabold text-foreground">Histórico de pesquisas</h2>
        {prontas.length > 0 && (
          <span className="text-[12px] font-body text-muted-foreground">
            {prontas.length} {prontas.length === 1 ? "leitura guardada" : "leituras guardadas"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-14 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-primary" /></div>
      ) : prontas.length === 0 && falhas.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
          <Search className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm font-display font-bold text-foreground">Nenhuma pesquisa ainda</p>
          <p className="text-[13px] font-body text-muted-foreground mt-1 max-w-sm mx-auto">
            Abra um cliente e rode a primeira leitura. Tudo que você pesquisar fica guardado aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Filtros. Busca por @ ou por nome de cliente, porque a pessoa lembra
              de um dos dois, nunca da data. */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 mb-3">
            <div className="relative col-span-2 sm:min-w-[180px] sm:flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setQuantos(PAGINA); }}
                placeholder="Buscar por @ ou cliente"
                className="h-10 pl-9"
              />
              {busca && (
                <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground" aria-label="Limpar busca">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={cliente}
              onChange={(e) => { setCliente(e.target.value); setQuantos(PAGINA); }}
              className="h-10 min-w-0 w-full sm:w-auto rounded-xl border border-border bg-card px-3 text-[13px] font-body text-foreground"
              aria-label="Filtrar por cliente"
            >
              <option value="todos">Todos os clientes</option>
              <option value="avulsas">Pesquisas avulsas</option>
              {listaClientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>

            <select
              value={tipo}
              onChange={(e) => { setTipo(e.target.value); setQuantos(PAGINA); }}
              className="h-10 min-w-0 w-full sm:w-auto rounded-xl border border-border bg-card px-3 text-[13px] font-body text-foreground"
              aria-label="Filtrar por tipo de pesquisa"
            >
              <option value="todos">Todos os tipos</option>
              {tiposPresentes.map((t) => (
                <option key={t} value={t}>{PESQUISA_POR_TIPO[t]?.nome ?? t}</option>
              ))}
            </select>
          </div>

          {/* As que falharam. Elas ficavam invisíveis e sem botão de apagar. */}
          {falhas.length > 0 && cliente === "todos" && tipo === "todos" && !busca && (
            <div className="mb-3 space-y-2">
              {/* As falhas viram UMA linha que abre (eram 4 cartões grandes no topo). */}
              <button type="button" onClick={() => setVerFalhas((v) => !v)}
                className="w-full flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-left">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                <span className="flex-1 text-[13px] font-body font-semibold text-foreground">
                  {falhas.length} {falhas.length === 1 ? "leitura não completou" : "leituras não completaram"}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", verFalhas && "rotate-180")} />
              </button>
              {verFalhas && falhas.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-display font-bold text-foreground truncate">
                      {PESQUISA_POR_TIPO[s.scrape_type]?.nome ?? "Pesquisa"} · {handleCurto(s.input_handle)}
                      {s.crm_client_id && nomeCliente[s.crm_client_id] ? ` · ${nomeCliente[s.crm_client_id]}` : ""}
                    </p>
                    <p className="text-[11.5px] font-body text-muted-foreground leading-snug">{s.error || "Não completou."}</p>
                  </div>
                  <button
                    onClick={async () => { if (await confirmar({ titulo: "Apagar esta pesquisa?", acao: "Apagar" })) delScrape.mutate(s.id); }}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                    aria-label="Apagar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {filtradas.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border px-6 py-10 text-center">
              <p className="text-sm font-display font-bold text-foreground">Nada com esse filtro</p>
              <p className="text-[13px] font-body text-muted-foreground mt-1">Limpe a busca ou troque o cliente.</p>
            </div>
          ) : (
            cliente === "todos" && !busca ? (
              <div className="space-y-2">
                {grupos.map((g) => {
                  const aberto = grupoAberto === g.id;
                  return (
                    <div key={g.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                      <button type="button" onClick={() => setGrupoAberto(aberto ? null : g.id)}
                        className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-muted/30 transition-colors">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-display font-extrabold text-sm">
                          {g.nome.trim().charAt(0).toUpperCase() || "?"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-display font-bold text-foreground truncate">{g.nome}</span>
                          <span className="block text-[11.5px] font-body text-muted-foreground">
                            {g.itens.length} {g.itens.length === 1 ? "leitura" : "leituras"} · última {new Date(g.itens[0].created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        </span>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
                      </button>
                      {aberto && (
                        <div className="border-t border-border p-2.5 sm:p-3 space-y-3 bg-background/50">
                          {g.itens.slice(0, 5).map((s) => (
                <SummaryCard
                  key={s.id}
                  summary={s.result_summary as Record<string, unknown>}
                  handle={s.input_handle}
                  quando={s.created_at}
                  custo={s.cost_usd}
                  clienteNome={s.crm_client_id ? nomeCliente[s.crm_client_id] ?? "Cliente removido" : "Avulsa"}
                  ideas={ideasByScrape[s.id] || []}
                  onIdeaStatus={(id, status) => updIdeia.mutate({ id, status })}
                  onIdeaDelete={(id) => delIdeia.mutate(id)}
                  onDelete={() => delScrape.mutate(s.id)}
                  clientes={listaClientes.filter((c) => c.id !== s.crm_client_id)}
                  aoMover={(para) => mover.mutate({ id: s.id, para })}
                  aoDuplicar={(para) => copiar.mutate({ scrape: s, para, ideas: ideasByScrape[s.id] || [] })}
                  crmClientId={s.crm_client_id}
                  scrapeId={s.id}
                />
                          ))}
                          {g.itens.length > 5 && (
                            <Button variant="outline" className="w-full" onClick={() => { setCliente(g.id === "__avulsas" ? "avulsas" : g.id); setQuantos(PAGINA); }}>
                              Ver as {g.itens.length} leituras de {g.nome}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="space-y-3">
              {visiveis.map((s) => (
                <SummaryCard
                  key={s.id}
                  summary={s.result_summary as Record<string, unknown>}
                  handle={s.input_handle}
                  quando={s.created_at}
                  custo={s.cost_usd}
                  clienteNome={s.crm_client_id ? nomeCliente[s.crm_client_id] ?? "Cliente removido" : "Avulsa"}
                  ideas={ideasByScrape[s.id] || []}
                  onIdeaStatus={(id, status) => updIdeia.mutate({ id, status })}
                  onIdeaDelete={(id) => delIdeia.mutate(id)}
                  onDelete={() => delScrape.mutate(s.id)}
                  clientes={listaClientes.filter((c) => c.id !== s.crm_client_id)}
                  aoMover={(para) => mover.mutate({ id: s.id, para })}
                  aoDuplicar={(para) => copiar.mutate({ scrape: s, para, ideas: ideasByScrape[s.id] || [] })}
                  crmClientId={s.crm_client_id}
                  scrapeId={s.id}
                />
              ))}
            </div>
            )
          )}

          {!(cliente === "todos" && !busca) && filtradas.length > visiveis.length && (
            <Button
              variant="outline"
              className={cn("mt-3 w-full")}
              onClick={() => setQuantos((q) => q + PAGINA)}
            >
              Ver mais {Math.min(PAGINA, filtradas.length - visiveis.length)} de {filtradas.length - visiveis.length}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
