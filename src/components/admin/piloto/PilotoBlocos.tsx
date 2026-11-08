/* Blocos do Piloto: visitas por hora, funil clicável, anúncios, IA e erros. */
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, ExternalLink, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  ORIGENS, USD_BRL, baixarCsv, brl, diasDesde, iniciais, num, origemDoCadastro,
  type Cadastro, type ErroGrupo, type Origem, type Resumo,
} from "./usePiloto";
import { BotaoAcao, Cartao, Etiqueta, Pilula, TINTA, TituloCartao } from "./pecas";

// ── Visitas por hora (ou por dia, quando o período passa de 2 dias) ─────────
export function GraficoVisitas({ atual, anterior, origens }: { atual: Resumo; anterior?: Resumo; origens: Origem[] }) {
  const porDia = useMemo(() => {
    const d = new Date(atual.periodo.ate).getTime() - new Date(atual.periodo.desde).getTime();
    return d > 2 * 86400000;
  }, [atual]);

  const dados = useMemo(() => {
    const agrupar = (r?: Resumo) => {
      const m = new Map<string, Record<Origem, number>>();
      for (const h of r?.visitas_por_hora ?? []) {
        const k = porDia ? h.hora.slice(0, 10) : h.hora;
        const cur = m.get(k) ?? { anuncio: 0, bio: 0, direto: 0, organico: 0 };
        for (const o of ORIGENS) cur[o.valor] += h[o.valor] ?? 0;
        m.set(k, cur);
      }
      return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
    };
    const a = agrupar(atual);
    const b = agrupar(anterior);
    return a.map(([k, v], i) => ({
      rotulo: porDia ? `${k.slice(8, 10)}/${k.slice(5, 7)}` : `${k.slice(11, 13)}h`,
      ...v,
      // Período anterior alinhado pela posição (mesmo tamanho de período).
      anterior: b[i] ? origens.reduce((s, o) => s + (b[i][1][o] ?? 0), 0) : undefined,
    }));
  }, [atual, anterior, porDia, origens]);

  const total = dados.reduce((s, d) => s + origens.reduce((t, o) => t + (d[o] ?? 0), 0), 0);

  return (
    <Cartao>
      <TituloCartao direita={<span className="text-[12px] text-muted-foreground">{num(total)} visitas · {porDia ? "por dia" : "por hora"}</span>}>
        Visitas no site
      </TituloCartao>
      {dados.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma visita no período.</p>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dados} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#eee" />
              <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              {ORIGENS.filter((o) => origens.includes(o.valor)).map((o) => (
                <Bar key={o.valor} dataKey={o.valor} name={o.rotulo} stackId="v" fill={o.cor} stroke={TINTA} strokeWidth={1} />
              ))}
              {anterior && <Line type="monotone" dataKey="anterior" name="período anterior" stroke={TINTA} strokeDasharray="5 4" strokeWidth={2} dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-muted-foreground">
        {ORIGENS.filter((o) => origens.includes(o.valor)).map((o) => (
          <span key={o.valor} className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ background: o.cor, borderColor: TINTA }} />{o.rotulo}
          </span>
        ))}
        {anterior && <span className="inline-flex items-center gap-1.5"><i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: TINTA }} />período anterior</span>}
      </div>
    </Cartao>
  );
}

// ── Funil clicável ──────────────────────────────────────────────────────────
type Etapa = { chave: string; rotulo: string; valor: number; filtro?: (c: Cadastro) => boolean };

