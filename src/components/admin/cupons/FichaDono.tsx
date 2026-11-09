/* Ficha do dono do cupom: cada cliente que veio pelo código, mensalidade por
   mensalidade (paga, a pagar, prevista, fora da regra, cancelou), marcar como
   pago com comprovante e CSV. Mockup aprovado em 09/11/2026. */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BotaoAcao, Cartao, Etiqueta, TINTA } from "../piloto/pecas";
import {
  brl, dataBR, iniciais, mascararPix, mesNome, pagarCompetencia, ROTULO_DONO, textoRegra, useFichaDono,
  type APagar, type ClienteFicha,
} from "./useCupons";
import { baixarCsv } from "./csv";

type Celula = { tipo: "paga" | "apagar" | "prevista" | "fora" | "teste" | "cancelou" | "estornada" | "vazia"; valor?: number };

export function previstoDe(c: ClienteFicha, k: number): number {
  const r = c.regra;
  if (!r || r.tipo === "nenhuma" || r.ate == null || k < r.de || k > r.ate) return 0;
  return r.tipo === "fixo" ? (r.fixo_cents ?? 0) : Math.round(c.ultima * Number(r.pct ?? 0) / 100);
}

export function celulaDe(c: ClienteFicha, k: number): Celula {
  const l = c.lancamentos.find((x) => x.seq === k);
  if (l) return { tipo: l.status === "paid" ? "paga" : l.status === "payable" ? "apagar" : "estornada", valor: l.valor };
  if (k <= c.pagas) return { tipo: "fora" };
  if (c.status === "cancelado") return k === c.pagas + 1 ? { tipo: "cancelou" } : { tipo: "vazia" };
  if (c.status === "teste" && k === 1) return { tipo: "teste" };
  const v = previstoDe(c, k);
  return v > 0 ? { tipo: "prevista", valor: v } : { tipo: "vazia" };
}

