import { useMemo, useRef, useState } from "react";
import { Download, Loader2, Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErroAoCarregar } from "@/components/shared/ErroAoCarregar";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useExtratoDoParceiro, type LinhaDoExtrato } from "@/hooks/useAgendaParceiro";
import { useProfile } from "@/hooks/useProfile";
import { hojeBR } from "@/lib/date-br";
import { toast } from "sonner";
import { brlReais } from "@/lib/money";

/* ═══════════════════════════════════════════════════════════════════════════
   EXTRATO DO MÊS (circuito 12, 16/09/2026) · pedido do Walter

   A social mídia tem o Relatório de produtividade. O parceiro não tinha nada:
   no fim do mês ele contava peça por peça na tela de Entregues, somava de
   cabeça e mandava um número no WhatsApp. Quem paga conferia do mesmo jeito.

   O documento responde três perguntas de uma vez: o que eu fiz, PRA QUEM
   (cliente) e POR CONTA DE QUEM (a agência que me contratou). A hierarquia da
   tela é essa, nessa ordem, porque é a ordem da conversa de cobrança.

   O INTERRUPTOR DE VALORES existe porque o mesmo documento tem dois usos. Pra
   fechar o mês com quem contratou, o cachê é o assunto. Pra mostrar o trabalho
   pra um terceiro (ou juntar num portfólio), preço é informação que não é da
   conta de quem lê. Um botão resolve, e ele vale também pro PDF: o que está na
   tela é o que sai no papel.

   O corpo do PDF usa cor em hex inline, não variável CSS: o html2canvas não lê
   oklch, e o mesmo nó da tela é o nó exportado (mesma regra do relatório de
   produtividade da social mídia).
   ═══════════════════════════════════════════════════════════════════════════ */

const C = {
  ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f7f7f5",
  brand: "#EA4918", green: "#01A652", blue: "#0061EE", lilas: "#7C90F0",
};

