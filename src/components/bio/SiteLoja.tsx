import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { lista, txt, type DadosBloco } from "@/lib/bioBlocks";
import {
  agoraEmBrasilia, faixaDoDia, foneWhats, itensVisiveis, lerCardapio, lerHorarios, linhasDaSacola, linkWhats,
  mensagemDoPedido, qtdDoPedido, real, statusAgora, totalDoPedido, DIAS, type LinhaPedido, type Sacola,
} from "@/lib/bioLoja";
import { alvoDoLink, linkDoBotao, linkSeguro } from "@/lib/bioBlocks";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   SEÇÕES DO MODELO LOJA (22/10/2026)

   Capa de foto cheia com o selo de horário, faixa de vantagens, cardápio com
   sacola que fecha o pedido no WhatsApp, destaque da semana e horários.

   Foto grande e sacola abrem POR CIMA da tela (portal no body): dentro do
   site o `container-type` vira o "chão" de qualquer `fixed`, e a camada ficaria
   presa na altura da página inteira em vez de cobrir a tela.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Dentro da prévia do editor nada abre por cima: a camada sairia da moldura
 *  do celular e cobriria o editor. */
export const EmPreviaContext = createContext(false);

export type MarcaLoja = { nome: string; cor: string; corTexto: string };

/* ── CAPA DE FOTO CHEIA ── */
export function CapaVitrine({ d, marca, status, aoClicar }: {
  d: DadosBloco; marca: MarcaLoja; status: { aberto: boolean; texto: string } | null; aoClicar?: () => void;
}) {
  const img = txt(d, "imagem");
  const b1 = txt(d, "botao1"), u1 = linkDoBotao(txt(d, "url1"));
  const b2 = txt(d, "botao2"), u2 = linkDoBotao(txt(d, "url2"));
  return (
    <section id="topo" className="relative min-h-[520px] cq-md:min-h-[600px] flex flex-col justify-end text-[#FFF8EF] scroll-mt-[52px]"
      style={{ backgroundColor: "#2A1A10" }}>
      {img && <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" />}
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(20,12,6,.35) 0%, rgba(20,12,6,0) 30%, rgba(20,12,6,.2) 50%, rgba(20,12,6,.92) 100%)" }} />
      <div className="relative mx-auto w-full max-w-5xl px-5 pb-7 cq-md:pb-12 flex flex-col gap-3">
        {status && (
          <span className="self-start inline-flex items-center gap-2 rounded-full bg-[#FFF8EF] px-3 py-1.5 text-[13px] font-bold"
            style={{ color: status.aberto ? "#1E5B32" : "#7A2E1A" }}>
            <span aria-hidden className="w-2 h-2 rounded-full" style={{ backgroundColor: status.aberto ? "#2F9E55" : "#C2462B" }} />
            {status.texto}
          </span>
        )}
        <h1 className="font-display font-extrabold text-[2.1rem] cq-md:text-[3.2rem] leading-[1.02] tracking-[-0.02em] [text-wrap:balance]">{txt(d, "titulo")}</h1>
        {txt(d, "frase") && <p className="text-[15px] cq-md:text-[17px] opacity-90 max-w-[52ch]">{txt(d, "frase")}</p>}
        {(b1 || b2) && (
          <div className="grid grid-cols-2 gap-2.5 mt-1 max-w-[520px]">
            {b1 && u1 && (
              <a href={u1} {...alvoDoLink(u1)} onClick={aoClicar} className="h-12 rounded-xl grid place-items-center font-display font-bold text-[14.5px]"
                style={{ backgroundColor: marca.cor, color: marca.corTexto }}>{b1}</a>
            )}
            {b2 && u2 && (
              <a href={u2} {...alvoDoLink(u2)} onClick={aoClicar} className="h-12 rounded-xl grid place-items-center font-display font-bold text-[14.5px] border border-white/40 bg-white/15">{b2}</a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── FAIXA DE VANTAGENS ── */
export function FaixaVantagens({ d }: { d: DadosBloco }) {
  const itens = lista<{ titulo?: string; sub?: string }>(d, "itens").filter((i) => (i.titulo ?? "").trim()).slice(0, 3);
  if (!itens.length) return null;
  return (
    <div className="grid text-center bg-[#2A1A10] text-[#FFF8EF] py-3.5 px-2" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
      {itens.map((i, n) => (
        <div key={n} className={cn("px-1.5 text-[12px] leading-tight opacity-90", n > 0 && "border-l border-white/15")}>
          <b className="block text-[14.5px] opacity-100">{i.titulo}</b>{i.sub}
        </div>
      ))}
    </div>
  );
}

/* ── CARDÁPIO COM SACOLA ── */
export function SecaoCardapio({ d, marca, telefonePadrao, aoPedir }: {
  d: DadosBloco; marca: MarcaLoja; telefonePadrao?: string;
  /** Registra o "pedido iniciado" (sino do dono). Não bloqueia o WhatsApp. */
  aoPedir?: (linhas: LinhaPedido[]) => void;
}) {
  const emPrevia = useContext(EmPreviaContext);
  const c = useMemo(() => lerCardapio(d), [d]);
  const itens = itensVisiveis(c);
  const telefone = c.telefone || telefonePadrao || "";
  const vendePeloWhats = c.pedidos && !!foneWhats(telefone);
  const cats = c.categorias.filter((cat) => itens.some((i) => i.cat === cat));
  const [cat, setCat] = useState<string>("");
  const [sacola, setSacola] = useState<Sacola>({});
  const [aberto, setAberto] = useState<string | null>(null);
  const [sacolaAberta, setSacolaAberta] = useState(false);

  const mostrados = cat ? itens.filter((i) => i.cat === cat) : itens;
  const linhas = linhasDaSacola(c, sacola);
  const qtd = qtdDoPedido(linhas);
  const mudar = (id: string, delta: number) => setSacola((s) => {
    const q = Math.max(0, Math.min(99, (s[id] ?? 0) + delta));
    const n = { ...s, [id]: q };
    if (!q) delete n[id];
    return n;
  });

  // Fechar com Esc e não deixar a página rolar por baixo da camada.
  const camadaAberta = !!aberto || (sacolaAberta && qtd > 0);
  useEffect(() => {
    if (!camadaAberta) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { setAberto(null); setSacolaAberta(false); } };
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = antes; window.removeEventListener("keydown", tecla); };
  }, [camadaAberta]);

  if (!itens.length) return null;
  const det = itens.find((i) => i.id === aberto);
  const mensagem = mensagemDoPedido(linhas);
  const linkPedido = linkWhats(telefone, mensagem);
  const todosComPreco = linhas.every((l) => l.preco !== null);

  return (
    <section id="cardapio" className="px-4 cq-md:px-5 py-9 cq-md:py-14 bg-[#FBF6EE] text-[#3B2416] scroll-mt-[52px]">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display font-extrabold text-[1.75rem] cq-md:text-[2.2rem] tracking-[-0.015em]">{c.titulo}</h2>
          <span className="text-[13px] opacity-70">{mostrados.length} {mostrados.length === 1 ? "item" : "itens"}</span>
        </div>
        {cats.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mt-3.5 pb-1 -mx-1 px-1" role="group" aria-label="Categorias">
            {["", ...cats].map((nome) => (
              <button key={nome || "todos"} type="button" onClick={() => setCat(nome)} aria-pressed={cat === nome}
                className="shrink-0 h-10 px-4 rounded-full border-[1.5px] text-[14px] font-bold transition"
                style={cat === nome ? { backgroundColor: "#3B2416", color: "#FFF8EF", borderColor: "#3B2416" } : { backgroundColor: "#fff", borderColor: "#EADFCF" }}>
                {nome || "Todos"}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 cq-md:grid-cols-3 cq-lg:grid-cols-4 gap-3 mt-4">
          {mostrados.map((i) => (
            <article key={i.id} className="relative bg-white rounded-2xl overflow-hidden flex flex-col shadow-[0_1px_0_#EADFCF]">
              <button type="button" onClick={() => !emPrevia && setAberto(i.id)} aria-label={`Ver ${i.nome}`} className="block text-left">
                {i.foto
                  ? <img src={i.foto} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" />
                  : <span aria-hidden className="w-full aspect-[4/3] grid place-items-center text-3xl font-display font-extrabold"
                      style={{ backgroundColor: `${marca.cor}22`, color: marca.cor }}>{i.nome.slice(0, 1).toUpperCase()}</span>}
              </button>
              {(sacola[i.id] ?? 0) > 0 && (
                <span className="absolute top-2 right-2 min-w-[26px] h-[26px] px-1.5 rounded-full bg-[#3B2416] text-white text-[13px] font-extrabold grid place-items-center">
                  {sacola[i.id]}
                </span>
              )}
              <div className="p-2.5 cq-sm:p-3 flex flex-col gap-1 flex-1">
                <h3 className="text-[14.5px] font-extrabold leading-tight">{i.nome}</h3>
                {i.desc && <p className="text-[12px] leading-snug opacity-70">{i.desc}</p>}
                <div className="flex items-center justify-between mt-auto pt-2 gap-2">
                  <span className="font-display font-bold text-[16px]">{i.preco !== null ? real(i.preco) : ""}</span>
                  {vendePeloWhats && (
                    <button type="button" onClick={() => mudar(i.id, 1)} aria-label={`Pôr ${i.nome} na sacola`}
                      className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ backgroundColor: marca.cor, color: marca.corTexto }}>
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Foto grande do item, com X */}
      {det && !emPrevia && createPortal(
        <div className="fixed inset-0 z-[60] bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setAberto(null)}>
          <div role="dialog" aria-modal="true" aria-label={det.nome} onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[440px] max-h-[92dvh] overflow-y-auto bg-[#FBF6EE] text-[#3B2416] rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="relative">
              {det.foto && <img src={det.foto} alt={det.nome} className="w-full aspect-[4/3] object-cover" />}
              <button type="button" onClick={() => setAberto(null)} aria-label="Fechar" autoFocus
                className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white/95 grid place-items-center shadow">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-2 pb-[max(20px,env(safe-area-inset-bottom))]">
              <h3 className="font-display font-extrabold text-[1.6rem] leading-tight pr-8">{det.nome}</h3>
              {(det.detalhe || det.desc) && <p className="text-[15px] leading-relaxed opacity-80 whitespace-pre-line">{det.detalhe || det.desc}</p>}
              {det.preco !== null && <span className="font-display font-bold text-[22px] mt-1">{real(det.preco)}</span>}
              {vendePeloWhats ? (
                <div className="grid grid-cols-[auto_1fr] gap-2.5 mt-2">
                  <div className="flex items-center rounded-xl border-[1.5px] border-[#EADFCF] bg-white">
                    <button type="button" onClick={() => mudar(det.id, -1)} aria-label="Menos um" className="w-11 h-12 grid place-items-center"><Minus className="h-4 w-4" aria-hidden /></button>
                    <span className="min-w-[22px] text-center font-extrabold" aria-live="polite">{sacola[det.id] ?? 0}</span>
                    <button type="button" onClick={() => mudar(det.id, 1)} aria-label="Mais um" className="w-11 h-12 grid place-items-center"><Plus className="h-4 w-4" aria-hidden /></button>
                  </div>
                  <button type="button" onClick={() => { if (!sacola[det.id]) mudar(det.id, 1); setAberto(null); }}
                    className="rounded-xl font-display font-bold text-[15px]" style={{ backgroundColor: marca.cor, color: marca.corTexto }}>
                    {sacola[det.id] ? "Pronto" : "Pôr na sacola"}
                  </button>
                </div>
              ) : (
                <p className="text-[13px] opacity-70 mt-1">Disponível na loja.</p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Barra da sacola e a sacola aberta */}
      {vendePeloWhats && qtd > 0 && !emPrevia && createPortal(
        sacolaAberta ? (
          <div className="fixed inset-0 z-[60] bg-black/55 flex items-end justify-center" onClick={() => setSacolaAberta(false)}>
            <div role="dialog" aria-modal="true" aria-label="Seu pedido" onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[520px] max-h-[88dvh] overflow-y-auto bg-[#FBF6EE] text-[#3B2416] rounded-t-3xl p-5 pb-[max(20px,env(safe-area-inset-bottom))] flex flex-col gap-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-extrabold text-[1.4rem]">Seu pedido</h2>
                <button type="button" onClick={() => setSacolaAberta(false)} aria-label="Fechar" className="w-11 h-11 rounded-full bg-white grid place-items-center"><X className="h-5 w-5" aria-hidden /></button>
              </div>
              {linhas.map((l) => {
                const item = itens.find((i) => i.id === l.id);
                return (
                  <div key={l.id} className="grid grid-cols-[48px_1fr_auto] gap-2.5 items-center">
                    {item?.foto ? <img src={item.foto} alt="" className="w-12 h-12 rounded-xl object-cover" /> : <span className="w-12 h-12 rounded-xl" style={{ backgroundColor: `${marca.cor}22` }} />}
                    <div className="min-w-0">
                      <p className="font-extrabold text-[14.5px] truncate">{l.nome}</p>
                      {l.preco !== null && <p className="text-[13px] opacity-70">{l.qtd} × {real(l.preco)}</p>}
                    </div>
                    <div className="flex items-center rounded-xl border-[1.5px] border-[#EADFCF] bg-white">
                      <button type="button" onClick={() => mudar(l.id, -1)} aria-label={`Menos um ${l.nome}`} className="w-9 h-10 grid place-items-center"><Minus className="h-3.5 w-3.5" aria-hidden /></button>
                      <span className="min-w-[18px] text-center font-extrabold text-[14px]">{l.qtd}</span>
                      <button type="button" onClick={() => mudar(l.id, 1)} aria-label={`Mais um ${l.nome}`} className="w-9 h-10 grid place-items-center"><Plus className="h-3.5 w-3.5" aria-hidden /></button>
                    </div>
                  </div>
                );
              })}
              {todosComPreco && (
                <div className="flex justify-between border-t border-[#EADFCF] pt-3 font-extrabold text-[16px]"><span>Total</span><span>{real(totalDoPedido(linhas))}</span></div>
              )}
              <div className="rounded-2xl bg-[#E7F5EC] text-[#1E4B2E] px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line">
                <b>Vai assim no WhatsApp:</b>{"\n"}{mensagem}
              </div>
              <a href={linkPedido} target="_blank" rel="noopener noreferrer"
                onClick={() => { aoPedir?.(linhas); }}
                className="h-14 rounded-2xl grid place-items-center font-display font-bold text-[15.5px] text-white bg-[#1F8A4C]">
                Enviar pedido pelo WhatsApp
              </a>
              <p className="text-[12px] opacity-70 text-center">Pagamento e entrega você combina direto com a loja.</p>
            </div>
          </div>
        ) : (
          <div className="fixed left-0 right-0 bottom-0 z-[55] px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.14) 100%)" }}>
            <button type="button" onClick={() => setSacolaAberta(true)}
              className="mx-auto max-w-[520px] w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-display font-bold text-[15px] shadow-lg bg-[#3B2416] text-white">
              <ShoppingBag className="h-5 w-5" aria-hidden />
              Ver pedido · {qtd} {qtd === 1 ? "item" : "itens"}{todosComPreco ? ` · ${real(totalDoPedido(linhas))}` : ""}
            </button>
          </div>
        ),
        document.body,
      )}
    </section>
  );
}

/* ── DESTAQUE DA SEMANA ── */
export function SecaoDestaque({ d, telefonePadrao, aoClicar }: { d: DadosBloco; telefonePadrao?: string; aoClicar?: () => void }) {
  const titulo = txt(d, "titulo").trim();
  if (!titulo) return null;
  const img = txt(d, "imagem");
  const texto = txt(d, "botao").trim();
  const href = txt(d, "destino", "whatsapp") === "link"
    ? linkSeguro(txt(d, "url"))
    : linkWhats(txt(d, "telefone") || telefonePadrao || "", txt(d, "mensagem") || `Olá! Quero reservar: ${titulo}`);
  return (
    <section className="px-4 cq-md:px-5 py-4 bg-[#FBF6EE]">
      <div className="mx-auto max-w-5xl rounded-3xl overflow-hidden bg-[#3B2416] text-[#FFF8EF] grid grid-cols-[1fr_120px] cq-sm:grid-cols-[1fr_200px]">
        <div className="p-5 flex flex-col gap-2">
          {txt(d, "etiqueta") && <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#F2A66E]">{txt(d, "etiqueta")}</span>}
          <h3 className="font-display font-extrabold text-[1.35rem] leading-tight">{titulo}</h3>
          {txt(d, "texto") && <p className="text-[13.5px] opacity-80">{txt(d, "texto")}</p>}
          {texto && href && (
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={aoClicar}
              className="self-start mt-1 font-bold text-[14px] text-[#F2A66E] underline underline-offset-4">{texto}</a>
          )}
        </div>
        {img ? <img src={img} alt="" loading="lazy" className="w-full h-full min-h-[170px] object-cover" /> : <span aria-hidden className="bg-white/5" />}
      </div>
    </section>
  );
}

/* ── HORÁRIOS ── */
export function SecaoHorarios({ d }: { d: DadosBloco }) {
  const h = lerHorarios(d);
  const [hoje, setHoje] = useState<number | null>(null);
  // O dia é calculado no navegador, depois de montar: a mesma página servida
  // em cache não fica presa no dia em que foi gerada.
  useEffect(() => { setHoje(agoraEmBrasilia().dia); }, []);
  if (!h.dias.some((x) => x.aberto)) return null;
  // Segunda primeiro: é como as pessoas leem uma semana de loja.
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  return (
    <section id="horarios" className="px-4 cq-md:px-5 py-9 bg-[#FBF6EE] text-[#3B2416] scroll-mt-[52px]">
      <div className="mx-auto max-w-[620px]">
        <h2 className="font-display font-extrabold text-[1.6rem]">{h.titulo}</h2>
        <div className="bg-white rounded-2xl px-4 py-1.5 mt-3">
          {ordem.map((i) => (
            <div key={i} className="flex justify-between py-2.5 border-b border-[#F1E8DB] last:border-0 text-[15px]"
              style={i === hoje ? { fontWeight: 800, color: "#A8481A" } : undefined}>
              <span>{DIAS[i]}{i === hoje ? " (hoje)" : ""}</span><span>{faixaDoDia(h.dias[i])}</span>
            </div>
          ))}
        </div>
        {h.observacao && <p className="text-[13px] opacity-70 mt-2">{h.observacao}</p>}
      </div>
    </section>
  );
}

/** Selo da capa: só existe se a página tiver o bloco de horários. */
export function useStatusDaLoja(blocoHorarios: DadosBloco | undefined) {
  const [status, setStatus] = useState<{ aberto: boolean; texto: string } | null>(null);
  useEffect(() => {
    if (!blocoHorarios) { setStatus(null); return; }
    const h = lerHorarios(blocoHorarios);
    const calc = () => setStatus(statusAgora(h, agoraEmBrasilia()));
    calc();
    const t = window.setInterval(calc, 60_000);
    return () => window.clearInterval(t);
  }, [blocoHorarios]);
  return status;
}
