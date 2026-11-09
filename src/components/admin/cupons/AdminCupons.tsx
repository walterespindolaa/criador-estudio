/* ═══════════════════════════════════════════════════════════════════════════
   CUPONS E PARCEIROS (aba do admin, 09/11/2026). Mockup aprovado:
   mockup-cupons-parceiros.html.

   Todo cupom, de parceira ou de campanha, nasce aqui e já sai criado na
   Stripe. A comissão é lançada sozinha quando a fatura do cliente é paga,
   seguindo a regra do cupom (stripe-webhook + cupom_regra). Desconto e
   comissão são independentes.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Pause, Play, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BotaoAcao, Cartao, Etiqueta, MAO, Pilula, Secao, TINTA } from "../piloto/pecas";
import {
  brl, brlCurto, chamarCupomAdmin, mascararPix, mesNome, pagarCompetencia, regraDoCupom, ROTULO_DONO,
  textoDesconto, textoRegra, usePainelCupons, useSoltosNaStripe,
  type APagar, type Cupom, type TipoDono,
} from "./useCupons";
import { NovoCupom } from "./NovoCupom";
import { FichaDono } from "./FichaDono";
import { baixarCsv } from "./csv";

type Filtro = "todos" | TipoDono | "campanha" | "parados";
const FILTROS: { v: Filtro; t: string }[] = [
  { v: "todos", t: "Todos" }, { v: "parceira", t: "Parceiras" }, { v: "assessor", t: "Assessores" },
  { v: "agencia", t: "Agências" }, { v: "campanha", t: "Campanhas" }, { v: "parados", t: "Pausados e vencidos" },
];
const COR_STATUS: Record<Cupom["status"], string> = { ativo: "#B9F0C8", pausado: "#EFE8DA", vencido: "#EFE8DA", esgotado: "#FFE46B" };
const chaveGrupo = (g: APagar) => `${g.partner_id}|${g.competencia}`;

function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: string; sub: string }) {
  return (
    <Cartao className="p-3.5">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="font-display font-extrabold text-[24px] leading-tight mt-0.5">{valor}</p>
      <p className="text-[12px] text-muted-foreground">{sub}</p>
    </Cartao>
  );
}
function Avatar({ nome }: { nome: string | null }) {
  return (
    <span className="h-7 w-7 shrink-0 rounded-full border-2 grid place-items-center text-[12px] font-extrabold bg-[#FFE46B]" style={{ borderColor: TINTA }}>
      {(nome ?? "C").trim()[0]?.toUpperCase()}
    </span>
  );
}

export function AdminCupons() {
  const { profile } = useProfile();
  const ehAdmin = profile?.role === "admin";
  const qc = useQueryClient();
  const { data, isLoading, error } = usePainelCupons(ehAdmin);
  const { data: soltos = [] } = useSoltosNaStripe(ehAdmin);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [ficha, setFicha] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [pagando, setPagando] = useState(false);
  const [mexendo, setMexendo] = useState<string | null>(null);

  const cupons = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.cupons ?? []).filter((c) => {
      if (filtro === "campanha" && c.partner_id) return false;
      if (filtro === "parados" && c.status === "ativo") return false;
      if (["parceira", "assessor", "agencia"].includes(filtro) && c.tipo_dono !== filtro) return false;
      if (!q) return true;
      return c.codigo.toLowerCase().includes(q) || (c.dono_nome ?? "").toLowerCase().includes(q);
    });
  }, [data, filtro, busca]);

  const fechados = useMemo(() => (data?.a_pagar ?? []).filter((g) => g.fechado), [data]);
  const acumulando = useMemo(() => (data?.a_pagar ?? []).filter((g) => !g.fechado), [data]);
  const selecionados = fechados.filter((g) => marcados.has(chaveGrupo(g)) && g.pix);
  const totalSel = selecionados.reduce((s, g) => s + g.total, 0);
  const maxPrev = Math.max(1, ...(data?.previsao ?? []).map((p) => p.total));

  if (!ehAdmin) return null;
  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  if (!data) {
    return (
      <Cartao className="text-center">
        <p className="font-display font-extrabold">{error ? "Não consegui ler os cupons" : "O painel ainda não está no banco"}</p>
        <p className="text-[12.5px] text-muted-foreground mt-1">
          Rode a migration <code className="font-mono">20261109120000_cupons_painel.sql</code> no SQL Editor e recarregue.
        </p>
      </Cartao>
    );
  }

  const k = data.kpis;
  const mesAtual = mesNome(data.mes);
  const mesAnterior = fechados[0] ? mesNome(fechados[fechados.length - 1].competencia) : null;

  const pausarOuReativar = async (c: Cupom) => {
    const pausar = c.status !== "pausado";
    setMexendo(c.codigo);
    try {
      if (c.origem === "campanha") {
        await chamarCupomAdmin({ acao: pausar ? "pausar" : "reativar", codigo: c.codigo });
      } else {
        const { error: e } = await supabase.functions.invoke("partner-manage", {
          body: { partner_id: c.partner_id, action: pausar ? "suspend" : "reactivate" },
        });
        if (e) throw new Error("Não consegui mudar a parceira.");
      }
      toast.success(pausar ? `${c.codigo} pausado.` : `${c.codigo} ativo de novo.`);
      await qc.invalidateQueries({ queryKey: ["admin-cupons"] });
    } catch (e) { toast.error((e as Error).message); } finally { setMexendo(null); }
  };

  const pagarSelecionados = async () => {
    if (!selecionados.length) return;
    setPagando(true);
    try {
      for (const g of selecionados) await pagarCompetencia(g.partner_id, g.competencia, null);
      toast.success(`${brl(totalSel)} marcados como pagos.`);
      setMarcados(new Set());
      await qc.invalidateQueries({ queryKey: ["admin-cupons"] });
    } catch (e) { toast.error((e as Error).message); } finally { setPagando(false); }
  };

  const pedirPix = async (g: APagar) => {
    const texto = `Oi${g.nome ? `, ${g.nome.split(" ")[0]}` : ""}! Sua comissão do Cria de ${mesNome(g.competencia)} deu ${brl(g.total)}. Me passa sua chave Pix pra eu fazer o pagamento?`;
    try { await navigator.clipboard.writeText(texto); toast.success("Mensagem copiada. Cola no WhatsApp."); } catch { toast.error("Não consegui copiar."); }
  };

  const csvCupons = () => baixarCsv("cupons.csv", [
    ["codigo", "dono", "tipo", "desconto do cliente", "comissao do dono", "usos", "pagantes", "receita no mes", "a pagar", "pago", "status"],
    ...cupons.map((c) => [c.codigo, c.dono_nome ?? "sem dono", c.tipo_dono ? ROTULO_DONO[c.tipo_dono] : "Campanha",
      textoDesconto(c), textoRegra(regraDoCupom(c)), c.limite_usos ? `${c.usos}/${c.limite_usos}` : c.usos, c.pagantes,
      brl(c.receita_mes), brl(c.a_pagar), brl(c.pago), c.status]),
  ]);
  const csvBanco = () => baixarCsv(`pagar-${data.mes.slice(0, 7)}.csv`, [
    ["nome", "pix", "competencia", "mensalidades", "valor"],
    ...fechados.map((g) => [g.nome ?? "", g.pix ?? "SEM PIX", g.competencia.slice(0, 7), g.mensalidades, (g.total / 100).toFixed(2).replace(".", ",")]),
  ]);

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <h2 className="font-display font-extrabold text-[26px] leading-none">Cupons e parceiros</h2>
          <p className="text-[20px] leading-tight text-[#EA4918] mt-1" style={MAO}>quem trouxe quem, e quanto cada um tem pra receber</p>
        </div>
        <div className="ml-auto flex gap-2">
          <BotaoAcao onClick={csvCupons}><Download className="h-3.5 w-3.5" />Exportar CSV</BotaoAcao>
          <BotaoAcao primario onClick={() => setNovo(true)}><Plus className="h-3.5 w-3.5" />Novo cupom</BotaoAcao>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi rotulo={`A pagar em ${mesAtual}`} valor={brl(k.a_pagar_fechado)}
          sub={k.pessoas_a_pagar ? `${k.pessoas_a_pagar} ${k.pessoas_a_pagar === 1 ? "pessoa" : "pessoas"} · vence dia 10` : "ninguém pra pagar"} />
        <Kpi rotulo="Cupons ativos" valor={String(k.cupons_ativos)} sub={`${k.cupons_com_dono} com dono · ${k.cupons_ativos - k.cupons_com_dono} de campanha`} />
        <Kpi rotulo="Clientes vindos de cupom" valor={String(k.clientes)} sub={`${k.pagantes} pagantes · ${k.em_teste} no teste`} />
        <Kpi rotulo="Receita desses clientes" valor={brlCurto(k.receita_mes)} sub="por mês, já com o desconto" />
        <Kpi rotulo="Próximos 3 meses" valor={brlCurto(k.previsto_3m)} sub="de comissão, se todos seguirem" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-6 mb-3">
        {FILTROS.map((f) => <Pilula key={f.v} ativo={filtro === f.v} onClick={() => setFiltro(f.v)}>{f.t}</Pilula>)}
        <label className="ml-auto flex items-center gap-1.5 rounded-full border-2 bg-white px-3 py-1 w-full sm:w-64" style={{ borderColor: TINTA }}>
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código ou pessoa"
            className="bg-transparent outline-none text-[13px] w-full" />
        </label>
      </div>

      {/* Tabela no computador */}
      <Cartao className="p-0 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[#F4EDDF] text-[11px] uppercase tracking-wide">
              <tr className="text-left">
                {["Código", "Dono", "Desconto pro cliente", "Comissão do dono", "Usos", "Pagantes", "Receita", "A pagar", "Pago", "Status", ""].map((h) => (
                  <th key={h} className="px-3 py-2 font-extrabold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cupons.map((c) => (
                <tr key={c.codigo} className="border-t-2" style={{ borderColor: "#EFE8DA" }}>
                  <td className="px-3 py-2.5 font-mono font-extrabold">{c.codigo}</td>
                  <td className="px-3 py-2.5">
                    {c.partner_id ? (
                      <button type="button" onClick={() => setFicha(c.partner_id)} className="flex items-center gap-2 text-left hover:underline">
                        <Avatar nome={c.dono_nome} />
                        <span><span className="font-bold block leading-tight">{c.dono_nome ?? "Sem nome"}</span>
                          <span className="text-[11px] text-muted-foreground">{c.tipo_dono ? ROTULO_DONO[c.tipo_dono] : ""}</span></span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-2"><Avatar nome="C" /><span className="text-muted-foreground">Campanha</span></span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{textoDesconto(c)}</td>
                  <td className="px-3 py-2.5">{c.partner_id ? textoRegra(regraDoCupom(c), true) : <span className="text-muted-foreground">sem dono</span>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.limite_usos ? `${c.usos} / ${c.limite_usos}` : c.usos}</td>
                  <td className="px-3 py-2.5">{c.pagantes}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{brl(c.receita_mes)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-bold">{c.partner_id ? brl(c.a_pagar) : "-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.partner_id ? brl(c.pago) : "-"}</td>
                  <td className="px-3 py-2.5"><Etiqueta cor={COR_STATUS[c.status]}>{c.status}</Etiqueta></td>
                  <td className="px-3 py-2.5">
                    {(c.status === "ativo" || c.status === "pausado") && (
                      <button type="button" onClick={() => pausarOuReativar(c)} disabled={mexendo === c.codigo}
                        title={c.status === "pausado" ? "Reativar" : "Pausar"} className="text-muted-foreground hover:text-foreground">
                        {mexendo === c.codigo ? <Loader2 className="h-4 w-4 animate-spin" /> : c.status === "pausado" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!cupons.length && <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">Nenhum cupom nesse filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </Cartao>

      {/* Cartões no celular */}
      <div className="md:hidden space-y-3">
        {cupons.map((c) => (
          <Cartao key={c.codigo}>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold">{c.codigo}</span>
              <span className="text-[12px] text-muted-foreground truncate">
                {c.partner_id ? `${c.dono_nome ?? ""} · ${c.tipo_dono ? ROTULO_DONO[c.tipo_dono].toLowerCase() : ""}` : "campanha"}
              </span>
              <span className="ml-auto"><Etiqueta cor={COR_STATUS[c.status]}>{c.status}</Etiqueta></span>
            </div>
            <p className="text-[12px] mt-1.5">Cliente: {textoDesconto(c)} · {c.partner_id ? `Dono: ${textoRegra(regraDoCupom(c), true)}` : "sem dono"}</p>
            <div className="grid grid-cols-3 gap-2 mt-2 text-[12px]">
              {c.partner_id ? (
                <>
                  <div><p className="text-muted-foreground">Pagantes</p><p className="font-extrabold">{c.pagantes}</p></div>
                  <div><p className="text-muted-foreground">A pagar</p><p className="font-extrabold">{brl(c.a_pagar)}</p></div>
                  <div><p className="text-muted-foreground">Pago</p><p className="font-extrabold">{brl(c.pago)}</p></div>
                </>
              ) : (
                <>
                  <div><p className="text-muted-foreground">Usos</p><p className="font-extrabold">{c.usos}</p></div>
                  <div><p className="text-muted-foreground">Pagantes</p><p className="font-extrabold">{c.pagantes}</p></div>
                  <div><p className="text-muted-foreground">Receita</p><p className="font-extrabold">{brl(c.receita_mes)}</p></div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              {c.partner_id && <BotaoAcao onClick={() => setFicha(c.partner_id)}>Ver ficha</BotaoAcao>}
              {(c.status === "ativo" || c.status === "pausado") && (
                <BotaoAcao onClick={() => pausarOuReativar(c)} disabled={mexendo === c.codigo}>{c.status === "pausado" ? "Reativar" : "Pausar"}</BotaoAcao>
              )}
            </div>
          </Cartao>
        ))}
      </div>

      {soltos.length > 0 && (
        <Cartao className="mt-3">
          <p className="font-display font-extrabold text-[14px]">Só na Stripe</p>
          <p className="text-[12px] text-muted-foreground mb-2">Criados direto na Stripe. Funcionam na página de pagamento, mas não têm dono nem comissão no Cria.</p>
          <div className="flex flex-wrap gap-2">
            {soltos.map((s) => (
              <span key={s.codigo} className="rounded-xl border-2 bg-white px-2.5 py-1.5 text-[12px]" style={{ borderColor: TINTA }}>
                <span className="font-mono font-extrabold">{s.codigo}</span>
                <span className="text-muted-foreground"> · {s.pct ? `${s.pct}%` : brl(s.valor_cents)}{s.duracao === "repeating" ? ` por ${s.meses} meses` : s.duracao === "once" ? " na 1ª" : " sempre"} · {s.usos} {s.usos === 1 ? "uso" : "usos"}</span>
              </span>
            ))}
          </div>
        </Cartao>
      )}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <div>
          <Secao titulo={`A pagar em ${mesAtual}`} mao={mesAnterior ? `competência de ${mesAnterior} · até dia 10` : undefined} />
          <Cartao className="p-0 overflow-hidden">
            {!fechados.length ? (
              <p className="p-4 text-[13px] text-muted-foreground">Nada de mês fechado pra pagar.</p>
            ) : (
              <ul>
                {fechados.map((g) => {
                  const ch = chaveGrupo(g);
                  return (
                    <li key={ch} className="flex items-center gap-3 px-3 py-2.5 border-b-2 last:border-b-0" style={{ borderColor: "#EFE8DA" }}>
                      <input type="checkbox" disabled={!g.pix} checked={marcados.has(ch)}
                        onChange={() => setMarcados((s) => { const n = new Set(s); if (n.has(ch)) n.delete(ch); else n.add(ch); return n; })}
                        className="h-4 w-4 accent-[#EA4918]" />
                      <Avatar nome={g.nome} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[13px] truncate">{g.nome ?? "Sem nome"} <span className="font-normal text-muted-foreground">· {ROTULO_DONO[g.tipo] ?? g.tipo}</span></p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {g.pix ? mascararPix(g.pix) : <span className="text-[#EA4918] font-bold">sem chave Pix</span>} · {g.mensalidades} {g.mensalidades === 1 ? "mensalidade" : "mensalidades"} · {mesNome(g.competencia, true)}
                        </p>
                      </div>
                      <span className="font-extrabold text-[14px] whitespace-nowrap">{brl(g.total)}</span>
                      {g.pix
                        ? <BotaoAcao onClick={() => setFicha(g.partner_id)}>ver</BotaoAcao>
                        : <BotaoAcao onClick={() => pedirPix(g)}>pedir Pix</BotaoAcao>}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 p-3 bg-[#F4EDDF]">
              <BotaoAcao primario disabled={!selecionados.length || pagando} onClick={pagarSelecionados}>
                {pagando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Pagar {selecionados.length} {selecionados.length === 1 ? "selecionado" : "selecionados"} · {brl(totalSel)}
              </BotaoAcao>
              <BotaoAcao onClick={csvBanco} disabled={!fechados.length}><Download className="h-3.5 w-3.5" />Lista pro banco (CSV)</BotaoAcao>
            </div>
          </Cartao>
          {acumulando.length > 0 && (
            <p className="text-[12px] text-muted-foreground mt-2">
              {mesAtual} ainda acumulando: {brl(acumulando.reduce((s, g) => s + g.total, 0))} entre {acumulando.length} {acumulando.length === 1 ? "pessoa" : "pessoas"}. Fecha no dia 1º.
            </p>
          )}
        </div>

        <div>
          <Secao titulo="Previsão" mao="se ninguém cancelar" />
          <Cartao>
            <div className="flex items-end gap-3 h-40">
              {data.previsao.map((p) => (
                <div key={p.competencia} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[11.5px] font-extrabold mb-1">{brlCurto(p.total)}</span>
                  <div className="w-full rounded-t-lg border-2" style={{ borderColor: TINTA, height: `${Math.max(4, (p.total / maxPrev) * 100)}%`, background: "#EA4918" }} />
                  <span className="text-[11.5px] text-muted-foreground mt-1">{mesNome(p.competencia, true)}</span>
                </div>
              ))}
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-2">Comissão por mês de competência, pela última mensalidade de cada cliente e a regra do cupom dele.</p>
          </Cartao>

          <Secao titulo="Regras que valem pra qualquer cupom" />
          <Cartao className={cn("text-[12.5px] space-y-1.5")}>
            <p>Comissão só conta <b>mensalidade paga</b>. A fatura de R$ 0 do teste não entra na conta.</p>
            <p>Reembolso ou estorno cancela o lançamento daquele mês.</p>
            <p>Cliente que cancela para de gerar comissão.</p>
            <p>Pagamento no dia 10, sobre o que foi pago no mês anterior.</p>
            <p>Mudar a regra de um cupom vale pras próximas mensalidades; o que já foi lançado não muda.</p>
          </Cartao>
        </div>
      </div>

      <NovoCupom aberto={novo} aoFechar={() => setNovo(false)} donos={data.donos} />
      <FichaDono partnerId={ficha} aoFechar={() => setFicha(null)} aPagar={data.a_pagar} />
    </div>
  );
}