export function FunilPiloto({ resumo, origens, aoAbrirConta }: {
  resumo: Resumo; origens: Origem[]; aoAbrirConta: (id: string) => void;
}) {
  const [aberta, setAberta] = useState<Etapa | null>(null);
  const cads = resumo.cadastros.filter((c) => origens.includes(origemDoCadastro(c)));
  const f = resumo.funil;
  const filtrou = origens.length < ORIGENS.length;
  const etapas: Etapa[] = [
    { chave: "visitas", rotulo: "Visitou o site", valor: f.visitas },
    { chave: "teste", rotulo: "Clicou no teste grátis", valor: f.clicou_teste },
    { chave: "cad", rotulo: "Cadastrou", valor: filtrou ? cads.length : f.cadastros, filtro: () => true },
    { chave: "conf", rotulo: "Confirmou o e-mail", valor: filtrou ? cads.filter((c) => c.confirmou).length : f.confirmou, filtro: (c) => c.confirmou },
    { chave: "onb", rotulo: "Fez o onboarding", valor: filtrou ? cads.filter((c) => !!c.onboarding).length : f.onboarding, filtro: (c) => !!c.onboarding },
    { chave: "uso", rotulo: "Usou alguma função", valor: f.usou_funcao, filtro: (c) => !!c.ultimo_uso },
    { chave: "ass", rotulo: "Assinou", valor: filtrou ? cads.filter((c) => c.subscription_status === "active").length : f.assinou, filtro: (c) => c.subscription_status === "active" },
  ];
  const max = Math.max(1, ...etapas.map((e) => e.valor));
  // Onde mais se perde gente: maior queda relativa entre etapas vizinhas.
  let pior = -1, piorQueda = 0;
  etapas.forEach((e, i) => {
    if (i === 0) return;
    const ant = etapas[i - 1].valor;
    const q = ant > 0 ? 1 - e.valor / ant : 0;
    if (q > piorQueda) { piorQueda = q; pior = i; }
  });

  const lista = aberta?.filtro ? cads.filter(aberta.filtro) : [];

  return (
    <Cartao>
      <TituloCartao direita={<span className="text-[12px] text-muted-foreground hidden sm:inline">clique numa etapa pra ver quem está nela</span>}>
        Funil
      </TituloCartao>
      <div className="space-y-2">
        {etapas.map((e, i) => {
          const conv = i > 0 && etapas[i - 1].valor > 0 ? Math.round((e.valor / etapas[i - 1].valor) * 100) : null;
          const clicavel = !!e.filtro;
          return (
            <button
              key={e.chave}
              type="button"
              disabled={!clicavel}
              onClick={() => clicavel && setAberta(e)}
              className={cn("grid w-full grid-cols-[minmax(110px,170px)_1fr_auto] items-center gap-3 text-left", clicavel ? "cursor-pointer" : "cursor-default")}
            >
              <span className="text-[13px] font-bold truncate">{e.rotulo}</span>
              <span className="h-6 rounded-md bg-[#F4EDDF]">
                <span
                  className="block h-full rounded-md border-2"
                  style={{ width: `${Math.max(3, (e.valor / max) * 100)}%`, borderColor: TINTA, background: i === pior ? "#EA4918" : i < 2 ? "#C9DAFF" : "#FFE46B" }}
                />
              </span>
              <span className="text-[13px] font-extrabold tabular-nums w-[88px] text-right">
                {num(e.valor)}{conv !== null && <span className="ml-1.5 text-[11px] font-bold text-muted-foreground">{conv}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {pior > 0 && (
        <p className="mt-3 text-[13px]">
          <b>Onde mais perde gente:</b> de "{etapas[pior - 1].rotulo.toLowerCase()}" pra "{etapas[pior].rotulo.toLowerCase()}" ({Math.round(piorQueda * 100)}% ficam pelo caminho).
        </p>
      )}

      <Sheet open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">{aberta?.rotulo} · {lista.length} {lista.length === 1 ? "pessoa" : "pessoas"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-wrap gap-2 mt-3">
            <BotaoAcao onClick={() => baixarCsv(`funil-${aberta?.chave}`, lista.map((c) => ({
              nome: c.name, cadastro: c.criado_em.slice(0, 10), origem: origemDoCadastro(c), anuncio: c.anuncio_id,
              confirmou: c.confirmou ? "sim" : "não", onboarding: c.onboarding ? "sim" : "não",
              plano: c.plan, status: c.subscription_status, fim_teste: c.trial_ends_at?.slice(0, 10), ultimo_uso: c.ultimo_uso,
            })))}><Download className="h-3.5 w-3.5" /> CSV</BotaoAcao>
            <BotaoAcao disabled title="Chega na próxima etapa">E-mail pra todos</BotaoAcao>
            <BotaoAcao disabled title="Chega na próxima etapa">+3 dias de teste</BotaoAcao>
          </div>
          <div className="mt-4 divide-y divide-dashed">
            {lista.length === 0 && <p className="text-sm text-muted-foreground py-6">Ninguém nesta etapa no período.</p>}
            {lista.map((c) => {
              const dias = diasDesde(c.criado_em);
              const o = ORIGENS.find((x) => x.valor === origemDoCadastro(c));
              return (
                <button key={c.id} type="button" onClick={() => aoAbrirConta(c.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[#F4EDDF]/60 rounded-lg px-1">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-[12px] font-extrabold" style={{ borderColor: TINTA, background: "#FFE46B" }}>
                    {iniciais(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px]">{c.name || "Sem nome"}</b>
                    <span className="text-[11.5px] text-muted-foreground">
                      {o?.rotulo} · há {dias} {dias === 1 ? "dia" : "dias"} · {c.ultimo_uso ? `último uso ${c.ultimo_uso.slice(8, 10)}/${c.ultimo_uso.slice(5, 7)}` : "nunca usou"}
                    </span>
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </Cartao>
  );
}

// ── Anúncios ────────────────────────────────────────────────────────────────
export function TabelaAnuncios({ resumo }: { resumo: Resumo }) {
  const linhas = resumo.anuncios.filter((a) => (a.gasto ?? 0) > 0 || a.cadastros > 0);
  return (
    <Cartao className="p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <h4 className="font-display font-extrabold text-[16px]">Por anúncio</h4>
        <div className="ml-auto">
          <BotaoAcao onClick={() => baixarCsv("anuncios", linhas.map((a) => ({
            anuncio: a.ad_nome, campanha: a.campanha, gasto: a.gasto, cliques: a.cliques, visitas: a.visitas_lp,
            cadastros: a.cadastros, custo_por_cadastro: a.cadastros ? ((a.gasto ?? 0) / a.cadastros).toFixed(2) : "",
          })))}><Download className="h-3.5 w-3.5" /> CSV</BotaoAcao>
        </div>
      </div>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground px-4 pb-4">Sem gasto de anúncio no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-y-2 text-[10.5px] uppercase tracking-wide text-muted-foreground" style={{ borderColor: TINTA }}>
                <th className="text-left px-4 py-2">Anúncio</th>
                <th className="text-right px-3 py-2">Gasto</th>
                <th className="text-right px-3 py-2">Cliques</th>
                <th className="text-right px-3 py-2">Visitas</th>
                <th className="text-right px-3 py-2">Cadastros</th>
                <th className="text-right px-3 py-2">Custo/cadastro</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((a) => {
                const ruim = (a.gasto ?? 0) > 30 && a.cadastros === 0;
                return (
                  <tr key={a.ad_id} className={cn("border-t border-dashed", ruim && "bg-[#FFD3C2]/50")}>
                    <td className="px-4 py-2">
                      <b className="block">{a.ad_nome || a.ad_id}</b>
                      <span className="text-[11px] text-muted-foreground">{a.campanha}</span>
                      {ruim && <span className="ml-1"><Etiqueta cor="#FFD3C2">gastando sem cadastro</Etiqueta></span>}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums">{brl(a.gasto)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{num(a.cliques)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{num(a.visitas_lp)}</td>
                    <td className="text-right px-3 py-2 tabular-nums font-extrabold">{a.cadastros}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{a.cadastros ? brl((a.gasto ?? 0) / a.cadastros) : "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <a href={`https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${a.ad_id}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#EA4918] underline whitespace-nowrap">
                        Meta <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  );
}

// ── Cria IA ─────────────────────────────────────────────────────────────────
export function CartaoIA({ resumo }: { resumo: Resumo }) {
  const [modo, setModo] = useState<"funcao" | "conta">("funcao");
  const t = resumo.ia.total;
  const linhas = modo === "funcao"
    ? resumo.ia.por_funcao.map((f) => ({ k: f.funcao, chamadas: f.chamadas, custo: f.custo_usd, extra: f.falhas ? `${f.falhas} falhas` : "" }))
    : resumo.ia.por_conta.map((c) => ({ k: c.conta ? `conta ${c.conta.slice(0, 6)}` : "sem conta", chamadas: c.chamadas, custo: c.custo_usd, extra: "" }));
  return (
    <Cartao>
      <TituloCartao direita={<div className="flex gap-1.5"><Pilula ativo={modo === "funcao"} onClick={() => setModo("funcao")}>por função</Pilula><Pilula ativo={modo === "conta"} onClick={() => setModo("conta")}>por conta</Pilula></div>}>
        Cria IA
      </TituloCartao>
      <div className="flex items-end gap-6 flex-wrap">
        <div><span className="block text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Custo</span><b className="font-display text-[28px] leading-none">{brl((t.custo_usd ?? 0) * USD_BRL)}</b></div>
        <div><span className="block text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Chamadas</span><b className="font-display text-[28px] leading-none">{num(t.chamadas)}</b></div>
        <div><span className="block text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Tokens</span><b className="font-display text-[28px] leading-none">{num(t.tokens)}</b></div>
      </div>
      <div className="mt-3 divide-y divide-dashed">
        {linhas.length === 0 && <p className="text-sm text-muted-foreground py-3">Ainda sem chamadas registradas no período (o registro começou em 08/11).</p>}
        {linhas.slice(0, 8).map((l) => (
          <div key={l.k} className="flex items-center gap-3 py-2 text-[13px]">
            <span className="flex-1 truncate font-bold">{l.k}</span>
            {l.extra && <span className="text-[11px] text-[#EA4918] font-bold">{l.extra}</span>}
            <span className="tabular-nums text-muted-foreground">{num(l.chamadas)}</span>
            <span className="tabular-nums font-extrabold w-[80px] text-right">{brl((l.custo ?? 0) * USD_BRL)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Valor em real com câmbio aproximado de R$ {USD_BRL.toFixed(2).replace(".", ",")}.</p>
    </Cartao>
  );
}

// ── Erros ───────────────────────────────────────────────────────────────────
const STATUS: { v: ErroGrupo["status"]; r: string; cor: string }[] = [
  { v: "novo", r: "novo", cor: "#FFD3C2" },
  { v: "olhando", r: "olhando", cor: "#FFE46B" },
  { v: "resolvido", r: "resolvido", cor: "#D8F2E0" },
];

export function CartaoErros({ resumo }: { resumo: Resumo }) {
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState<string | null>(null);
  const mudar = async (e: ErroGrupo, status: ErroGrupo["status"]) => {
    setSalvando(e.assinatura);
    const { data: u } = await supabase.auth.getUser();
    const sb = supabase.from.bind(supabase) as unknown as (t: string) => {
      upsert: (v: Record<string, unknown>, o: { onConflict: string }) => PromiseLike<{ error: { message: string } | null }>;
    };
    const { error } = await sb("erros_status").upsert(
      { assinatura: e.assinatura, status, atualizado_em: new Date().toISOString(), atualizado_por: u.user?.id ?? null },
      { onConflict: "assinatura" },
    );
    setSalvando(null);
    if (error) { toast.error("Não consegui mudar o status: " + error.message); return; }
    toast.success(`Erro marcado como ${status}.`);
    void qc.invalidateQueries({ queryKey: ["piloto-resumo"] });
  };
  return (
    <Cartao>
      <TituloCartao direita={
        <a href="https://sentry.io" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-bold text-[#EA4918] underline">Sentry <ExternalLink className="h-3 w-3" /></a>
      }>Erros</TituloCartao>
      <div className="divide-y divide-dashed">
        {resumo.erros.length === 0 && <p className="text-sm text-muted-foreground py-3">Nenhum erro registrado no período.</p>}
        {resumo.erros.slice(0, 12).map((e) => (
          <div key={e.assinatura} className="py-2.5">
            <p className="text-[13px] font-bold break-words line-clamp-2">{e.exemplo}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
              <span>{e.vezes}x</span>
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{e.contas} {e.contas === 1 ? "conta" : "contas"}</span>
              <span>última {new Date(e.ultima).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="ml-auto flex gap-1">
                {STATUS.map((s) => (
                  <button key={s.v} type="button" disabled={salvando === e.assinatura} onClick={() => void mudar(e, s.v)}
                    className={cn("rounded-full border-[1.5px] px-2 py-[1px] text-[11px] font-extrabold", e.status === s.v ? "text-[#1D1B18]" : "bg-white text-muted-foreground")}
                    style={{ borderColor: TINTA, background: e.status === s.v ? s.cor : undefined }}>
                    {s.r}
                  </button>
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Cartao>
  );
}
