import { useState } from "react";
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

export function ResumoCronograma({ c, items, datas, link }: {
  c: Cronograma; items: CronogramaItem[]; datas: CronogramaData[]; link: string;
}) {
  const [aberto, setAberto] = useState(true);
  const [todosAprovados, setTodosAprovados] = useState(false);
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
    const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));
    const li = (l: Linha, extra: string) => `<li><b>#${l.n} ${esc(l.nome)}</b> <span>${esc(l.it.type ?? "")} · ${dataItem(l.it.date)}${extra}</span>${l.it.client_comment ? `<em>"${esc(l.it.client_comment)}"</em>` : ""}</li>`;
    const bloco = (t: string, ls: Linha[], extra: (l: Linha) => string) =>
      ls.length ? `<h2>${t} (${ls.length})</h2><ul>${ls.map((l) => li(l, extra(l))).join("")}</ul>` : "";
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Resumo · ${esc(c.title)}</title>
<style>body{font-family:Arial,sans-serif;color:#1b1a17;margin:32px;font-size:13px}h1{font-size:20px;margin:0}small{color:#77736a}
.ev{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.ev div{border:1px solid #ddd;border-radius:8px;padding:8px}
.ev b{display:block;font-size:15px}h2{font-size:14px;margin:18px 0 6px}ul{margin:0;padding-left:18px}li{margin:4px 0}li span{color:#77736a}
li em{display:block;color:#8a5a00}</style></head><body>
<h1>${esc(c.title)}</h1><small>${esc(c.client_label ?? "")}${c.client_handle ? ` · @${esc(c.client_handle)}` : ""}</small>
<div class="ev"><div><small>Gerado</small><b>${diaHora(c.created_at) ?? "-"}</b></div>
<div><small>Enviado</small><b>${diaHora(c.primeiro_envio_em ?? c.enviado_em) ?? "-"}</b></div>
<div><small>Cliente abriu</small><b>${diaHora(c.visto_em) ?? "-"}</b></div>
<div><small>Situação</small><b>${aprovados.length} de ${total} aprovados</b></div></div>
${bloco("Esperando o cliente", pendentes, () => "")}
${bloco("Pediu ajuste", ajustes, (l) => (l.it.respondido_em ? ` · em ${dia(l.it.respondido_em)}` : ""))}
${bloco("Aprovados", aprovados, (l) => (l.it.respondido_em ? ` · aprovado em ${diaHora(l.it.respondido_em)}` : ""))}
${marcadas.length ? `<h2>Datas comemorativas marcadas pelo cliente</h2><p>${marcadas.map((d) => esc(d.label) + (d.day_label ? ` (${esc(d.day_label)})` : "")).join(", ")}</p>` : ""}
<p style="margin-top:24px"><small>Gerado pelo Cria em ${diaHora(new Date().toISOString())}</small></p>
<script>window.onload=function(){window.print()}</script></body></html>`;
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
        {l.it.client_comment && <p className="mt-1 rounded-md border-l-[3px] border-amber-500 bg-amber-50 px-2 py-1 text-[12px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">"{l.it.client_comment}"</p>}
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
              sub={c.visto_em ? `às ${hora(c.visto_em)}${(c.visualizacoes ?? 0) > 1 ? ` · ${c.visualizacoes} vezes` : ""}` : nuncaEnviado ? "-" : "ainda não abriu (ou abriu antes do registro)"} />
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