const ESTILO: Record<Celula["tipo"], string> = {
  paga: "bg-[#1D1B18] text-white",
  apagar: "bg-[#EA4918] text-white",
  prevista: "bg-white border-dashed",
  fora: "bg-[#EFE8DA] text-muted-foreground",
  teste: "bg-[#FFE46B]",
  cancelou: "bg-white text-muted-foreground line-through",
  estornada: "bg-white text-muted-foreground line-through",
  vazia: "bg-transparent border-transparent",
};
const valorCurto = (c: number) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FichaDono({ partnerId, aoFechar, aPagar }: { partnerId: string | null; aoFechar: () => void; aPagar: APagar[] }) {
  const qc = useQueryClient();
  const { data, isLoading } = useFichaDono(partnerId);
  const [nota, setNota] = useState("");
  const [pagando, setPagando] = useState(false);
  const [copiou, setCopiou] = useState(false);

  const grupos = useMemo(() => aPagar.filter((g) => g.partner_id === partnerId && g.fechado), [aPagar, partnerId]);
  const totalFechado = grupos.reduce((s, g) => s + g.total, 0);
  const previsto3 = useMemo(() => (data?.clientes ?? [])
    .filter((c) => c.status !== "cancelado")
    .reduce((s, c) => s + [1, 2, 3].reduce((t, i) => t + previstoDe(c, c.pagas + i), 0), 0), [data]);

  const pagar = async () => {
    if (!grupos.length) return;
    setPagando(true);
    try {
      for (const g of grupos) await pagarCompetencia(g.partner_id, g.competencia, nota.trim() || null);
      toast.success(`${brl(totalFechado)} marcados como pagos.`);
      setNota("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-cupons"] }),
        qc.invalidateQueries({ queryKey: ["admin-cupom-ficha", partnerId] }),
      ]);
    } catch (e) { toast.error((e as Error).message); } finally { setPagando(false); }
  };

  const csv = () => {
    if (!data) return;
    const linhas: (string | number)[][] = [["cliente", "plano", "cupom", "mensalidades pagas", "status", ...Array.from({ length: 12 }, (_, i) => `${i + 1}`)]];
    for (const c of data.clientes) {
      linhas.push([c.nome, c.plano ?? "", c.cupom ?? "", c.pagas, c.status,
        ...Array.from({ length: 12 }, (_, i) => { const cel = celulaDe(c, i + 1); return cel.valor ? `${cel.tipo} ${valorCurto(cel.valor)}` : cel.tipo === "vazia" ? "" : cel.tipo; })]);
    }
    baixarCsv(`comissao-${(data.dono.nome ?? "dono").toLowerCase().replace(/\s+/g, "-")}.csv`, linhas);
  };

  return (
    <Sheet open={!!partnerId} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent side="right" className="w-full sm:max-w-[760px] overflow-y-auto bg-[#FBF7EF] p-4 sm:p-6">
        {isLoading || !data ? (
          <div className="space-y-3 mt-8">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : (
          <>
            <SheetHeader className="mb-4 text-left">
              <div className="flex items-center gap-3">
                <span className="h-11 w-11 rounded-full border-2 grid place-items-center font-display font-extrabold text-[18px] bg-[#FFE46B]" style={{ borderColor: TINTA }}>
                  {(data.dono.nome ?? "?").trim()[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <SheetTitle className="font-display font-extrabold text-[20px] leading-tight">{data.dono.nome ?? "Sem nome"}</SheetTitle>
                  <p className="text-[12.5px] text-muted-foreground">
                    {ROTULO_DONO[data.dono.tipo] ?? data.dono.tipo} · {data.dono.cupons.join(", ") || "sem código"} · desde {dataBR(data.dono.desde)}
                    {data.dono.tem_conta ? "" : " · sem conta no Cria"}
                  </p>
                  <p className="text-[12.5px] mt-0.5 inline-flex items-center gap-1">
                    Pix: {mascararPix(data.dono.pix) ?? <span className="text-[#EA4918] font-bold">sem chave Pix</span>}
                    {data.dono.pix && (
                      <button type="button" className="text-muted-foreground hover:text-foreground" title="Copiar chave completa"
                        onClick={async () => { try { await navigator.clipboard.writeText(data.dono.pix!); setCopiou(true); setTimeout(() => setCopiou(false), 1500); } catch { toast.error("Não consegui copiar."); } }}>
                        {copiou ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <Cartao><p className="text-[11px] font-extrabold uppercase text-muted-foreground">A pagar</p><p className="font-display font-extrabold text-[20px]">{brl(data.totais.a_pagar)}</p></Cartao>
              <Cartao><p className="text-[11px] font-extrabold uppercase text-muted-foreground">Já pago</p><p className="font-display font-extrabold text-[20px]">{brl(data.totais.pago)}</p></Cartao>
              <Cartao><p className="text-[11px] font-extrabold uppercase text-muted-foreground">Previsto 3 meses</p><p className="font-display font-extrabold text-[20px]">{brl(previsto3)}</p></Cartao>
            </div>

            <Cartao className="mb-4">
              <p className="font-display font-extrabold text-[15px] mb-2">Clientes que vieram pelo código · mensalidade a mensalidade</p>
              {!data.clientes.length ? (
                <p className="text-[13px] text-muted-foreground">Ninguém assinou com esse código ainda.</p>
              ) : (
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-[11px] border-separate border-spacing-[3px] min-w-[620px]">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left font-extrabold">cliente</th>
                        {Array.from({ length: 12 }, (_, i) => <th key={i} className="font-extrabold">{i + 1}</th>)}
                        <th className="text-right font-extrabold">a pagar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.clientes.map((c, idx) => {
                        const aPagarCli = c.lancamentos.filter((l) => l.status === "payable").reduce((s, l) => s + l.valor, 0);
                        return (
                          <tr key={idx}>
                            <td className="pr-2 whitespace-nowrap">
                              <span className="font-bold">{iniciais(c.nome)}</span>
                              <span className="text-muted-foreground"> · {c.status === "teste" ? "teste" : (c.plano ?? "")}</span>
                              <span className="block text-[10px] text-muted-foreground">{textoRegra(c.regra, true)}</span>
                            </td>
                            {Array.from({ length: 12 }, (_, i) => {
                              const cel = celulaDe(c, i + 1);
                              return (
                                <td key={i} className={`h-7 min-w-[38px] rounded-md border-[1.5px] text-center font-bold ${ESTILO[cel.tipo]}`} style={{ borderColor: cel.tipo === "vazia" ? "transparent" : TINTA }}>
                                  {cel.valor ? valorCurto(cel.valor) : cel.tipo === "fora" ? "-" : cel.tipo === "teste" ? "teste" : cel.tipo === "cancelou" ? "canc." : ""}
                                </td>
                              );
                            })}
                            <td className="text-right font-extrabold whitespace-nowrap pl-2">{brl(aPagarCli)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                {([["teste", "teste"], ["paga", "paga"], ["apagar", "a pagar"], ["prevista", "prevista"], ["fora", "fora da regra (carência)"], ["cancelou", "cancelou"]] as [Celula["tipo"], string][]).map(([t, r]) => (
                  <span key={t} className="inline-flex items-center gap-1"><span className={`h-3 w-4 rounded-sm border-[1.5px] ${ESTILO[t]}`} style={{ borderColor: TINTA }} />{r}</span>
                ))}
              </div>
            </Cartao>

            <Cartao className="mb-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[11px] font-extrabold uppercase text-muted-foreground mb-1">Comprovante (link ou nota)</p>
                  <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Pix enviado 10/11, id E123..." />
                </div>
                <BotaoAcao primario disabled={!grupos.length || pagando} onClick={pagar}
                  title={grupos.length ? undefined : "Nada de mês fechado pra pagar"}>
                  {pagando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Marcar {brl(totalFechado)} como pago
                </BotaoAcao>
                <BotaoAcao onClick={csv}><Download className="h-3.5 w-3.5" />CSV</BotaoAcao>
              </div>
              {grupos.length > 0 && (
                <p className="text-[11.5px] text-muted-foreground mt-2">
                  Fecha {grupos.map((g) => mesNome(g.competencia)).join(", ")}. O mês corrente continua acumulando.
                </p>
              )}
            </Cartao>

            <Cartao>
              <p className="font-display font-extrabold text-[15px] mb-2">Pagamentos feitos</p>
              {!data.pagamentos.length ? (
                <p className="text-[13px] text-muted-foreground">Nenhum ainda.</p>
              ) : (
                <ul className="divide-y">
                  {data.pagamentos.map((p) => (
                    <li key={p.competencia} className="py-2 flex items-center gap-3 text-[13px]">
                      <span className="font-bold w-14">{dataBR(p.pago_em)}</span>
                      <span className="flex-1 min-w-0 truncate">{mesNome(p.competencia)} · {p.mensalidades} {p.mensalidades === 1 ? "mensalidade" : "mensalidades"}</span>
                      {(p.comprovante || p.nota) && <Etiqueta cor="#fff">comprovante</Etiqueta>}
                      <span className="font-extrabold">{brl(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
