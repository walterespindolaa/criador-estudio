import { useState } from "react";
import { Copy, ExternalLink, FolderOpen, Instagram, Link2, Loader2, Palette, Sparkles, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROTULO_PAPEL, useMinhasAgencias, useMinhasMarcas, type MarcaDoParceiro } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   MARCAS QUE ATENDO

   Era uma lista de AGÊNCIAS com dois números, e o Walter tinha razão: não dava
   pra abrir ninguém. A tela virou o que ela precisava ser, a partir do que a
   Gabriela mantém no Trello dela: um card fixo "Infos Clientes" por cliente,
   com material da marca, refs visuais, redes, site e as regras permanentes.

   Isso não é informação de PEÇA, é de CLIENTE. Por isso a identidade sai de
   dentro de cada card do quadro e passa a morar aqui, numa FICHA por marca que
   o parceiro abre uma vez e consulta quantas quiser.

   Cachê saiu daqui e virou página própria: dinheiro dividindo tela com
   identidade de marca é confusão (Walter, 09/09/2026).
   ═══════════════════════════════════════════════════════════════════════════ */

const copiar = (t: string, msg: string) => { void navigator.clipboard.writeText(t); toast.success(msg); };

/** Um pedaço da ficha. Só aparece quando a agência preencheu: campo vazio com
 *  rótulo é pior do que campo ausente, dá a impressão de tela quebrada. */
function Bloco({ titulo, cor, children }: { titulo: string; cor?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] font-body font-bold uppercase tracking-wider mb-1" style={{ color: cor ?? undefined }}>
        {titulo}
      </p>
      {children}
    </div>
  );
}

/* O texto sai do bege chapado e ganha um cartão com fio na cor da marca. Ler
   dez parágrafos soltos no mesmo fundo era o que dava a sensação de tela
   apagada (Walter, 09/09/2026). */
function Texto({ titulo, valor, cor }: { titulo: string; valor: string | null; cor?: string }) {
  if (!valor?.trim()) return null;
  return (
    <Bloco titulo={titulo} cor={cor}>
      <p className="text-[13px] font-body text-foreground/90 leading-relaxed whitespace-pre-line rounded-xl bg-card border border-border border-l-[3px] px-3 py-2"
        style={{ borderLeftColor: cor ?? undefined }}>
        {valor}
      </p>
    </Bloco>
  );
}

/* Exportada porque o quadro por cliente das Minhas demandas abre a MESMA
   ficha: é o card fixo "Infos Clientes" que a Gabriela mantém no topo de cada
   coluna do Trello, e ele tem que ser o mesmo documento nos dois lugares
   (Walter, 09/09/2026). */
