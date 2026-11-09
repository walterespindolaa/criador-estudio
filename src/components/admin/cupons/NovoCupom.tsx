/* Painel lateral "Novo cupom" (mockup aprovado 09/11/2026): 3 passos, dono,
   o que o cliente ganha, o que o dono recebe. A régua mostra em quais
   mensalidades cai a comissão e a frase explica com um cliente Pro. */
import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { cn } from "@/lib/utils";
import { PLAN_VALUE } from "@/lib/plans";
import { BotaoAcao, Pilula, TINTA } from "../piloto/pecas";
import {
  brl, chamarCupomAdmin, mascararPix, ROTULO_DONO, textoRegra,
  type Dono, type TipoDono, type TipoRegra,
} from "./useCupons";

type ModoDono = "existente" | "novo" | "nenhum";
type Duracao = "primeira" | "meses";

const ATALHOS: { nome: string; texto: string; tipo: TipoRegra; pct?: number; fixo?: number; de: number; ate: number }[] = [
  { nome: "Padrão do programa", texto: "20% da 3ª à 14ª", tipo: "pct", pct: 20, de: 3, ate: 14 },
  { nome: "Arranque", texto: "50% da 2ª à 4ª", tipo: "pct", pct: 50, de: 2, ate: 4 },
  { nome: "Fidelidade", texto: "20% de todas até 12 meses", tipo: "pct", pct: 20, de: 1, ate: 12 },
  { nome: "Por cliente", texto: "R$ 30 fixo quando pagar a 2ª", tipo: "fixo", fixo: 30, de: 2, ate: 2 },
  { nome: "Só desconto", texto: "campanha sem comissão", tipo: "nenhuma", de: 1, ate: 1 },
];

function Passo({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border-2 p-4 bg-white" style={{ borderColor: TINTA, boxShadow: `2px 2px 0 ${TINTA}` }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-6 w-6 rounded-full border-2 grid place-items-center text-[12px] font-extrabold bg-[#FFE46B]" style={{ borderColor: TINTA }}>{n}</span>
        <h4 className="font-display font-extrabold text-[15px]">{titulo}</h4>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground mb-1">{rotulo}</span>
      {children}
    </label>
  );
}
const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));