const FORMATO: Record<string, string> = {
  reels: "Reels", carrossel: "Carrossel", foto: "Estático", story: "Story",
  video: "Vídeo", shorts: "Shorts", live: "Live",
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const brl = brlReais;
const ddmm = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

type PorCliente = { cliente: string; cor: string | null; linhas: LinhaDoExtrato[] };
type PorAgencia = {
  agencia: string;
  clientes: PorCliente[];
  pecas: number;
  outros: number;
  revisoes: number;
  total: number;
  pago: number;
};

export default function Extrato() {
  const hoje = hojeBR();
  const [mes, setMes] = useState(hoje.slice(0, 7)); // AAAA-MM
  const [mostrarValores, setMostrarValores] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const folha = useRef<HTMLDivElement>(null);
  const { exportPdf } = usePdfExport();
  const { profile: perfil } = useProfile();

  const [ano, m] = mes.split("-").map(Number);
  const de = `${mes}-01`;
  const ate = `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, "0")}`;

  const { data: linhas = [], isLoading, isError, isFetching, refetch } = useExtratoDoParceiro(de, ate);

  /* ── AGRUPAMENTO: agência, depois cliente ─────────────────────────────── */
  const grupos = useMemo<PorAgencia[]>(() => {
    const porAgencia = new Map<string, Map<string, PorCliente>>();
    for (const l of linhas) {
      const ag = l.agencia_nome || "Sem agência";
      // Tarefa sem cliente cai num balde próprio em vez de virar um grupo vazio
      // com nome em branco.
      const cli = l.cliente_nome?.trim() || "Sem cliente";
      if (!porAgencia.has(ag)) porAgencia.set(ag, new Map());
      const mapaCli = porAgencia.get(ag)!;
      if (!mapaCli.has(cli)) mapaCli.set(cli, { cliente: cli, cor: l.cliente_cor, linhas: [] });
      mapaCli.get(cli)!.linhas.push(l);
    }
    const saida: PorAgencia[] = [];
    for (const [agencia, mapaCli] of porAgencia) {
      const clientes = [...mapaCli.values()].sort((a, b) => a.cliente.localeCompare(b.cliente));
      const todas = clientes.flatMap((c) => c.linhas);
      saida.push({
        agencia,
        clientes,
        pecas: todas.filter((l) => l.tipo === "peca").length,
        outros: todas.filter((l) => l.tipo !== "peca").length,
        revisoes: todas.reduce((s, l) => s + (l.revisoes ?? 0), 0),
        total: todas.reduce((s, l) => s + Number(l.cache ?? 0), 0),
        pago: todas.filter((l) => l.pago).reduce((s, l) => s + Number(l.cache ?? 0), 0),
      });
    }
    return saida.sort((a, b) => b.pecas - a.pecas || a.agencia.localeCompare(b.agencia));
  }, [linhas]);

  const totalPecas = grupos.reduce((s, g) => s + g.pecas, 0);
  const totalOutros = grupos.reduce((s, g) => s + g.outros, 0);
  const totalGeral = grupos.reduce((s, g) => s + g.total, 0);
  const totalPago = grupos.reduce((s, g) => s + g.pago, 0);
  const aReceber = totalGeral - totalPago;

  const baixar = async () => {
    setBaixando(true);
    try {
      await exportPdf(folha, `extrato-${mes}`);
    } catch {
      toast.error("Não consegui gerar o PDF agora. Tente de novo.");
    } finally {
      setBaixando(false);
    }
  };

  const rotuloMes = `${MESES[m - 1]} de ${ano}`;

  return (
    <div>
      {/* ── CONTROLES (não entram no PDF) ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input type="month" value={mes} onChange={(e) => setMes(e.target.value || hoje.slice(0, 7))}
          className="rounded-xl h-9 w-auto" aria-label="Mês do extrato" />
        <Button variant="outline" className="h-9 rounded-xl text-[12.5px]"
          onClick={() => setMostrarValores((v) => !v)}>
          {mostrarValores ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
          {mostrarValores ? "Esconder valores" : "Mostrar valores"}
        </Button>
        <Button className="h-9 rounded-xl ml-auto" onClick={() => void baixar()}
          disabled={baixando || linhas.length === 0}>
          {baixando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
          Baixar PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : isError && linhas.length === 0 ? (
        <ErroAoCarregar oQue="seu extrato do mês" aoTentarDeNovo={() => void refetch()} tentando={isFetching} />
      ) : (
        <Card className="rounded-2xl border-border overflow-hidden">
          {/* ── A FOLHA: o que está aqui é exatamente o que vira PDF ──── */}
          <div ref={folha} style={{ background: "#ffffff", color: C.ink, padding: "20px 18px", fontFamily: "Inter, system-ui, sans-serif" }}>
            {/* Cabeçalho */}
            <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 12, marginBottom: 14 }}>
              <p style={{ fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: C.sub, fontWeight: 700 }}>
                Extrato de produção
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, textTransform: "capitalize", lineHeight: 1.15, marginTop: 2 }}>
                {rotuloMes}
              </p>
              <p style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
                {perfil?.name || "Parceiro de produção"}
              </p>
            </div>

            {linhas.length === 0 ? (
              <p style={{ fontSize: 13, color: C.sub, padding: "28px 0", textAlign: "center" }}>
                Nada registrado neste mês. Peça entregue e tarefa marcada como feita entram aqui sozinhas.
              </p>
            ) : (
              <>
                {/* ── O MÊS EM NÚMEROS ─────────────────────────────────── */}
                <div data-pdf-block style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  <Numero rotulo={totalPecas === 1 ? "peça entregue" : "peças entregues"} valor={String(totalPecas)} cor={C.brand} />
                  {totalOutros > 0 && (
                    <Numero rotulo={totalOutros === 1 ? "outro trabalho" : "outros trabalhos"} valor={String(totalOutros)} cor={C.blue} />
                  )}
                  <Numero rotulo={grupos.length === 1 ? "contratante" : "contratantes"} valor={String(grupos.length)} cor={C.lilas} />
                  {mostrarValores && (
                    <>
                      <Numero rotulo="no mês" valor={brl(totalGeral)} cor={C.green} />
                      {aReceber > 0 && <Numero rotulo="a receber" valor={brl(aReceber)} cor={C.brand} />}
                    </>
                  )}
                </div>

                {/* ── POR CONTRATANTE ──────────────────────────────────── */}
                {grupos.map((g) => (
                  <div key={g.agencia} data-pdf-block style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, background: C.soft, padding: "7px 10px", borderRadius: 8 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 800, flex: 1 }}>{g.agencia}</p>
                      <p style={{ fontSize: 11, color: C.sub }}>
                        {g.pecas} peça{g.pecas === 1 ? "" : "s"}
                        {g.outros > 0 ? ` · ${g.outros} outro${g.outros === 1 ? "" : "s"}` : ""}
                        {g.revisoes > 0 ? ` · ${g.revisoes} revisão${g.revisoes === 1 ? "" : "es"}` : ""}
                      </p>
                      {mostrarValores && g.total > 0 && (
                        <p style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{brl(g.total)}</p>
                      )}
                    </div>

                    {g.clientes.map((c) => (
                      <div key={c.cliente} style={{ marginTop: 8, paddingLeft: 2 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: C.sub, display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 99, background: c.cor || C.sub, display: "inline-block" }} />
                          {c.cliente}
                        </p>
                        {c.linhas.map((l) => (
                          <div key={l.tipo + l.referencia_id}
                            style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.line}` }}>
                            <span style={{ fontSize: 10.5, color: C.sub, width: 36, flexShrink: 0 }}>{ddmm(l.quando)}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }}>
                              {l.titulo}
                              {l.tipo !== "peca" && (
                                <span style={{ fontSize: 10, color: C.blue, fontWeight: 700 }}>
                                  {" "}· {l.tipo === "tarefa" ? "tarefa" : "compromisso"}
                                </span>
                              )}
                            </span>
                            {l.formato && (
                              <span style={{ fontSize: 10.5, color: C.sub, flexShrink: 0 }}>
                                {FORMATO[l.formato] ?? l.formato}
                              </span>
                            )}
                            {(l.revisoes ?? 0) > 0 && (
                              <span style={{ fontSize: 10, color: C.brand, fontWeight: 700, flexShrink: 0 }}>
                                {l.revisoes}ª rev.
                              </span>
                            )}
                            {mostrarValores && l.cache != null && Number(l.cache) > 0 && (
                              <span style={{ fontSize: 11.5, fontWeight: 700, flexShrink: 0, color: l.pago ? C.green : C.ink }}>
                                {brl(Number(l.cache))}{l.pago ? " ✓" : ""}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}

                {/* ── O FECHO ──────────────────────────────────────────── */}
                {mostrarValores && totalGeral > 0 && (
                  <div data-pdf-block style={{ borderTop: `2px solid ${C.ink}`, paddingTop: 10, marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>Total do mês</span>
                      <span style={{ fontWeight: 800 }}>{brl(totalGeral)}</span>
                    </div>
                    {totalPago > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.sub, marginTop: 3 }}>
                        <span>Já recebido</span><span>{brl(totalPago)}</span>
                      </div>
                    )}
                    {aReceber > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.brand, fontWeight: 700, marginTop: 3 }}>
                        <span>A receber</span><span>{brl(aReceber)}</span>
                      </div>
                    )}
                    {/* O ✓ é o Caixa da agência falando, não a peça: só o
                        lançamento sabe se o dinheiro saiu. */}
                    <p style={{ fontSize: 9.5, color: C.sub, marginTop: 8 }}>
                      O ✓ marca o que a agência já registrou como pago no Caixa dela.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      <p className="text-[11.5px] font-body text-muted-foreground mt-3 px-0.5">
        A peça entra pela data em que você entregou. Tarefa e compromisso entram pelo dia em que
        você marcou como feito. O que está na tela é o que sai no PDF, inclusive a decisão de
        mostrar ou esconder os valores.
      </p>
    </div>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 12px", minWidth: 96 }}>
      <p style={{ fontSize: 18, fontWeight: 800, color: cor, lineHeight: 1.1 }}>{valor}</p>
      <p style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{rotulo}</p>
    </div>
  );
}
