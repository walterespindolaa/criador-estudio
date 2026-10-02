import { useMemo, useRef, useState } from "react";
import { Download, Loader2, Eye, EyeOff, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErroAoCarregar } from "@/components/shared/ErroAoCarregar";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useExtratoDoParceiro, type LinhaDoExtrato } from "@/hooks/useAgendaParceiro";
import { useProfile } from "@/hooks/useProfile";
import { hojeBR, toISODateBR } from "@/lib/date-br";
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

  /* SELETOR DE PERÍODO (Agatha, 02/10/2026: "na página de extrato, pra filtrar
     as datas, seria interessante um date picker"). O campo era <input
     type="month">, que o Safari do Mac e o Firefox não desenham: aparece um
     texto "2026-10" pra digitar na mão. Agora: setas de mês, um calendário de
     meses e "Escolher datas" pra um intervalo livre (ex.: fechamento do dia 15). */
  const [faixa, setFaixa] = useState<{ de: string; ate: string } | null>(null);
  const [rascunho, setRascunho] = useState<DateRange | undefined>(undefined);
  const [abertoMes, setAbertoMes] = useState(false);
  const [abertoDatas, setAbertoDatas] = useState(false);
  const [anoGrade, setAnoGrade] = useState(Number(hoje.slice(0, 4)));

  const [ano, m] = mes.split("-").map(Number);
  const de = faixa?.de ?? `${mes}-01`;
  const ate = faixa?.ate ?? `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, "0")}`;
  const irMes = (delta: number) => {
    const d = new Date(ano, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setFaixa(null);
  };
  const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

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
      await exportPdf(folha, faixa ? `extrato-${faixa.de}-a-${faixa.ate}` : `extrato-${mes}`);
    } catch {
      toast.error("Não consegui gerar o PDF agora. Tente de novo.");
    } finally {
      setBaixando(false);
    }
  };

  const rotuloMes = faixa ? `${dmy(faixa.de)} a ${dmy(faixa.ate)}` : `${MESES[m - 1]} de ${ano}`;

  return (
    <div>
      {/* ── CONTROLES (não entram no PDF) ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center rounded-xl border border-input bg-background h-9">
          <button type="button" onClick={() => irMes(-1)} className="h-full px-2 text-muted-foreground hover:text-foreground" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Popover open={abertoMes} onOpenChange={(o) => { setAbertoMes(o); if (o) setAnoGrade(ano); }}>
            <PopoverTrigger asChild>
              <button type="button" className={cn("h-full px-2 text-[13px] font-semibold capitalize min-w-[132px]", faixa && "text-muted-foreground")}
                aria-label="Escolher o mês">
                {MESES[m - 1]} de {ano}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[264px] p-3 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setAnoGrade((a) => a - 1)} className="p-1 rounded-lg hover:bg-muted" aria-label="Ano anterior"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-sm font-bold">{anoGrade}</span>
                <button type="button" onClick={() => setAnoGrade((a) => a + 1)} className="p-1 rounded-lg hover:bg-muted" aria-label="Próximo ano"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MESES.map((nome, i) => {
                  const valor = `${anoGrade}-${String(i + 1).padStart(2, "0")}`;
                  const atual = !faixa && valor === mes;
                  return (
                    <button key={nome} type="button"
                      onClick={() => { setMes(valor); setFaixa(null); setAbertoMes(false); }}
                      className={cn("rounded-lg py-2 text-[12.5px] capitalize transition-colors",
                        atual ? "bg-primary text-primary-foreground font-bold" : "hover:bg-muted",
                        valor === hoje.slice(0, 7) && !atual && "ring-1 ring-primary/40")}>
                      {nome.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <button type="button" onClick={() => irMes(1)} className="h-full px-2 text-muted-foreground hover:text-foreground" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Popover open={abertoDatas} onOpenChange={(o) => {
          setAbertoDatas(o);
          if (o) setRascunho(faixa ? { from: new Date(faixa.de + "T12:00:00"), to: new Date(faixa.ate + "T12:00:00") } : undefined);
        }}>
          <PopoverTrigger asChild>
            <Button variant={faixa ? "default" : "outline"} className="h-9 rounded-xl text-[12.5px]">
              <CalendarDays className="h-4 w-4 mr-1.5" />
              {faixa ? `${dmy(faixa.de).slice(0, 5)} a ${dmy(faixa.ate).slice(0, 5)}` : "Escolher datas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2 rounded-2xl">
            <Calendar mode="range" locale={ptBR} numberOfMonths={1} selected={rascunho} onSelect={setRascunho}
              defaultMonth={rascunho?.from ?? new Date(ano, m - 1, 1)} initialFocus />
            <div className="flex items-center justify-between gap-2 px-2 pb-1">
              {faixa ? (
                <button type="button" className="text-[12px] text-muted-foreground underline underline-offset-2"
                  onClick={() => { setFaixa(null); setAbertoDatas(false); }}>
                  voltar pro mês
                </button>
              ) : <span className="text-[11.5px] text-muted-foreground">Toque no início e no fim</span>}
              <Button size="sm" className="h-8 rounded-lg" disabled={!rascunho?.from}
                onClick={() => {
                  const a = toISODateBR(rascunho!.from!), b = toISODateBR(rascunho!.to ?? rascunho!.from!);
                  setFaixa({ de: a <= b ? a : b, ate: a <= b ? b : a });
                  setAbertoDatas(false);
                }}>
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
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
                {faixa ? "Nada registrado nessas datas." : "Nada registrado neste mês."} Peça entregue e tarefa marcada como feita entram aqui sozinhas.
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
