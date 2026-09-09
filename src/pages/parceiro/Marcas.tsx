import { useState } from "react";
import { Copy, ExternalLink, Instagram, Loader2, Palette, Type, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROTULO_PAPEL, useMeusCaches, useMinhasAgencias, useMinhasMarcas, type MarcaDoParceiro } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   MARCAS QUE ATENDO

   Era uma lista de AGÊNCIAS com dois números, e o Walter tinha razão: não dava
   pra abrir ninguém. A tela virou o que ela precisava ser, a partir do que a
   Gabriela mantém no Trello dela: um card fixo "Infos Clientes" por cliente,
   com material da marca, refs visuais, redes, site e as regras permanentes.

   Isso não é informação de PEÇA, é de CLIENTE. Por isso a identidade sai de
   dentro de cada card do quadro e passa a morar aqui, numa FICHA por marca que
   o parceiro abre uma vez e consulta quantas quiser.

   Ordem da tela: cachês (o que eu tenho a receber) > as marcas > as agências.
   ═══════════════════════════════════════════════════════════════════════════ */

const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const copiar = (t: string, msg: string) => { void navigator.clipboard.writeText(t); toast.success(msg); };

/** Um pedaço da ficha. Só aparece quando a agência preencheu: campo vazio com
 *  rótulo é pior do que campo ausente, dá a impressão de tela quebrada. */
function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-muted-foreground mb-1">{titulo}</p>
      {children}
    </div>
  );
}

function Texto({ titulo, valor }: { titulo: string; valor: string | null }) {
  if (!valor?.trim()) return null;
  return (
    <Bloco titulo={titulo}>
      <p className="text-[13px] font-body text-foreground/90 leading-relaxed whitespace-pre-line">{valor}</p>
    </Bloco>
  );
}

