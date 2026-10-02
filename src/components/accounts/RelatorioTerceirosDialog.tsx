// RELATÓRIO DE TERCEIROS POR PERÍODO (Gabriela e Walter, 02/10/2026)
// "quero que eu consiga tirar um relatório de toda produtividade/entregas/
// valores, filtrados por período". Mora no Cria Caixa > Terceiros, ao lado do
// fechamento, porque é a mesma conversa: o que cada parceiro fez e quanto vale.
//
// Duas fontes, sem SQL novo:
//  - posts com parceiro entregues no período (entregue_em): produtividade,
//    prazo cumprido x atrasado e quantas vezes cada peça voltou pra ajuste;
//  - linhas de terceiros do Caixa (fin_records) no período: cachês e avulsos,
//    pagos e a pagar. Terceiro sem conta no Cria só aparece por aqui.
//
// O corpo usa estilo inline com hex fixo: o html2canvas do PDF não lê as
// variáveis CSS em oklch (mesma regra do RelatorioProdutividadeDialog).
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useExternalClients } from "@/hooks/useCriaPost";
import { usePdfExport } from "@/hooks/usePdfExport";
import { brlReais } from "@/lib/money";
import { hojeBR, toISODateBR } from "@/lib/date-br";
import { FORMAT_LABELS } from "@/lib/constants";
import { dentro, type Periodo } from "@/lib/fechamento";
import { ROTULO_PAPEL_TERCEIRO, chaveTerceiro, type LinhaTerceiro, type Terceiro } from "@/hooks/useTerceiros";

// types.ts travado: consulta por cast, padrão do projeto.
const sbFrom = (t: string) => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)(t);

