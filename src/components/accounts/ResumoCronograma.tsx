import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ClipboardCopy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Cronograma, CronogramaData, CronogramaItem } from "@/hooks/useCronograma";

/* ═══════════════════════════════════════════════════════════════════════════
   RESUMO DO CRONOGRAMA (Gabriela, 16/10/2026: "ver a data que gerei, a data que
   o cliente aprovou e o que ainda está pendente"). Mockup aprovado pelo Walter
   em 16/10 (CRIA/3-produto/mockups/mockup-cronograma-resumo.html).

   De onde vem cada data:
   - gerado: cronogramas.created_at
   - enviado: cronogramas.enviado_em / primeiro_envio_em / envios (trigger
     cronograma_marca_envio, carimba com a hora do servidor)
   - cliente abriu: cronogramas.visto_em / ultimo_visto_em / visualizacoes
     (get_cronograma_by_token conta 1 visita a cada 30 min e ignora a agência)
   - cada resposta: cronograma_items.respondido_em (set_cronograma_item_by_token)
   Tudo isso passou a ser gravado em 16/10/2026: o que é anterior não tem data
   e o resumo diz isso em vez de inventar.
   ═══════════════════════════════════════════════════════════════════════════ */

const TZ = "America/Sao_Paulo";
const dia = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ }) : null;
const hora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(":", "h") : null;
const diaHora = (iso?: string | null) => (iso ? `${dia(iso)} às ${hora(iso)}` : null);
const diasDesde = (iso?: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);
/** "2026-10-22" vira "22/10" sem passar por Date (evita voltar um dia no fuso). */
const dataItem = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "sem data");

const MARCA = /^(capa|slide\s*\d*|cena\s*\d*|gancho|hook|cta|legenda|copy|título|titulo)\s*[:.-]?\s*$/i;
function nomeDoItem(it: CronogramaItem): string {
  if (it.title?.trim()) return it.title.trim();
  const linha = (it.copy ?? "").split("\n").map((l) => l.trim()).find((l) => l && !MARCA.test(l) && !/^[-–—.]+$/.test(l));
  return linha ? (linha.length > 60 ? linha.slice(0, 57) + "…" : linha) : "Sem título";
}

type Linha = { n: number; it: CronogramaItem; nome: string };

// types.ts é travado: tabela nova passa por aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

/* HISTÓRICO DE VISITAS (Walter, 18/10/2026: "quando o cliente abre mais de 1x,
   nao fica o historico?"). Uma linha por visita contada (migration
   20261018000002). Se a tabela ainda não existir, o resumo segue com o que tinha. */
function useVisitas(cronogramaId: string) {
  return useQuery<string[]>({
    queryKey: ["cronograma-visitas", cronogramaId],
    queryFn: async () => {
      const { data, error } = await sbFrom("cronograma_visitas").select("visto_em").eq("cronograma_id", cronogramaId).order("visto_em");
      if (error) return [];
      return ((data ?? []) as { visto_em: string }[]).map((v) => v.visto_em);
    },
  });
}

/** Comentário longo do cliente: no resumo vai só o começo, o texto inteiro mora no card. */
const LIMITE_COMENTARIO = 220;
const resumir = (t: string) => (t.length > LIMITE_COMENTARIO ? t.slice(0, LIMITE_COMENTARIO).replace(/\s+\S*$/, "") + "…" : t);

type Evento = { em: string; txt: string; tom: "neutro" | "azul" | "verde" | "ambar" };
const diaBR = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