function FichaDaMarca({ m, aoFechar }: { m: MarcaDoParceiro | null; aoFechar: () => void }) {
  if (!m) return null;
  const cor = m.cor || "#4B3FA8";
  const tags = (m.hashtags ?? []).filter(Boolean);
  const refs = m.referencias ?? [];
  return (
    <Dialog open={!!m} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl overflow-hidden max-h-[88vh] overflow-y-auto">
        <div className="h-20" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}cc)` }} />
        <div className="p-5 space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full border-2 border-background bg-card overflow-hidden grid place-items-center shrink-0 -mt-10 shadow"
                style={{ background: m.logo ? undefined : cor }}>
                {m.logo
                  ? <img src={m.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
                  : <span className="text-white font-display font-bold text-lg">{m.nome.charAt(0).toUpperCase()}</span>}
              </span>
              <div className="min-w-0">
                <DialogTitle className="font-display text-lg font-extrabold leading-tight truncate">{m.nome}</DialogTitle>
                <p className="text-[11.5px] font-body text-muted-foreground">
                  via {m.agencia_nome}{m.segmento ? ` · ${m.segmento}` : ""}
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* IDENTIDADE: o que ele copia e cola enquanto monta a arte. */}
          <div className="flex flex-wrap items-center gap-2">
            {m.cor && (
              <button type="button" onClick={() => copiar(m.cor!, `${m.cor} copiado.`)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 hover:border-primary/40 transition-colors"
                title="Copiar o hex">
                <span className="w-5 h-5 rounded-md border border-border" style={{ background: m.cor }} />
                <span className="text-[11.5px] font-mono text-muted-foreground">{m.cor}</span>
                <Copy className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {m.handle && (
              <a href={`https://instagram.com/${m.handle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-[11.5px] font-body font-bold text-foreground hover:border-primary/40 transition-colors">
                <Instagram className="h-3.5 w-3.5" /> @{m.handle.replace(/^@/, "")}
              </a>
            )}
            {m.logo && (
              <a href={m.logo} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-[11.5px] font-body font-bold text-foreground hover:border-primary/40 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" /> abrir o logo
              </a>
            )}
          </div>

          {m.paleta?.trim() && (
            <Bloco titulo="Paleta">
              <p className="text-[13px] font-body text-foreground/90 leading-relaxed flex items-start gap-1.5">
                <Palette className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />{m.paleta}
              </p>
            </Bloco>
          )}
          {m.fontes?.trim() && (
            <Bloco titulo="Fontes">
              <p className="text-[13px] font-body text-foreground/90 leading-relaxed flex items-start gap-1.5">
                <Type className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />{m.fontes}
              </p>
            </Bloco>
          )}
          <Texto titulo="Tom de voz" valor={m.tom_de_voz} />
          <Texto titulo="Temas que a marca trabalha" valor={m.temas} />

          {/* O QUE EVITAR é o campo que mais economiza retrabalho: é o
              "não usar o Frederico nas fotos individuais" do Trello dela. */}
          {m.evitar?.trim() && (
            <Bloco titulo="O que evitar">
              <p className="text-[13px] font-body text-foreground leading-relaxed whitespace-pre-line rounded-xl bg-red-50/70 border border-red-200 px-3 py-2.5">
                {m.evitar}
              </p>
            </Bloco>
          )}
          {m.observacoes?.trim() && (
            <Bloco titulo="Observações da agência">
              <p className="text-[13px] font-body text-foreground leading-relaxed whitespace-pre-line rounded-xl bg-amber-50/60 border border-amber-200 px-3 py-2.5">
                {m.observacoes}
              </p>
            </Bloco>
          )}

          {tags.length > 0 && (
            <Bloco titulo="Hashtags da marca">
              <div className="flex flex-wrap gap-1.5">
                {tags.map((h) => (
                  <button key={h} type="button" onClick={() => copiar(h, "Hashtag copiada.")}
                    className="text-[11.5px] font-body px-2 py-1 rounded-lg bg-muted border border-border/60 hover:border-primary/40 transition-colors">
                    {h}
                  </button>
                ))}
                <button type="button" onClick={() => copiar(tags.join(" "), "Todas as hashtags copiadas.")}
                  className="text-[11.5px] font-body font-bold px-2 py-1 rounded-lg text-primary hover:underline">
                  copiar todas
                </button>
              </div>
            </Bloco>
          )}

          {refs.length > 0 && (
            <Bloco titulo={`Referências visuais (${refs.length})`}>
              <div className="grid grid-cols-3 gap-1.5">
                {refs.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" title={r.nota ?? undefined}
                    className="block aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:border-primary/40 transition-colors">
                    <img src={r.url} alt={r.nota ?? ""} loading="lazy" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </Bloco>
          )}

          <p className="text-[11px] font-body text-muted-foreground pt-1 border-t border-border">
            Quem mantém esta ficha é a agência. Faltou alguma coisa aqui, é com ela.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Marcas() {
  const { data: agencias = [], isLoading } = useMinhasAgencias();
  const { data: marcas = [], isLoading: carregandoMarcas } = useMinhasMarcas();
  const { data: caches = [] } = useMeusCaches();
  const [aberta, setAberta] = useState<MarcaDoParceiro | null>(null);
  const cacheDe = (id: string) => caches.find((c) => c.manager_id === id);
  const totalPendente = caches.reduce((s, c) => s + Number(c.pendente ?? 0), 0);
  const totalPago = caches.reduce((s, c) => s + Number(c.pago ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* O título mora na faixa do topo do ManagerLayout. */}

      {/* MEUS CACHÊS (fase 3): o que cada agência deve e já pagou. Nasce do
          cachê combinado no card, lançado no Caixa dela quando você entrega.
          Só aparece quando existe algum lançamento. */}
      {caches.length > 0 && (
        /* id="caches": alvo do item "Meus cachês" do menu, que abre esta mesma
           tela. Sem a âncora o clique largava a pessoa no topo e ela não via
           por que tinha ido parar ali (Walter, 09/09/2026). */
        <Card id="caches" className="rounded-2xl border-border p-4 sm:p-5 scroll-mt-24">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-8 w-8 rounded-xl bg-green-100 text-green-700 grid place-items-center"><Wallet className="h-4 w-4" /></span>
            <div>
              <p className="font-display font-bold text-[15px] text-foreground leading-tight">Meus cachês</p>
              <p className="text-[11.5px] font-body text-muted-foreground">Cada entrega com cachê combinado entra aqui. Quem marca como pago é a agência, no Caixa dela.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
              <p className="font-display font-extrabold text-lg leading-none text-amber-800">{brl(totalPendente)}</p>
              <p className="text-[11px] font-body font-semibold text-amber-900/70 mt-1">a receber</p>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
              <p className="font-display font-extrabold text-lg leading-none text-green-700">{brl(totalPago)}</p>
              <p className="text-[11px] font-body font-semibold text-green-800/70 mt-1">já recebido</p>
            </div>
          </div>
          <ul className="divide-y divide-border/70">
            {caches.map((c) => (
              <li key={c.manager_id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[13px] font-body font-semibold text-foreground truncate">{c.agencia}</span>
                  <span className="block text-[11px] font-body text-muted-foreground">
                    {c.pendente_qtd > 0 ? `${c.pendente_qtd} entrega${c.pendente_qtd > 1 ? "s" : ""} em aberto` : "Tudo pago"}
                    {c.ultimo_pago ? ` · último pagamento ${c.ultimo_pago.slice(8, 10)}/${c.ultimo_pago.slice(5, 7)}` : ""}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[13px] font-display font-extrabold text-amber-800">{brl(Number(c.pendente))}</span>
                  <span className="block text-[10.5px] font-body text-green-700">{brl(Number(c.pago))} pago</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* AS MARCAS: o miolo da tela. Cada uma abre a ficha. */}
      <section>
        <div className="flex items-baseline gap-2 mb-2 px-0.5">
          <h2 className="font-display font-bold text-[15px] text-foreground">As marcas que passam pela sua mão</h2>
          {marcas.length > 0 && <span className="text-[11.5px] font-body text-muted-foreground">{marcas.length}</span>}
        </div>
        <p className="text-[11.5px] font-body text-muted-foreground mb-3 px-0.5">
          Clique numa marca pra abrir a ficha: cor, fontes, hashtags, tom de voz, o que evitar e as referências.
          É a informação que antes vinha repetida em cada card de peça.
        </p>

        {carregandoMarcas ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : marcas.length === 0 ? (
          <Card className="p-8 rounded-2xl border-dashed text-center">
            <p className="text-sm font-body text-muted-foreground max-w-md mx-auto">
              Nenhuma marca ainda. Assim que uma agência te mandar a primeira peça de um cliente,
              a ficha da marca dele aparece aqui.
            </p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {marcas.map((m) => {
              const cor = m.cor || "#4B3FA8";
              return (
                <button key={m.external_client_id} type="button" onClick={() => setAberta(m)}
                  className="text-left rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all">
                  <span className="block h-1.5" style={{ background: cor }} />
                  <span className="block p-3.5">
                    <span className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-full border border-border bg-background overflow-hidden grid place-items-center shrink-0"
                        style={{ background: m.logo ? undefined : cor }}>
                        {m.logo
                          ? <img src={m.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
                          : <span className="text-white font-display font-bold text-sm">{m.nome.charAt(0).toUpperCase()}</span>}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display font-bold text-[14px] text-foreground truncate">{m.nome}</span>
                        <span className="block text-[11px] font-body text-muted-foreground truncate">via {m.agencia_nome}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {m.abertos > 0 && (
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {m.abertos} na sua mão
                        </span>
                      )}
                      {m.entregues_30d > 0 && (
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          {m.entregues_30d} em 30 dias
                        </span>
                      )}
                      {m.evitar?.trim() && (
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          tem regra
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* AS AGÊNCIAS: quem me acoplou. Ficou depois das marcas porque é o dado
          de relação, não o de trabalho do dia. */}
      <section>
        <h2 className="font-display font-bold text-[15px] text-foreground mb-2 px-0.5">Quem me acoplou</h2>
        {isLoading ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : agencias.length === 0 ? (
          <Card className="p-8 rounded-2xl border-dashed text-center">
            <p className="text-sm font-body text-muted-foreground max-w-md mx-auto">
              Nenhuma agência te acoplou ainda. Quando uma social mídia te convidar como parceiro,
              ela aparece aqui e os posts dela caem em Minhas demandas.
            </p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {agencias.map((a) => {
              const cx = cacheDe(a.agencia_id);
              return (
                <Card key={a.agencia_id} className="rounded-2xl border-border p-4">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white grid place-items-center font-display font-bold shrink-0">
                      {a.agencia_nome.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display font-bold text-[14px] text-foreground truncate">{a.agencia_nome}</span>
                      <span className="block text-[11.5px] font-body text-muted-foreground">
                        Você atende como {ROTULO_PAPEL[a.meu_papel] ?? a.meu_papel}
                        {" · "}{a.abertos} na mão{" · "}{a.entregues_30d} em 30 dias
                      </span>
                    </span>
                  </div>
                  {cx && Number(cx.pendente) > 0 && (
                    <p className="mt-2 text-[11.5px] font-body text-amber-800">
                      {brl(Number(cx.pendente))} a receber desta agência.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <FichaDaMarca m={aberta} aoFechar={() => setAberta(null)} />
    </div>
  );
}
