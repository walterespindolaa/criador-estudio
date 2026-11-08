/* ═══════════════════════════════════════════════════════════════════════════
   PILOTO (aba inicial do admin, 08/11/2026). Mockup aprovado:
   mockup-admin-piloto-v2. Etapa 2: leitura e ações que já existem no app.
   Ações que mexem em conta (estender teste, e-mail em massa, cupom) chegam na
   etapa 3 e aparecem desabilitadas com aviso.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CalendarRange, Clock, Copy, Hourglass, Mail, Megaphone, RefreshCw, Sparkles, UserX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ORIGENS, USD_BRL, anteriorDe, brl, delta, diasDesde, intervaloDo, num, origemDoCadastro, useResumoPiloto,
  type Origem, type PeriodoChave, type Resumo,
} from "./usePiloto";
import { BotaoAcao, Cartao, ChipDelta, Etiqueta, MAO, Pilula, Secao, TINTA } from "./pecas";
import { CartaoErros, CartaoIA, FunilPiloto, GraficoVisitas, TabelaAnuncios } from "./PilotoBlocos";

const PROXIMA = "Chega na próxima etapa do Piloto";

export function AdminPiloto({ aoAbrirConta }: { aoAbrirConta: (id: string) => void }) {
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<PeriodoChave>("7d");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const [comparar, setComparar] = useState(true);
  const [origens, setOrigens] = useState<Origem[]>(ORIGENS.map((o) => o.valor));

  // Recalcula o intervalo quando muda o filtro (e a cada atualização de hora).
  const [tique, setTique] = useState(0);
  const intervalo = useMemo(() => intervaloDo(periodo, custom), [periodo, custom, tique]); // eslint-disable-line react-hooks/exhaustive-deps
  const antes = useMemo(() => anteriorDe(intervalo), [intervalo]);

  const atual = useResumoPiloto(intervalo);
  const anterior = useResumoPiloto(antes, comparar);
  // A fila olha 30 dias pra trás: quem está terminando o teste se cadastrou há uns 7.
  const ultimos30 = useMemo(() => intervaloDo("30d"), [tique]); // eslint-disable-line react-hooks/exhaustive-deps
  const base30 = useResumoPiloto(ultimos30);

  const r = atual.data;
  const a = comparar ? anterior.data : undefined;
  const atualizadoEm = atual.dataUpdatedAt ? new Date(atual.dataUpdatedAt) : null;
  const proxima = atualizadoEm ? new Date(atualizadoEm.getTime() + 3600000) : null;
  const hhmm = (d: Date | null) => d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";

  const atualizarAgora = () => {
    setTique((t) => t + 1);
    void qc.invalidateQueries({ queryKey: ["piloto-resumo"] });
  };
  const alternarOrigem = (o: Origem) =>
    setOrigens((l) => (l.includes(o) ? (l.length > 1 ? l.filter((x) => x !== o) : l) : [...l, o]));

  return (
    <div className="pb-16">
      {/* ── Barra de controle (presa no topo) ── */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-3 mb-4 bg-background/95 backdrop-blur border-b-2" style={{ borderColor: TINTA }}>
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground shrink-0">Período</span>
          {([["hoje", "Hoje"], ["ontem", "Ontem"], ["7d", "7 dias"], ["30d", "30 dias"], ["custom", "Escolher datas"]] as [PeriodoChave, string][]).map(([v, t]) => (
            <Pilula key={v} ativo={periodo === v} onClick={() => setPeriodo(v)}>
              {v === "custom" && <CalendarRange className="h-3.5 w-3.5" />}{t}
            </Pilula>
          ))}
          {periodo === "custom" && (
            <span className="flex items-center gap-1.5 shrink-0">
              <input type="date" value={custom.de} onChange={(e) => setCustom((c) => ({ ...c, de: e.target.value }))} className="rounded-full border-2 px-2 py-0.5 text-[12px]" style={{ borderColor: TINTA }} />
              <span className="text-[12px]">a</span>
              <input type="date" value={custom.ate} onChange={(e) => setCustom((c) => ({ ...c, ate: e.target.value }))} className="rounded-full border-2 px-2 py-0.5 text-[12px]" style={{ borderColor: TINTA }} />
            </span>
          )}
          <label className="ml-2 inline-flex items-center gap-2 text-[12.5px] font-bold shrink-0 cursor-pointer">
            <input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} className="h-4 w-4 accent-[#00A652]" />
            comparar com o período anterior
          </label>
          <span className="ml-auto flex items-center gap-2 shrink-0 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> atualizado às <b className="text-foreground">{hhmm(atualizadoEm)}</b> · próxima às <b className="text-foreground">{hhmm(proxima)}</b>
            <BotaoAcao onClick={atualizarAgora}><RefreshCw className={cn("h-3.5 w-3.5", atual.isFetching && "animate-spin")} /> atualizar agora</BotaoAcao>
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] mt-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground shrink-0">Origem</span>
          <Pilula ativo={origens.length === ORIGENS.length} onClick={() => setOrigens(ORIGENS.map((o) => o.valor))}>todas</Pilula>
          {ORIGENS.map((o) => (
            <Pilula key={o.valor} ativo={origens.length < ORIGENS.length && origens.includes(o.valor)} onClick={() => origens.length === ORIGENS.length ? setOrigens([o.valor]) : alternarOrigem(o.valor)}>
              <i className="inline-block h-2 w-2 rounded-full" style={{ background: o.cor }} />{o.rotulo}
            </Pilula>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-display font-extrabold text-[30px] leading-none">Piloto</h2>
        <span className="text-[22px] leading-none text-[#EA4918]" style={MAO}>o que precisa de você agora</span>
      </div>

      {atual.isLoading && <p className="text-sm text-muted-foreground mt-6">Carregando o painel...</p>}
      {atual.error && (
        <Cartao className="mt-6" cor="#FFF4D6">
          <p className="text-sm"><b>Não consegui carregar o Piloto.</b> {(atual.error as Error).message}</p>
        </Cartao>
      )}

      {r && (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <FilaHoje base={base30.data} atual={r} aoAbrirConta={aoAbrirConta} />
            <FaixaAgora atual={r} anterior={a} origens={origens} />
          </div>

          <Secao titulo="Tráfego" mao="de onde a gente está vindo" />
          <GraficoVisitas atual={r} anterior={a} origens={origens} />
          <div className="mt-4"><TabelaAnuncios resumo={r} /></div>

          <Secao titulo="Jornada" mao="clique numa etapa pra ver quem parou nela" />
          <FunilPiloto resumo={r} origens={origens} aoAbrirConta={aoAbrirConta} />

          <Secao titulo="Cria IA e erros" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div id="piloto-ia"><CartaoIA resumo={r} /></div>
            <div id="piloto-erros"><CartaoErros resumo={r} /></div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Faixa "Agora" ───────────────────────────────────────────────────────────
function FaixaAgora({ atual, anterior, origens }: { atual: Resumo; anterior?: Resumo; origens: Origem[] }) {
  const somaVisitas = (r?: Resumo, so?: Origem[]) =>
    r?.visitas_por_hora.reduce((s, h) => s + (so ?? origens).reduce((t, o) => t + (h[o] ?? 0), 0), 0);
  const cads = (r?: Resumo) => r?.cadastros.filter((c) => origens.includes(origemDoCadastro(c)));
  const erros = (r?: Resumo) => r?.erros.reduce((s, e) => s + e.vezes, 0);
  const itens: { rotulo: string; valor: number; antes?: number; cor: string; sub?: string; inverte?: boolean }[] = [
    { rotulo: "Visitas no site", valor: somaVisitas(atual) ?? 0, antes: somaVisitas(anterior), cor: "#C9DAFF" },
    { rotulo: "Link na bio", valor: somaVisitas(atual, ["bio"]) ?? 0, antes: somaVisitas(anterior, ["bio"]), cor: "#FFD3E8" },
    { rotulo: "Cliques no teste", valor: atual.funil.clicou_teste, antes: anterior?.funil.clicou_teste, cor: "#FFE46B",
      sub: atual.funil.visitas ? `${Math.round((atual.funil.clicou_teste / atual.funil.visitas) * 100)}% das visitas` : undefined },
    { rotulo: "Cadastros", valor: cads(atual)?.length ?? 0, antes: cads(anterior)?.length, cor: "#D8F2E0" },
    { rotulo: "Assinaturas", valor: atual.funil.assinou, antes: anterior?.funil.assinou, cor: "#fff" },
    { rotulo: "Erros", valor: erros(atual) ?? 0, antes: erros(anterior), cor: "#fff", inverte: true },
  ];
  return (
    <Cartao>
      <div className="flex items-center gap-2 mb-3">
        <h4 className="font-display font-extrabold text-[16px]">Agora</h4>
        {anterior && <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">vs período anterior</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {itens.map((i) => {
          const d = delta(i.valor, i.antes);
          const dd = d && i.inverte ? { ...d, sobe: !d.sobe } : d;
          return (
            <div key={i.rotulo} className="rounded-xl border-2 p-3" style={{ borderColor: TINTA, background: i.cor, boxShadow: `2px 2px 0 ${TINTA}` }}>
              <span className="block text-[10.5px] font-extrabold uppercase tracking-wide opacity-75">{i.rotulo}</span>
              <div className="flex items-center gap-2 mt-1">
                <b className="font-display text-[26px] leading-none tabular-nums">{num(i.valor)}</b>
                {anterior && <ChipDelta d={dd} />}
              </div>
              {i.sub && <span className="block text-[11px] mt-1 opacity-75">{i.sub}</span>}
            </div>
          );
        })}
      </div>
    </Cartao>
  );
}

// ── "Hoje eu preciso..." ────────────────────────────────────────────────────
type Tarefa = { id: string; icone: ReactNode; area: string; cor: string; titulo: string; sub: string; acoes: ReactNode; peso: number };

function FilaHoje({ base, atual, aoAbrirConta }: { base?: Resumo; atual: Resumo; aoAbrirConta: (id: string) => void }) {
  const tarefas: Tarefa[] = [];
  const agora = Date.now();

  if (base) {
    const acabando = base.cadastros.filter((c) => {
      if (!c.trial_ends_at || c.subscription_status === "active") return false;
      const falta = new Date(c.trial_ends_at).getTime() - agora;
      return falta > 0 && falta <= 3 * 86400000;
    });
    if (acabando.length) {
      const semUso = acabando.filter((c) => !c.ultimo_uso).length;
      tarefas.push({
        id: "acabando", icone: <Hourglass className="h-4 w-4" />, area: "Dinheiro", cor: "#D8F2E0", peso: 100,
        titulo: `${acabando.length} ${acabando.length === 1 ? "teste acaba" : "testes acabam"} em até 3 dias${semUso ? `; ${semUso} nunca ${semUso === 1 ? "usou" : "usaram"} nada` : ""}`,
        sub: acabando.slice(0, 4).map((c) => c.name?.split(" ")[0] ?? "sem nome").join(", "),
        acoes: <>
          <BotaoAcao onClick={() => aoAbrirConta(acabando[0].id)}>ver conta</BotaoAcao>
          <BotaoAcao disabled title={PROXIMA}><Mail className="h-3.5 w-3.5" /> e-mail de ajuda</BotaoAcao>
          <BotaoAcao disabled title={PROXIMA}>+3 dias</BotaoAcao>
        </>,
      });
    }
    const naoConfirmou = base.cadastros.filter((c) => !c.confirmou && (diasDesde(c.criado_em) ?? 0) >= 1);
    if (naoConfirmou.length) {
      tarefas.push({
        id: "confirmar", icone: <UserX className="h-4 w-4" />, area: "Jornada", cor: "#FFE46B", peso: 70,
        titulo: `${naoConfirmou.length} ${naoConfirmou.length === 1 ? "pessoa não confirmou" : "pessoas não confirmaram"} o e-mail`,
        sub: naoConfirmou.slice(0, 4).map((c) => `${c.name?.split(" ")[0] ?? "sem nome"} (${diasDesde(c.criado_em)}d)`).join(", "),
        acoes: <>
          <BotaoAcao onClick={() => aoAbrirConta(naoConfirmou[0].id)}>ver conta</BotaoAcao>
          <BotaoAcao disabled title={PROXIMA}>reenviar confirmação</BotaoAcao>
        </>,
      });
    }
    const travou = base.cadastros.filter((c) => c.confirmou && !c.onboarding && (diasDesde(c.criado_em) ?? 0) >= 1);
    if (travou.length) {
      tarefas.push({
        id: "onboarding", icone: <UserX className="h-4 w-4" />, area: "Jornada", cor: "#FFE46B", peso: 60,
        titulo: `${travou.length} ${travou.length === 1 ? "pessoa travou" : "pessoas travaram"} no onboarding`,
        sub: travou.slice(0, 4).map((c) => c.name?.split(" ")[0] ?? "sem nome").join(", "),
        acoes: <>
          <BotaoAcao onClick={() => aoAbrirConta(travou[0].id)}>ver conta</BotaoAcao>
          <BotaoAcao disabled title={PROXIMA}><Mail className="h-3.5 w-3.5" /> mandar mensagem</BotaoAcao>
        </>,
      });
    }
  }

  const queimando = atual.anuncios.filter((x) => (x.gasto ?? 0) > 30 && x.cadastros === 0).sort((x, y) => (y.gasto ?? 0) - (x.gasto ?? 0));
  if (queimando.length) {
    const g = queimando.reduce((s, x) => s + (x.gasto ?? 0), 0);
    const msg = `Fala! No período, ${queimando.length === 1 ? "o anúncio" : "os anúncios"} ${queimando.slice(0, 3).map((x) => `"${x.ad_nome}"`).join(", ")} ${queimando.length === 1 ? "gastou" : "gastaram"} ${brl(g)} e não ${queimando.length === 1 ? "trouxe" : "trouxeram"} nenhum cadastro. Dá pra pausar ou trocar o criativo?`;
    tarefas.push({
      id: "anuncio", icone: <Megaphone className="h-4 w-4" />, area: "Anúncio", cor: "#FFD3C2", peso: 90,
      titulo: `${queimando.length} ${queimando.length === 1 ? "anúncio gastou" : "anúncios gastaram"} ${brl(g)} sem nenhum cadastro`,
      sub: queimando.slice(0, 2).map((x) => x.ad_nome).join(", "),
      acoes: <>
        <a href={`https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${queimando.map((x) => x.ad_id).join(",")}`} target="_blank" rel="noreferrer">
          <BotaoAcao primario>abrir no Meta Ads</BotaoAcao>
        </a>
        <BotaoAcao onClick={() => { void navigator.clipboard.writeText(msg).then(() => toast.success("Mensagem copiada.")); }}>
          <Copy className="h-3.5 w-3.5" /> copiar msg pro gestor
        </BotaoAcao>
      </>,
    });
  }

  const novos = atual.erros.filter((e) => e.status === "novo");
  if (novos.length) {
    tarefas.push({
      id: "erros", icone: <AlertTriangle className="h-4 w-4" />, area: "Erro", cor: "#FFD3C2", peso: 80,
      titulo: `${novos.length} ${novos.length === 1 ? "erro novo" : "erros novos"} no app`,
      sub: novos[0].exemplo.slice(0, 90),
      acoes: <BotaoAcao onClick={() => document.getElementById("piloto-erros")?.scrollIntoView({ behavior: "smooth" })}>ver erros</BotaoAcao>,
    });
  }

  const custo = (atual.ia.total.custo_usd ?? 0) * USD_BRL;
  if (custo > 20) {
    tarefas.push({
      id: "ia", icone: <Sparkles className="h-4 w-4" />, area: "IA", cor: "#C9DAFF", peso: 50,
      titulo: `Custo da Cria IA em ${brl(custo)} no período`,
      sub: atual.ia.por_funcao[0] ? `Quem mais gasta: ${atual.ia.por_funcao[0].funcao}` : "",
      acoes: <BotaoAcao onClick={() => document.getElementById("piloto-ia")?.scrollIntoView({ behavior: "smooth" })}>ver uso</BotaoAcao>,
    });
  }

  tarefas.sort((x, y) => y.peso - x.peso);

  return (
    <Cartao>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h4 className="font-display font-extrabold text-[16px]">Hoje eu preciso...</h4>
        <span className="text-[19px] leading-none text-[#EA4918]" style={MAO}>{tarefas.length ? `${tarefas.length} ${tarefas.length === 1 ? "coisa" : "coisas"}, em ordem de impacto` : "nada urgente agora"}</span>
      </div>
      <div className="divide-y divide-dashed">
        {tarefas.length === 0 && <p className="text-sm text-muted-foreground py-4">Tudo em dia. O painel confere de novo na próxima hora.</p>}
        {tarefas.map((t) => (
          <div key={t.id} className="flex items-start gap-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2" style={{ borderColor: TINTA, background: t.cor }}>{t.icone}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Etiqueta cor={t.cor}>{t.area}</Etiqueta>
                <b className="text-[13.5px] leading-snug">{t.titulo}</b>
              </div>
              {t.sub && <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{t.sub}</p>}
              <div className="flex flex-wrap gap-2 mt-2">{t.acoes}</div>
            </div>
          </div>
        ))}
      </div>
    </Cartao>
  );
}