const C = { ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f6f5f1", brand: "#EA4918", green: "#16a34a", orange: "#c2410c", red: "#b91c1c" };

type PecaEntregue = {
  id: string; title: string | null; format: string | null; external_client_id: string | null;
  assignee_id: string; entregue_em: string; prazo_producao: string | null;
  revisoes: number | null; cache_parceiro: number | null;
};

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/** Primeiro dia do mês até hoje: o recorte mais pedido. */
function inicioDoMes(hoje: string) { return hoje.slice(0, 8) + "01"; }

export function RelatorioTerceirosDialog({ open, onOpenChange, terceiros, linhas, nomeCliente }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  terceiros: Terceiro[]; linhas: LinhaTerceiro[]; nomeCliente: Map<string, string>;
}) {
  const { agencyOwnerId } = useActiveAccount();
  const { clients: extClients } = useExternalClients();
  const { exportPdf } = usePdfExport();
  const ref = useRef<HTMLDivElement>(null);
  const hoje = hojeBR();
  const [de, setDe] = useState(inicioDoMes(hoje));
  const [ate, setAte] = useState(hoje);
  const [quem, setQuem] = useState<string>("todos");
  const [baixando, setBaixando] = useState(false);
  const periodo: Periodo = useMemo(() => ({ de: de <= ate ? de : ate, ate: de <= ate ? ate : de }), [de, ate]);

  const { data: pecas = [], isLoading } = useQuery<PecaEntregue[]>({
    queryKey: ["relatorio-terceiros", agencyOwnerId, periodo.de, periodo.ate],
    enabled: open && !!agencyOwnerId,
    queryFn: async () => {
      // Folga de um dia nas pontas: entregue_em é timestamptz e o corte certo
      // (fuso BR) é feito abaixo, com toISODateBR.
      const ini = new Date(periodo.de + "T00:00:00Z"); ini.setUTCDate(ini.getUTCDate() - 1);
      const fim = new Date(periodo.ate + "T00:00:00Z"); fim.setUTCDate(fim.getUTCDate() + 2);
      const { data, error } = await sbFrom("posts")
        .select("id, title, format, external_client_id, assignee_id, entregue_em, prazo_producao, revisoes, cache_parceiro")
        .eq("user_id", agencyOwnerId!)
        .not("assignee_id", "is", null)
        .is("deleted_at", null)
        .gte("entregue_em", ini.toISOString())
        .lt("entregue_em", fim.toISOString())
        .order("entregue_em", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return ((data ?? []) as unknown as PecaEntregue[])
        .filter((p) => dentro(toISODateBR(new Date(p.entregue_em)), periodo));
    },
  });

  const nomeExt = useMemo(() => new Map(extClients.map((c) => [c.id, c.name])), [extClients]);
  const linhaDoPost = useMemo(() => new Map(linhas.filter((l) => l.post_id).map((l) => [l.post_id!, l])), [linhas]);

  const blocos = useMemo(() => {
    const lista = quem === "todos" ? terceiros : terceiros.filter((t) => chaveTerceiro(t) === quem);
    return lista.map((t) => {
      const minhasPecas = t.member_id ? pecas.filter((p) => p.assignee_id === t.member_id) : [];
      const minhasLinhas = (t.member_id
        ? linhas.filter((l) => l.assignee_id === t.member_id)
        : linhas.filter((l) => l.terceiro_id === t.terceiro_id)).filter((l) => dentro(l.date, periodo));
      const avulsos = minhasLinhas.filter((l) => !l.post_id);
      const linhasPecas = minhasPecas.map((p) => {
        const dataEnt = toISODateBR(new Date(p.entregue_em));
        const fin = linhaDoPost.get(p.id);
        const valor = fin ? fin.amount : Number(p.cache_parceiro ?? 0);
        const noPrazo = p.prazo_producao ? dataEnt <= p.prazo_producao : null;
        return { p, dataEnt, valor, pago: fin?.status === "pago", lancado: !!fin, noPrazo };
      });
      const somaPecas = linhasPecas.reduce((s, x) => s + x.valor, 0);
      const somaAvulsos = avulsos.reduce((s, l) => s + l.amount, 0);
      const pago = linhasPecas.filter((x) => x.pago).reduce((s, x) => s + x.valor, 0)
        + avulsos.filter((l) => l.status === "pago").reduce((s, l) => s + l.amount, 0);
      const total = somaPecas + somaAvulsos;
      const comPrazo = linhasPecas.filter((x) => x.noPrazo !== null);
      return {
        t, linhasPecas, avulsos, total, pago, aPagar: total - pago,
        noPrazo: comPrazo.filter((x) => x.noPrazo).length, atrasadas: comPrazo.filter((x) => x.noPrazo === false).length,
        ajustes: minhasPecas.reduce((s, p) => s + Number(p.revisoes ?? 0), 0),
        semValor: linhasPecas.filter((x) => !x.valor).length,
      };
    }).filter((b) => b.linhasPecas.length > 0 || b.avulsos.length > 0);
  }, [quem, terceiros, pecas, linhas, linhaDoPost, periodo]);

  const tot = blocos.reduce((a, b) => ({
    pecas: a.pecas + b.linhasPecas.length, total: a.total + b.total, pago: a.pago + b.pago,
    aPagar: a.aPagar + b.aPagar, atrasadas: a.atrasadas + b.atrasadas, noPrazo: a.noPrazo + b.noPrazo, ajustes: a.ajustes + b.ajustes,
  }), { pecas: 0, total: 0, pago: 0, aPagar: 0, atrasadas: 0, noPrazo: 0, ajustes: 0 });

  const baixar = async () => {
    setBaixando(true);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      const sel = quem === "todos" ? "todos" : (terceiros.find((t) => chaveTerceiro(t) === quem)?.nome ?? "terceiro")
        .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
      await exportPdf(ref, `relatorio-terceiros-${sel}-${periodo.de}-a-${periodo.ate}`);
    } finally { setBaixando(false); }
  };

  const kpi = (label: string, valor: string, cor: string = C.ink) => (
    <div style={{ flex: 1, minWidth: 110, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: cor, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 10, color: C.sub, marginTop: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
  const th: React.CSSProperties = { textAlign: "left", fontSize: 9.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.4, padding: "6px 6px", borderBottom: `1px solid ${C.line}` };
  const td: React.CSSProperties = { fontSize: 11.5, color: C.ink, padding: "6px 6px", borderBottom: `1px solid ${C.line}`, verticalAlign: "top" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Relatório de terceiros</DialogTitle></DialogHeader>

        <div className="flex items-end gap-3 flex-wrap">
          <label className="text-xs font-body text-muted-foreground flex flex-col gap-1">de
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 w-[155px]" /></label>
          <label className="text-xs font-body text-muted-foreground flex flex-col gap-1">até
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 w-[155px]" /></label>
          <label className="text-xs font-body text-muted-foreground flex flex-col gap-1 min-w-[180px] flex-1">quem
            <select value={quem} onChange={(e) => setQuem(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
              <option value="todos">Todos os terceiros</option>
              {terceiros.map((t) => <option key={chaveTerceiro(t)} value={chaveTerceiro(t)}>{t.nome}</option>)}
            </select>
          </label>
        </div>
        <p className="text-[11px] font-body text-muted-foreground -mt-1">
          Peças contam pela data da entrega; avulsos, pela data do serviço. Valor da peça é o lançado no Caixa (ou o combinado, se ainda não lançou).
        </p>

        {isLoading ? (
          <div className="py-12 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <div ref={ref} style={{ background: "#ffffff", color: C.ink, padding: 24, minWidth: 720, fontFamily: "Inter, system-ui, sans-serif" }}>
              <div data-pdf-block style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `3px solid ${C.brand}`, paddingBottom: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>Relatório de terceiros</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                    {dmy(periodo.de)} a {dmy(periodo.ate)} · {quem === "todos" ? "todos os terceiros" : terceiros.find((t) => chaveTerceiro(t) === quem)?.nome}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.sub }}>gerado em {dmy(hoje)}</div>
              </div>

              <div data-pdf-block style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                {kpi("peças entregues", String(tot.pecas))}
                {kpi("no prazo / atrasadas", `${tot.noPrazo} / ${tot.atrasadas}`, tot.atrasadas ? C.orange : C.green)}
                {kpi("voltas de ajuste", String(tot.ajustes))}
                {kpi("total do período", brlReais(tot.total))}
                {kpi("pago", brlReais(tot.pago), C.green)}
                {kpi("a pagar", brlReais(tot.aPagar), tot.aPagar ? C.orange : C.ink)}
              </div>

              {blocos.length === 0 && (
                <div style={{ fontSize: 13, color: C.sub, textAlign: "center", padding: "28px 0" }}>Nada entregue nem lançado nesse período.</div>
              )}

              {blocos.map((b) => (
                <div key={chaveTerceiro(b.t)} style={{ marginBottom: 22 }}>
                  <div data-pdf-block style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", background: C.soft, borderRadius: 10, padding: "9px 12px", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 14.5, fontWeight: 800 }}>{b.t.nome}</span>
                      <span style={{ fontSize: 11, color: C.sub }}> · {ROTULO_PAPEL_TERCEIRO[b.t.papel] ?? b.t.papel}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.sub }}>
                      {b.linhasPecas.length} peça(s) · {b.noPrazo} no prazo · {b.atrasadas} atrasada(s) · {b.ajustes} ajuste(s) ·{" "}
                      <b style={{ color: C.ink }}>{brlReais(b.total)}</b>
                      {b.aPagar > 0 && <span style={{ color: C.orange }}> ({brlReais(b.aPagar)} a pagar)</span>}
                    </div>
                  </div>
                  {b.linhasPecas.length > 0 && (
                    <table data-pdf-block style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr>
                        <th style={th}>Entrega</th><th style={th}>Cliente</th><th style={th}>Peça</th><th style={th}>Formato</th>
                        <th style={th}>Prazo</th><th style={th}>Ajustes</th><th style={{ ...th, textAlign: "right" }}>Valor</th>
                      </tr></thead>
                      <tbody>
                        {b.linhasPecas.map((x) => (
                          <tr key={x.p.id}>
                            <td style={td}>{dm(x.dataEnt)}</td>
                            <td style={td}>{(x.p.external_client_id && nomeExt.get(x.p.external_client_id)) || "Sem cliente"}</td>
                            <td style={td}>{x.p.title || "Sem título"}</td>
                            <td style={td}>{(x.p.format && FORMAT_LABELS[x.p.format as keyof typeof FORMAT_LABELS]) || x.p.format || ""}</td>
                            <td style={{ ...td, color: x.noPrazo === false ? C.red : x.noPrazo ? C.green : C.sub }}>
                              {x.p.prazo_producao ? `${dm(x.p.prazo_producao)} ${x.noPrazo ? "ok" : "atrasou"}` : "sem prazo"}
                            </td>
                            <td style={td}>{Number(x.p.revisoes ?? 0) || ""}</td>
                            <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                              {x.valor ? brlReais(x.valor) : <span style={{ color: C.orange }}>sem valor</span>}
                              <div style={{ fontSize: 9.5, color: x.pago ? C.green : C.sub }}>{x.pago ? "pago" : x.lancado ? "a pagar" : x.valor ? "não lançado" : ""}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {b.avulsos.length > 0 && (
                    <table data-pdf-block style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                      <thead><tr>
                        <th style={th}>Data</th><th style={th}>Cliente</th><th style={th}>Serviço avulso</th><th style={{ ...th, textAlign: "right" }}>Valor</th>
                      </tr></thead>
                      <tbody>
                        {b.avulsos.map((l) => (
                          <tr key={l.id}>
                            <td style={td}>{dm(l.date)}</td>
                            <td style={td}>{l.crm_client_id ? nomeCliente.get(l.crm_client_id) ?? "Cliente" : "Agência"}</td>
                            <td style={td}>{l.description}</td>
                            <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                              {brlReais(l.amount)}
                              <div style={{ fontSize: 9.5, color: l.status === "pago" ? C.green : C.sub }}>{l.status === "pago" ? "pago" : "a pagar"}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {b.semValor > 0 && (
                    <div style={{ fontSize: 10.5, color: C.orange, marginTop: 6 }}>
                      {b.semValor} peça(s) entregue(s) sem cachê combinado: não entram no total.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={baixar} disabled={baixando || isLoading}>
            {baixando ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />} Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