export function FichaDaMarca({ m, aoFechar }: { m: MarcaDoParceiro | null; aoFechar: () => void }) {
  if (!m) return null;
  const cor = m.cor || "#4B3FA8";
  const tags = (m.hashtags ?? []).filter(Boolean);
  const refs = m.referencias ?? [];
  const links = (m.links ?? []).filter((l) => !!l?.url?.trim());
  return (
    <Dialog open={!!m} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl overflow-hidden max-h-[88vh] overflow-y-auto [&>button:last-child]:hidden">
        {/* A CAPA DA MARCA. Faixa chapada é sem vida (Walter, 09/09/2026): o
            logo entra borrado e ampliado no fundo, dando textura na cor da
            própria marca, mais dois círculos de luz e sombra. O X é próprio,
            redondo e com fundo, porque o padrão do dialog é cinza-claro e
            desaparecia em cima da cor. */}
        <div className="relative h-24 overflow-hidden" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}aa)` }}>
          {m.logo && (
            <img src={m.logo} alt="" aria-hidden draggable={false}
              className="absolute inset-0 w-full h-full object-cover opacity-30"
              style={{ transform: "scale(1.8)", filter: "blur(26px) saturate(1.4)" }} />
          )}
          <span aria-hidden className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/15" />
          <span aria-hidden className="absolute -left-8 -bottom-14 h-32 w-32 rounded-full bg-black/10" />
          <button type="button" onClick={aoFechar} aria-label="Fechar"
            className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/45">
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="w-14 h-14 rounded-full border-[3px] border-background bg-card overflow-hidden grid place-items-center shrink-0 -mt-12 shadow-lg relative z-10"
                style={{ background: m.logo ? "#fff" : cor }}>
                {m.logo
                  ? <img src={m.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
                  : <span className="text-white font-display font-bold text-xl">{m.nome.charAt(0).toUpperCase()}</span>}
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

          {/* OS LINKS SÃO O QUE ELE MAIS USA. É o "Material da Marca / Refs
              Visuais / Site / Fotos Estúdio" do Trello. Ficam no topo, antes
              de qualquer texto: quem monta arte abre pasta, não lê parágrafo. */}
          {links.length > 0 && (
            <Bloco titulo="Material e links da marca" cor={cor}>
              <div className="grid gap-1.5">
                {links.map((l, i) => (
                  <a key={`${l.url}-${i}`} href={l.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12.5px] font-body font-bold text-foreground hover:border-primary/40 transition-colors">
                    {/drive\.google|dropbox|onedrive/i.test(l.url)
                      ? <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                      : <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                    <span className="truncate">{l.label?.trim() || l.url}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                  </a>
                ))}
              </div>
            </Bloco>
          )}

          {m.paleta?.trim() && (
            <Bloco titulo="Paleta" cor={cor}>
              <p className="text-[13px] font-body text-foreground/90 leading-relaxed flex items-start gap-1.5 rounded-xl bg-card border border-border border-l-[3px] px-3 py-2" style={{ borderLeftColor: cor }}>
                <Palette className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />{m.paleta}
              </p>
            </Bloco>
          )}
          {m.fontes?.trim() && (
            <Bloco titulo="Fontes" cor={cor}>
              <p className="text-[13px] font-body text-foreground/90 leading-relaxed flex items-start gap-1.5 rounded-xl bg-card border border-border border-l-[3px] px-3 py-2" style={{ borderLeftColor: cor }}>
                <Type className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />{m.fontes}
              </p>
            </Bloco>
          )}
          <Texto titulo="Expressão visual" valor={m.expressao_visual} cor={cor} />

          {/* A VOZ: como a marca fala. Serve pro copy e pro texto que entra na
              arte, que hoje o designer escreve no olho. */}
          <Texto titulo="Tom de voz" valor={m.tom_de_voz} cor={cor} />
          <Texto titulo="Personalidade" valor={m.personalidade} cor={cor} />
          <Texto titulo="Estilo de comunicação" valor={m.estilo_comunicacao} cor={cor} />
          <Texto titulo="Arquétipo" valor={m.arquetipo} cor={cor} />

          {/* O NEGÓCIO: pra quem é e o que a marca vende. Sem isso a peça sai
              bonita e fora do alvo. */}
          <Texto titulo="Público" valor={m.publico} cor={cor} />
          <Texto titulo="O que a marca vende" valor={m.oferta} cor={cor} />
          <Texto titulo="Temas que a marca trabalha" valor={m.temas} cor={cor} />
          <Texto titulo="Ideia central" valor={m.ideia_central} cor={cor} />
          <Texto titulo="Promessa" valor={m.promessa} cor={cor} />

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
            <Bloco titulo="Hashtags da marca" cor={cor}>
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
            <Bloco titulo={`Referências visuais (${refs.length})`} cor={cor}>
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
  const [aberta, setAberta] = useState<MarcaDoParceiro | null>(null);

  return (
    <div className="space-y-5">
      {/* O título mora na faixa do topo do ManagerLayout. */}

      {/* AS MARCAS: o miolo da tela. Cada uma abre a ficha. */}
      <section>
        <div className="flex items-baseline gap-2 mb-2 px-0.5">
          <h2 className="font-display font-bold text-[15px] text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> As marcas que passam pela sua mão</h2>
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
                      {(m.links ?? []).length > 0 && (
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1">
                          <FolderOpen className="h-2.5 w-2.5" /> {(m.links ?? []).length} link{(m.links ?? []).length > 1 ? "s" : ""}
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
            {agencias.map((a) => (
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
                </Card>
            ))}
          </div>
        )}
      </section>

      <FichaDaMarca m={aberta} aoFechar={() => setAberta(null)} />
    </div>
  );
}