export function NovoCupom({ aberto, aoFechar, donos }: { aberto: boolean; aoFechar: () => void; donos: Dono[] }) {
  const qc = useQueryClient();
  const [modoDono, setModoDono] = useState<ModoDono>("existente");
  const [donoId, setDonoId] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<TipoDono>("parceira");
  const [novoPix, setNovoPix] = useState("");

  const [codigo, setCodigo] = useState("");
  const [pct, setPct] = useState("20");
  const [duracao, setDuracao] = useState<Duracao>("meses");
  const [meses, setMeses] = useState("6");
  const [gratis, setGratis] = useState("0");
  const [planos, setPlanos] = useState<string[]>(["essencial", "pro", "studio"]);
  const [limite, setLimite] = useState("");
  const [validade, setValidade] = useState("");

  const [tipoRegra, setTipoRegra] = useState<TipoRegra>("pct");
  const [regraPct, setRegraPct] = useState("50");
  const [regraFixo, setRegraFixo] = useState<number | null>(30);
  const [de, setDe] = useState(2);
  const [ate, setAte] = useState(4);
  const [salvando, setSalvando] = useState(false);

  const semDono = modoDono === "nenhum";
  const regraEfetiva: TipoRegra = semDono ? "nenhuma" : tipoRegra;
  const descontoPct = Math.max(0, num(pct) || 0);
  const mesesDesconto = duracao === "primeira" ? 1 : Math.max(0, Math.round(num(meses) || 0));
  const mesesGratis = Math.max(0, Math.round(num(gratis) || 0));

  const aplicarAtalho = (a: (typeof ATALHOS)[number]) => {
    setTipoRegra(a.tipo);
    if (a.pct) setRegraPct(String(a.pct));
    if (a.fixo) setRegraFixo(a.fixo);
    setDe(a.de); setAte(a.ate);
    if (a.tipo === "nenhuma" && modoDono !== "nenhum") setModoDono("nenhum");
  };
  const clicarRegua = (m: number) => {
    // 1º clique marca o começo; clique depois do começo marca o fim.
    if (m < de || (de !== ate && m !== ate)) { setDe(m); setAte(m); }
    else setAte(m);
  };

  // Exemplo com cliente Pro: o que ele paga e o que o dono recebe.
  const exemplo = useMemo(() => {
    const pro = Math.round(PLAN_VALUE.pro * 100);
    const pago = Math.round(pro * (1 - descontoPct / 100));
    if (regraEfetiva === "nenhuma") return null;
    // Mensalidade k paga: com desconto até a N-ésima, cheia depois.
    const valorDa = (k: number) => (descontoPct > 0 && k <= mesesDesconto ? pago : pro);
    const comissaoDa = (k: number) => regraEfetiva === "fixo"
      ? Math.round((regraFixo ?? 0) * 100)
      : Math.round(valorDa(k) * (num(regraPct) || 0) / 100);
    const porMes = comissaoDa(de);
    let total = 0;
    for (let k = de; k <= ate; k++) total += comissaoDa(k);
    const quais = de === ate ? `na ${de}ª mensalidade` : `da ${de}ª à ${ate}ª mensalidade`;
    const desconto = descontoPct > 0
      ? `com ${descontoPct}% de desconto ele paga ${brl(pago)} ${mesesDesconto <= 1 ? "na 1ª mensalidade" : `nas ${mesesDesconto} primeiras`}`
      : `sem desconto ele paga ${brl(pro)}`;
    const recebe = regraEfetiva === "fixo"
      ? `O dono recebe ${brl(porMes)} ${quais}`
      : `O dono recebe ${num(regraPct) || 0}% do que o cliente pagou ${quais}: ${brl(porMes)} na ${de}ª`;
    return `Cliente Pro (${brl(pro)}): ${desconto}${mesesGratis ? `, depois de ${mesesGratis} ${mesesGratis === 1 ? "mês grátis" : "meses grátis"}` : ""}. ${recebe}, ${brl(total)} no total por cliente. Pago no dia 10 do mês seguinte.`;
  }, [descontoPct, mesesDesconto, mesesGratis, regraEfetiva, regraPct, regraFixo, de, ate]);

  const limpar = () => {
    setModoDono("existente"); setDonoId(""); setNovoNome(""); setNovoTipo("parceira"); setNovoPix("");
    setCodigo(""); setPct("20"); setDuracao("meses"); setMeses("6"); setGratis("0");
    setPlanos(["essencial", "pro", "studio"]); setLimite(""); setValidade("");
    setTipoRegra("pct"); setRegraPct("50"); setRegraFixo(30); setDe(2); setAte(4);
  };

  const criar = async () => {
    if (modoDono === "existente" && !donoId) { toast.error("Escolha o dono ou marque sem dono."); return; }
    if (modoDono === "novo" && novoNome.trim().length < 2) { toast.error("Coloque o nome do dono."); return; }
    if (!planos.length) { toast.error("Escolha pelo menos um plano."); return; }
    setSalvando(true);
    try {
      await chamarCupomAdmin({
        acao: "criar",
        codigo: codigo.trim().toUpperCase(),
        dono: modoDono === "existente" ? { id: donoId } : modoDono === "novo" ? { novo: { nome: novoNome, tipo: novoTipo, pix: novoPix } } : null,
        desconto_pct: descontoPct,
        desconto_meses: descontoPct > 0 ? mesesDesconto : 0,
        meses_gratis: mesesGratis,
        planos,
        limite_usos: limite ? Number(limite) : null,
        valido_ate: validade || null,
        regra: regraEfetiva === "nenhuma"
          ? { tipo: "nenhuma" }
          : { tipo: regraEfetiva, pct: num(regraPct), fixo_cents: Math.round((regraFixo ?? 0) * 100), de, ate },
      });
      toast.success(`Cupom ${codigo.toUpperCase()} criado.`);
      await qc.invalidateQueries({ queryKey: ["admin-cupons"] });
      limpar(); aoFechar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSalvando(false); }
  };

  const donoEscolhido = donos.find((d) => d.id === donoId);

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto bg-[#FBF7EF] p-4 sm:p-6">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-display font-extrabold text-[22px] text-left">Novo cupom</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pb-24">
          <Passo n={1} titulo="Dono do cupom">
            <div className="flex flex-wrap gap-1.5">
              <Pilula ativo={modoDono === "existente"} onClick={() => setModoDono("existente")}>Já cadastrado</Pilula>
              <Pilula ativo={modoDono === "novo"} onClick={() => setModoDono("novo")}>Cadastrar novo dono</Pilula>
              <Pilula ativo={modoDono === "nenhum"} onClick={() => setModoDono("nenhum")}>Sem dono (campanha)</Pilula>
            </div>
            {modoDono === "existente" && (
              <Campo rotulo="Quem">
                <select value={donoId} onChange={(e) => setDonoId(e.target.value)}
                  className="w-full h-10 rounded-xl border-2 bg-white px-3 text-[14px]" style={{ borderColor: TINTA }}>
                  <option value="">Escolha</option>
                  {donos.map((d) => <option key={d.id} value={d.id}>{d.nome ?? "Sem nome"} · {ROTULO_DONO[d.tipo] ?? d.tipo}</option>)}
                </select>
                {donoEscolhido && (
                  <p className="text-[12px] text-muted-foreground mt-1">
                    Pix: {mascararPix(donoEscolhido.pix) ?? "sem chave Pix ainda"}{donoEscolhido.tem_conta ? "" : " · sem conta no Cria"}
                  </p>
                )}
              </Campo>
            )}
            {modoDono === "novo" && (
              <>
                <Campo rotulo="Nome"><Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome da pessoa ou empresa" /></Campo>
                <Campo rotulo="Tipo">
                  <div className="flex flex-wrap gap-1.5">
                    {(["parceira", "assessor", "agencia"] as TipoDono[]).map((t) => (
                      <Pilula key={t} ativo={novoTipo === t} onClick={() => setNovoTipo(t)}>{ROTULO_DONO[t]}</Pilula>
                    ))}
                  </div>
                </Campo>
                <Campo rotulo="Chave Pix (pode deixar pra depois)"><Input value={novoPix} onChange={(e) => setNovoPix(e.target.value)} placeholder="CPF, CNPJ, e-mail ou telefone" /></Campo>
                <p className="text-[12px] text-muted-foreground">O dono não precisa ter conta no Cria. Ele só aparece aqui pra você acompanhar e pagar.</p>
              </>
            )}
            {modoDono === "nenhum" && <p className="text-[12.5px] text-muted-foreground">Cupom de campanha: o cliente ganha o desconto e ninguém recebe comissão.</p>}
          </Passo>

          <Passo n={2} titulo="O que o cliente ganha">
            <Campo rotulo="Código">
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                placeholder="RIZO20" className="font-mono uppercase" maxLength={24} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Desconto (%)"><Input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></Campo>
              <Campo rotulo="Meses grátis antes"><Input inputMode="numeric" value={gratis} onChange={(e) => setGratis(e.target.value)} /></Campo>
            </div>
            {descontoPct > 0 && (
              <Campo rotulo="Por quanto tempo">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pilula ativo={duracao === "primeira"} onClick={() => setDuracao("primeira")}>1ª mensalidade</Pilula>
                  <Pilula ativo={duracao === "meses"} onClick={() => setDuracao("meses")}>N meses</Pilula>
                  {duracao === "meses" && <Input inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value)} className="w-20 h-8" />}
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-1">Até 36 meses. Desconto pra sempre não existe aqui de propósito.</p>
              </Campo>
            )}
            <Campo rotulo="Vale pra">
              <div className="flex flex-wrap gap-1.5">
                {(["essencial", "pro", "studio"] as const).map((p) => (
                  <Pilula key={p} ativo={planos.includes(p)}
                    onClick={() => setPlanos((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]))}>
                    {p === "essencial" ? "Essencial" : p === "pro" ? "Pro" : "Studio"}
                  </Pilula>
                ))}
              </div>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Limite de usos"><Input inputMode="numeric" value={limite} onChange={(e) => setLimite(e.target.value.replace(/\D/g, ""))} placeholder="sem limite" /></Campo>
              <Campo rotulo="Vale até"><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></Campo>
            </div>
          </Passo>

          <Passo n={3} titulo="O que o dono recebe">
            {semDono ? (
              <p className="text-[12.5px] text-muted-foreground">Sem dono, sem comissão.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Pilula ativo={tipoRegra === "pct"} onClick={() => setTipoRegra("pct")}>% da mensalidade</Pilula>
                  <Pilula ativo={tipoRegra === "fixo"} onClick={() => setTipoRegra("fixo")}>Valor fixo</Pilula>
                  <Pilula ativo={tipoRegra === "nenhuma"} onClick={() => setTipoRegra("nenhuma")}>Nada</Pilula>
                </div>
                {tipoRegra !== "nenhuma" && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {tipoRegra === "pct"
                        ? <Campo rotulo="Percentual"><Input inputMode="decimal" value={regraPct} onChange={(e) => setRegraPct(e.target.value)} /></Campo>
                        : <Campo rotulo="Valor (R$)"><MoneyInput value={regraFixo} onChange={setRegraFixo} /></Campo>}
                      <Campo rotulo="Da mensalidade">
                        <Input inputMode="numeric" value={de} onChange={(e) => { const v = Math.max(1, Math.min(36, Number(e.target.value) || 1)); setDe(v); if (ate < v) setAte(v); }} />
                      </Campo>
                      <Campo rotulo="Até a">
                        <Input inputMode="numeric" value={ate} onChange={(e) => setAte(Math.max(de, Math.min(60, Number(e.target.value) || de)))} />
                      </Campo>
                    </div>
                    <div>
                      <div className="grid grid-cols-12 gap-1">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <button key={m} type="button" onClick={() => clicarRegua(m)}
                            className={cn("h-8 rounded-md border-2 text-[11px] font-extrabold", m >= de && m <= ate ? "bg-[#EA4918] text-white" : "bg-white")}
                            style={{ borderColor: TINTA }}>{m}</button>
                        ))}
                      </div>
                      <p className="text-[11.5px] text-muted-foreground mt-1">Toque no começo e depois no fim. Mensalidade conta só fatura paga.</p>
                    </div>
                  </>
                )}
              </>
            )}
            <div className="flex flex-wrap gap-1.5">
              {ATALHOS.map((a) => (
                <button key={a.nome} type="button" onClick={() => aplicarAtalho(a)}
                  className="rounded-xl border-2 bg-white px-2.5 py-1.5 text-left hover:bg-[#F4EDDF]" style={{ borderColor: TINTA }}>
                  <span className="block text-[11.5px] font-extrabold">{a.nome}</span>
                  <span className="block text-[11px] text-muted-foreground">{a.texto}</span>
                </button>
              ))}
            </div>
            {exemplo && (
              <p className="rounded-xl border-2 border-dashed p-3 text-[12.5px] leading-snug bg-[#FFF8D6]" style={{ borderColor: TINTA }}>{exemplo}</p>
            )}
            {!semDono && tipoRegra !== "nenhuma" && (
              <p className="text-[12px] font-bold">Resumo: {textoRegra({ tipo: tipoRegra, pct: num(regraPct), fixo_cents: Math.round((regraFixo ?? 0) * 100), de, ate })}</p>
            )}
          </Passo>
        </div>
        <div className="fixed bottom-0 right-0 w-full sm:max-w-[520px] border-t-2 bg-[#FBF7EF] p-3 flex justify-end gap-2" style={{ borderColor: TINTA }}>
          <BotaoAcao onClick={aoFechar}>Cancelar</BotaoAcao>
          <BotaoAcao primario disabled={salvando || codigo.trim().length < 3} onClick={criar}>
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Criar e publicar na Stripe
          </BotaoAcao>
        </div>
      </SheetContent>
    </Sheet>
  );
}