export function ResumoCronograma({ c, items, datas, link }: {
  c: Cronograma; items: CronogramaItem[]; datas: CronogramaData[]; link: string;
}) {
  const [aberto, setAberto] = useState(true);
  const [todosAprovados, setTodosAprovados] = useState(false);
  const [historicoTodo, setHistoricoTodo] = useState(false);
  const { data: visitas = [] } = useVisitas(c.id);
  if (items.length === 0) return null;

  const linhas: Linha[] = items.map((it, i) => ({ n: i + 1, it, nome: nomeDoItem(it) }));
  const aprovados = linhas.filter((l) => l.it.approval_status === "aprovado");
  const ajustes = linhas.filter((l) => l.it.approval_status === "ajuste" || l.it.approval_status === "recusado");
  const pendentes = linhas.filter((l) => l.it.approval_status === "pendente");
  const total = linhas.length;
  const pct = (n: number) => `${(n / total) * 100}%`;
  const respostas = items.map((it) => it.respondido_em).filter(Boolean) as string[];
  const ultimaResposta = respostas.sort().at(-1) ?? null;
  const semDataDeResposta = items.some((it) => it.approval_status !== "pendente" && !it.respondido_em);
  const marcadas = datas.filter((d) => d.selected);
  const nuncaEnviado = c.status === "rascunho" && !c.enviado_em;

  /* LINHA DO TEMPO: o cliente aprova X num dia e o resto em outro. Junta
     geração, envios, cada visita e as respostas agrupadas por dia. */
  const eventos: Evento[] = [];
  if (c.created_at) eventos.push({ em: c.created_at, txt: "Cronograma gerado", tom: "neutro" });
  const primeiroEnvio = c.primeiro_envio_em ?? c.enviado_em;
  if (primeiroEnvio) eventos.push({ em: primeiroEnvio, txt: "Enviado pro cliente", tom: "azul" });
  if (c.enviado_em && primeiroEnvio && c.enviado_em !== primeiroEnvio) eventos.push({ em: c.enviado_em, txt: "Reenviado pro cliente", tom: "azul" });
  const listaVisitas = visitas.length > 0 ? visitas : [c.visto_em, c.ultimo_visto_em !== c.visto_em ? c.ultimo_visto_em : null].filter(Boolean) as string[];
  for (const v of listaVisitas) eventos.push({ em: v, txt: "Cliente abriu o link", tom: "neutro" });
  const porDia = new Map<string, { em: string; aprov: Linha[]; ajuste: Linha[] }>();
  for (const l of linhas) {
    const r = l.it.respondido_em;
    if (!r || l.it.approval_status === "pendente") continue;
    const k = diaBR(r);
    const g = porDia.get(k) ?? { em: r, aprov: [], ajuste: [] };
    if (r < g.em) g.em = r;
    (l.it.approval_status === "aprovado" ? g.aprov : g.ajuste).push(l);
    porDia.set(k, g);
  }
  const nums = (ls: Linha[]) => ls.map((l) => `#${l.n}`).join(", ");
  for (const g of porDia.values()) {
    if (g.aprov.length) eventos.push({ em: g.em, txt: `Aprovou ${g.aprov.length} ${g.aprov.length === 1 ? "item" : "itens"} (${nums(g.aprov)})`, tom: "verde" });
    if (g.ajuste.length) eventos.push({ em: g.em, txt: `Pediu ajuste em ${nums(g.ajuste)}`, tom: "ambar" });
  }
  eventos.sort((a, b) => a.em.localeCompare(b.em));
  const vezesAbriu = Math.max(c.visualizacoes ?? 0, listaVisitas.length);
  const eventosVisiveis = historicoTodo || eventos.length <= 6 ? eventos : eventos.slice(-6);

  const enviadoTxt = c.enviado_em
    ? `às ${hora(c.primeiro_envio_em ?? c.enviado_em)}${(c.envios ?? 0) > 1 ? ` · reenviado ${dia(c.enviado_em)}` : ""}`
    : nuncaEnviado ? "ainda não enviado" : "enviado antes do registro de datas";
  const situacao = pendentes.length === 0 && ajustes.length === 0
    ? { t: "Tudo aprovado", cor: "text-green-700" }
    : pendentes.length > 0 ? { t: `Faltam ${pendentes.length}`, cor: "text-amber-700" } : { t: `${ajustes.length} com ajuste`, cor: "text-amber-700" };

  const resumoTexto = () => {
    const nomes = (ls: Linha[]) => ls.map((l) => l.nome).join(", ");
    const cab = [`*${c.title}${c.client_label ? ` · ${c.client_label}` : ""}*`];
    const env = [c.enviado_em ? `Enviado em ${dia(c.primeiro_envio_em ?? c.enviado_em)}` : null, c.visto_em ? `aberto em ${dia(c.visto_em)}` : null].filter(Boolean).join(" · ");
    if (env) cab.push(env);
    const corpo = [
      `Aprovados: ${aprovados.length}`,
      ajustes.length ? `Com ajuste: ${ajustes.length} (${nomes(ajustes)})` : null,
      pendentes.length ? `Esperando você: ${pendentes.length} (${nomes(pendentes)})` : null,
    ].filter(Boolean);
    return [...cab, "", ...corpo, "", `Link: ${link}`].join("\n");
  };

  const copiar = () => {
    navigator.clipboard?.writeText(resumoTexto())
      .then(() => toast.success("Resumo copiado. É só colar no WhatsApp."))
      .catch(() => toast.error("Não consegui copiar. Tente de novo."));
  };

  /* PDF: abre o resumo numa janela limpa e chama a impressão do navegador
     ("Salvar como PDF"). Sem biblioteca nova e sem subir nada pra lugar nenhum. */
  const baixarPdf = () => {
    const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));
    const origem = window.location.origin;
    const linhaItem = (l: Linha, extra: string) => `<tr><td class="n">#${l.n}</td><td><b>${esc(l.nome)}</b><span class="tp">${esc(l.it.type ?? "Post")} · ${dataItem(l.it.date)}</span>${l.it.client_comment ? `<div class="com">"${esc(resumir(l.it.client_comment))}"${l.it.client_comment.length > LIMITE_COMENTARIO ? `<i>O comentário inteiro está no card do post.</i>` : ""}</div>` : ""}</td><td class="r">${extra}</td></tr>`;
    const bloco = (t: string, cor: string, ls: Linha[], extra: (l: Linha) => string) =>
      ls.length ? `<h2><span class="dot" style="background:${cor}"></span>${t} <small>${ls.length}</small></h2><table>${ls.map((l) => linhaItem(l, extra(l))).join("")}</table>` : "";
    const corTom = { neutro: "#b9b3a6", azul: "#3b82f6", verde: "#16a34a", ambar: "#f59e0b" } as const;
    const tempo = eventos.length > 1
      ? `<h2>Linha do tempo</h2><ul class="tl">${eventos.map((e) => `<li><span class="dot" style="background:${corTom[e.tom]}"></span><span class="q">${dia(e.em)} · ${hora(e.em)}</span>${esc(e.txt)}</li>`).join("")}</ul>`
      : "";
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Resumo · ${esc(c.title)}${c.client_label ? ` · ${esc(c.client_label)}` : ""}</title>
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#1b1a17;font-size:12px}
.pg{padding:12mm 14mm 14mm}
.cab{display:flex;align-items:center;gap:12px;background:#F5F3E7;border-radius:14px;padding:12px 16px;margin-bottom:16px}
.cab img{height:26px}.cab .sp{flex:1}.cab .dir{text-align:right;font-size:10.5px;color:#77736a}.cab .dir b{display:block;color:#1b1a17;font-size:12px}
h1{font-size:22px;margin:0}.sub{color:#77736a;margin:2px 0 14px}
.ev{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.ev div{border:1px solid #e4dfd0;border-top:4px solid #EA4918;border-radius:10px;padding:8px 10px}
.ev small{display:block;font-size:9.5px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#77736a}
.ev b{display:block;font-size:15px;margin-top:2px}.ev span{font-size:10.5px;color:#77736a}
.bar{display:flex;height:8px;border-radius:99px;overflow:hidden;background:#eee9da;margin:6px 0 4px}
.leg{font-size:10.5px;color:#55514a;display:flex;gap:14px}
h2{font-size:13px;margin:16px 0 6px;display:flex;align-items:center;gap:6px}h2 small{font-size:10.5px;color:#77736a;font-weight:normal}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none}
table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-top:1px dashed #e4dfd0;vertical-align:top}
td.n{width:30px;color:#77736a;font-weight:bold}td.r{width:150px;text-align:right;color:#55514a;font-size:10.5px}
.tp{display:block;color:#77736a;font-size:10.5px;margin-top:1px}
.com{margin-top:4px;background:#FFF5DE;border-left:3px solid #f59e0b;border-radius:4px;padding:4px 7px;color:#7a4b00;font-size:11px}
.com i{display:block;font-size:10px;margin-top:2px;color:#9a6a10}
.tl{list-style:none;margin:0;padding:0}.tl li{display:flex;align-items:center;gap:8px;padding:3px 0}.tl .q{width:90px;color:#77736a}
.rod{margin-top:22px;padding-top:8px;border-top:1px solid #e4dfd0;display:flex;align-items:center;gap:6px;color:#77736a;font-size:10px}
.rod img{height:11px}
</style></head><body><div class="pg">
<div class="cab"><img src="${origem}/logo-cria.png" alt="Cria"><span class="sp"></span><div class="dir"><b>Resumo do cronograma</b>gerado em ${diaHora(new Date().toISOString())}</div></div>
<h1>${esc(c.title)}</h1><p class="sub">${esc(c.client_label ?? "")}${c.client_handle ? ` · @${esc(c.client_handle)}` : ""}</p>
<div class="ev">
<div><small>Gerado</small><b>${dia(c.created_at) ?? "-"}</b><span>${hora(c.created_at) ? `às ${hora(c.created_at)}` : ""}</span></div>
<div><small>Enviado</small><b>${dia(primeiroEnvio) ?? "-"}</b><span>${(c.envios ?? 0) > 1 && c.enviado_em ? `reenviado ${dia(c.enviado_em)}` : primeiroEnvio ? `às ${hora(primeiroEnvio)}` : ""}</span></div>
<div><small>Cliente abriu</small><b>${dia(c.visto_em) ?? "-"}</b><span>${vezesAbriu > 1 ? `${vezesAbriu} vezes · última ${dia(c.ultimo_visto_em ?? listaVisitas[listaVisitas.length - 1])}` : c.visto_em ? `às ${hora(c.visto_em)}` : ""}</span></div>
<div><small>Situação</small><b>${aprovados.length} de ${total} aprovados</b><span>${esc(situacao.t)}</span></div>
</div>
<div class="bar"><i style="display:block;width:${pct(aprovados.length)};background:#16a34a"></i><i style="display:block;width:${pct(ajustes.length)};background:#f59e0b"></i></div>
<div class="leg"><span>${aprovados.length} aprovados</span><span>${ajustes.length} com ajuste</span><span>${pendentes.length} pendentes</span></div>
${tempo}
${bloco("Pediu ajuste", "#f59e0b", ajustes, (l) => (l.it.respondido_em ? `pediu em ${dia(l.it.respondido_em)}` : ""))}
${bloco("Esperando o cliente", "#b9b3a6", pendentes, () => "")}
${bloco("Aprovados", "#16a34a", aprovados, (l) => (l.it.respondido_em ? `aprovado em ${diaHora(l.it.respondido_em)}` : "aprovado"))}
${marcadas.length ? `<h2>Datas comemorativas marcadas pelo cliente</h2><p>${marcadas.map((d) => esc(d.label) + (d.day_label ? ` (${esc(d.day_label)})` : "")).join(" · ")}</p>` : ""}
<div class="rod"><img src="${origem}/logo-cria.png" alt=""> Feito com o Cria Social Club · criasocialclub.com.br</div>
</div><script>window.onload=function(){setTimeout(function(){window.print()},150)}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("O navegador bloqueou a janela. Libere pop-up pro Cria e tente de novo."); return; }
    w.document.write(html);
    w.document.close();
  };

  const Item = ({ l, direita, detalhe }: { l: Linha; direita?: string | null; detalhe?: string | null }) => (
    <div className="flex items-start gap-2.5 border-t border-dashed border-border py-2 first:border-t-0">
      <span className="mt-0.5 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{l.it.type ?? "Post"}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-foreground">#{l.n} {l.nome}</p>
        <p className="text-[11.5px] text-muted-foreground">{detalhe ?? dataItem(l.it.date)}</p>
        {l.it.client_comment && (
          <p className="mt-1 rounded-md border-l-[3px] border-amber-500 bg-amber-50 px-2 py-1 text-[12px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            "{resumir(l.it.client_comment)}"
            {l.it.client_comment.length > LIMITE_COMENTARIO && <span className="block pt-0.5 text-[11px] font-semibold text-amber-800/80">O comentário inteiro está no card do post.</span>}
          </p>
        )}
      </div>
      {direita && <span className="shrink-0 text-[11.5px] text-muted-foreground">{direita}</span>}
    </div>
  );

  const Evento = ({ rot, val, sub, cor }: { rot: string; val: string; sub: string; cor?: string }) => (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{rot}</p>
      <p className={cn("font-display text-[17px] font-bold leading-tight", cor)}>{val}</p>
      <p className="text-[11.5px] text-muted-foreground">{sub}</p>
    </div>
  );

  const enviadoHa = diasDesde(c.enviado_em);
  const aprovadosVisiveis = todosAprovados ? aprovados : aprovados.slice(0, 3);

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex items-center gap-1.5 font-display text-[15px] font-bold text-foreground">
          <ChevronDown className={cn("h-4 w-4 transition-transform", !aberto && "-rotate-90")} /> Resumo do cronograma
        </button>
        <span className="text-[12px] text-muted-foreground">{aprovados.length} de {total} aprovados</span>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full text-[12px]" onClick={copiar}><ClipboardCopy className="h-3.5 w-3.5" /> Copiar pro WhatsApp</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full text-[12px]" onClick={baixarPdf}><FileDown className="h-3.5 w-3.5" /> Baixar PDF</Button>
        </div>
      </div>

      {aberto && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Evento rot="Gerado" val={dia(c.created_at) ?? "-"} sub={`às ${hora(c.created_at)}`} />
            <Evento rot="Enviado pro cliente" val={dia(c.primeiro_envio_em ?? c.enviado_em) ?? "-"} sub={enviadoTxt} />
            <Evento rot="Cliente abriu" val={dia(c.visto_em) ?? "-"}
              sub={c.visto_em ? ((c.visualizacoes ?? 0) > 1 ? `${c.visualizacoes} vezes · última ${dia(c.ultimo_visto_em ?? c.visto_em)}` : `às ${hora(c.visto_em)}`) : nuncaEnviado ? "-" : "ainda não abriu (ou abriu antes do registro)"} />
            <Evento rot="Situação" val={situacao.t} cor={situacao.cor} sub={ultimaResposta ? `última resposta em ${dia(ultimaResposta)}` : "sem resposta registrada"} />
          </div>

          <div className="mt-3">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              <i className="block bg-green-600" style={{ width: pct(aprovados.length) }} />
              <i className="block bg-amber-500" style={{ width: pct(ajustes.length) }} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-green-600" />{aprovados.length} aprovados</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />{ajustes.length} com ajuste</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />{pendentes.length} pendentes</span>
              <span className="ml-auto font-normal text-muted-foreground">{total} itens</span>
            </div>
          </div>

          {eventos.length > 1 && (
            <div className="mt-3 rounded-xl border border-border bg-background px-3 py-2.5">
              <p className="mb-1.5 font-display text-[13.5px] font-bold">Linha do tempo</p>
              <ol className="space-y-1.5">
                {eventosVisiveis.map((e, i) => (
                  <li key={`${e.em}-${i}`} className="flex items-start gap-2.5 text-[12.5px]">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      e.tom === "verde" ? "bg-green-600" : e.tom === "ambar" ? "bg-amber-500" : e.tom === "azul" ? "bg-blue-500" : "bg-muted-foreground/40")} />
                    <span className="w-[92px] shrink-0 tabular-nums text-muted-foreground">{dia(e.em)} · {hora(e.em)}</span>
                    <span className="min-w-0 text-foreground">{e.txt}</span>
                  </li>
                ))}
              </ol>
              {eventos.length > 6 && (
                <button type="button" onClick={() => setHistoricoTodo((v) => !v)} className="pt-1.5 text-[12px] font-semibold text-primary">
                  {historicoTodo ? "Mostrar só os últimos" : `Ver o histórico todo (${eventos.length})`}
                </button>
              )}
            </div>
          )}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="mb-1 font-display text-[13.5px] font-bold">Esperando o cliente <span className="ml-1 rounded-full bg-muted px-2 text-[11px]">{pendentes.length}</span></p>
              {pendentes.length === 0 && <p className="py-2 text-[12px] text-muted-foreground">Nada pendente.</p>}
              {pendentes.map((l) => <Item key={l.it.id} l={l} direita={enviadoHa != null ? (enviadoHa === 0 ? "enviado hoje" : `enviado há ${enviadoHa} ${enviadoHa === 1 ? "dia" : "dias"}`) : null} />)}
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="mb-1 font-display text-[13.5px] font-bold">Pediu ajuste <span className="ml-1 rounded-full bg-amber-100 px-2 text-[11px] text-amber-800">{ajustes.length}</span></p>
              {ajustes.length === 0 && <p className="py-2 text-[12px] text-muted-foreground">Nenhum ajuste pedido.</p>}
              {ajustes.map((l) => <Item key={l.it.id} l={l} detalhe={`${l.it.approval_status === "recusado" ? "recusou" : "pediu ajuste"}${l.it.respondido_em ? ` em ${dia(l.it.respondido_em)}` : ""}`} />)}
              <p className="mb-1 mt-3 font-display text-[13.5px] font-bold">Aprovados <span className="ml-1 rounded-full bg-green-100 px-2 text-[11px] text-green-800">{aprovados.length}</span></p>
              {aprovados.length === 0 && <p className="py-2 text-[12px] text-muted-foreground">Nenhum aprovado ainda.</p>}
              {aprovadosVisiveis.map((l) => <Item key={l.it.id} l={l} detalhe={l.it.respondido_em ? `aprovado em ${diaHora(l.it.respondido_em)}` : "aprovado (sem data registrada)"} direita={l.it.converted_post_id ? "✓ no Cria Post" : null} />)}
              {aprovados.length > 3 && (
                <button type="button" onClick={() => setTodosAprovados((v) => !v)} className="py-1.5 text-[12px] font-semibold text-primary">
                  {todosAprovados ? "Mostrar menos" : `+ ${aprovados.length - 3} aprovados (ver todos)`}
                </button>
              )}
            </div>
          </div>

          {marcadas.length > 0 && (
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              Datas comemorativas: o cliente marcou {marcadas.map((d, i) => (
                <span key={d.id}>{i > 0 ? (i === marcadas.length - 1 ? " e " : ", ") : ""}<b className="text-foreground">{d.label}{d.day_label ? ` (${d.day_label})` : ""}</b></span>
              ))}.
            </p>
          )}
          {semDataDeResposta && (
            <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-[11.5px] text-muted-foreground">
              Respostas dadas antes de 16/10/2026 não têm data (o sistema ainda não guardava). Elas aparecem como aprovadas ou pendentes, e as datas passam a aparecer nas próximas respostas.
            </p>
          )}
        </>
      )}
    </div>
  );
}
