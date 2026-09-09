import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Boxes, Briefcase, Clock, Layers, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { useProfile } from "@/hooks/useProfile";
import { MODULE_ICON, useManagerOutlet } from "@/components/accounts/ManagerLayout";
import { useModules } from "@/hooks/useModules";
import { ROTULO_PAPEL, useFilaDoParceiro, useMeusCaches, useMinhasAgencias, useMinhasMarcas } from "@/hooks/useParceiro";
import { CardAbertoDialog } from "@/pages/app/MinhasDemandas";
import { hojeBR } from "@/lib/date-br";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   A HOME DO PARCEIRO PURO (designer, editor, copy, tráfego)

   Até a auditoria de 07/09 quem só produz pras agências caía na home da
   social mídia: "0 clientes", "R$ 0 no mês", "Aguardando aprovação 0". Um
   painel inteiro dizendo que a pessoa não tem nada, no primeiro dia. Aqui a
   home responde as três perguntas dela: o que vence hoje, com quem trabalho
   e quanto tenho a receber. Os módulos do Cria ficam como convite, no fim.
   ═══════════════════════════════════════════════════════════════════════════ */

const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* Uma cor por módulo, a mesma família das seis da LP. Card branco com texto
   cinza não diferencia nada: o ícone colorido é o que faz a pessoa reconhecer
   o módulo de longe (Walter, 09/09/2026). */
const COR_MODULO: Record<string, { fundo: string; tinta: string }> = {
  aprovapost_externo: { fundo: "bg-blue-100", tinta: "text-blue-700" },
  crm: { fundo: "bg-violet-100", tinta: "text-violet-700" },
  financeiro: { fundo: "bg-green-100", tinta: "text-green-700" },
  hub_cria: { fundo: "bg-amber-100", tinta: "text-amber-700" },
  cria_captacao: { fundo: "bg-pink-100", tinta: "text-pink-700" },
};

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function ParceiroHome() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { openModule } = useManagerOutlet();
  const { modules } = useModules();
  const { data: fila = [] } = useFilaDoParceiro();
  const { data: agencias = [] } = useMinhasAgencias();
  const { data: caches = [] } = useMeusCaches();
  const { data: marcas = [] } = useMinhasMarcas();
  /* A home abre o CARD, não empurra pra lista. Antes toda linha levava pra
     "Minhas demandas" e a pessoa tinha que achar de novo o que já estava
     olhando (Walter, 09/09/2026). */
  const [abrirCard, setAbrirCard] = useState<string | null>(null);
  const hoje = hojeBR();

  const venceHoje = fila.filter((c) => c.prazo_producao === hoje);
  const atrasadas = fila.filter((c) => c.prazo_producao && c.prazo_producao < hoje);
  const prazosPraConfirmar = fila.filter((c) => c.prazo_status === "proposto").length;
  const emAjuste = fila.filter((c) => c.producao_status === "ajuste").length;
  const aReceber = caches.reduce((s, c) => s + Number(c.pendente ?? 0), 0);
  const papel = agencias[0]?.meu_papel ? ROTULO_PAPEL[agencias[0].meu_papel] ?? agencias[0].meu_papel : "Parceiro";
  const primeiroNome = (profile?.name ?? "").trim().split(" ")[0];

  // O que pede ação AGORA, em ordem de urgência. Cada linha é um atalho.
  const pendencias: { txt: string; tom: "vermelho" | "ambar" | "violeta" }[] = [];
  if (atrasadas.length) pendencias.push({ txt: `${atrasadas.length} entrega${atrasadas.length > 1 ? "s" : ""} atrasada${atrasadas.length > 1 ? "s" : ""}`, tom: "vermelho" });
  if (venceHoje.length) pendencias.push({ txt: `${venceHoje.length} vence${venceHoje.length > 1 ? "m" : ""} hoje`, tom: "vermelho" });
  if (prazosPraConfirmar) pendencias.push({ txt: `${prazosPraConfirmar} prazo${prazosPraConfirmar > 1 ? "s" : ""} pra confirmar`, tom: "ambar" });
  if (emAjuste) pendencias.push({ txt: `${emAjuste} voltou pra ajuste`, tom: "violeta" });

  // Módulos que ele pode contratar (sem add-ons de uso).
  const vitrine = modules.filter((m) =>
    m.status !== "active" && m.status !== "past_due" && !m.coming_soon &&
    m.code !== "hub_extra" && !m.code.endsWith("_extra"));

  return (
    <div className="pb-20 md:pb-0">
      {/* ── ABERTURA: saudação + as pendências de hoje ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-7 mb-5">
        <OrganicBlobs color="lilas" />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{papel}</p>
          <h1 className="font-display font-extrabold text-2xl sm:text-[28px] leading-tight mt-1">
            {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}.
          </h1>
          <p className="text-sm font-body text-muted-foreground mt-1.5 max-w-lg">
            {fila.length === 0
              ? "Sua fila está vazia. Quando uma agência te mandar uma peça, ela aparece aqui com prazo, material e legenda."
              : pendencias.length === 0
                ? `${fila.length} peça${fila.length > 1 ? "s" : ""} na sua mão e nada vencendo hoje. Dia tranquilo.`
                : "Hoje pede atenção:"}
          </p>
          {pendencias.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {pendencias.map((p) => (
                <button key={p.txt} type="button" onClick={() => navigate("/socialmidia/demandas")}
                  className={cn("text-[12px] font-bold px-3 py-1.5 rounded-full transition-transform hover:scale-[1.03]",
                    p.tom === "vermelho" && "bg-red-100 text-red-800",
                    p.tom === "ambar" && "bg-amber-100 text-amber-800",
                    p.tom === "violeta" && "bg-violet-100 text-violet-800")}>
                  {p.txt}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── OS TRÊS NÚMEROS: fila, agências, a receber ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { v: String(fila.length), l: "na sua fila", Icone: Briefcase, cor: "bg-violet-100 text-violet-700", to: "/socialmidia/demandas" },
          { v: String(agencias.length), l: agencias.length === 1 ? "agência te acoplou" : "agências te acoplaram", Icone: Layers, cor: "bg-pink-100 text-pink-700", to: "/socialmidia/marcas" },
          { v: brl(aReceber), l: "a receber de cachês", Icone: Wallet, cor: "bg-green-100 text-green-700", to: "/socialmidia/marcas" },
        ].map((k) => (
          <button key={k.l} type="button" onClick={() => navigate(k.to)}
            className="rounded-2xl border border-border bg-card p-4 text-left flex items-center gap-3 hover:shadow-md transition-shadow">
            <span className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0", k.cor)}><k.Icone className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block font-display font-extrabold text-xl leading-none truncate">{k.v}</span>
              <span className="block text-[11.5px] font-body font-semibold text-muted-foreground mt-1">{k.l}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
          </button>
        ))}
      </div>

      {/* ── A FILA DE HOJE (as 5 mais urgentes) ── */}
      {fila.length > 0 && (
        <Card className="rounded-2xl border-border overflow-hidden mb-5">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-display font-bold text-[15px] flex items-center gap-2"><Clock className="h-4 w-4 text-violet-600" /> Próximas entregas</p>
            <button type="button" onClick={() => navigate("/socialmidia/demandas")} className="text-[12px] font-bold text-primary">Ver a fila toda</button>
          </div>
          <ul className="divide-y divide-border">
            {fila.slice(0, 5).map((c) => {
              const atrasado = !!c.prazo_producao && c.prazo_producao < hoje;
              const ehHoje = c.prazo_producao === hoje;
              return (
                <li key={c.post_id}>
                  <button type="button" onClick={() => setAbrirCard(c.post_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
                    <span className="w-9 h-9 rounded-xl grid place-items-center text-white font-display font-bold text-sm shrink-0 overflow-hidden"
                      style={{ background: c.cliente_cor || "#7C90F0" }}>
                      {c.cliente_logo ? <img src={c.cliente_logo} alt="" className="w-full h-full object-cover" /> : (c.cliente_nome || "C").charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-bold text-[13.5px] leading-tight truncate">{c.titulo || "Sem título"}</span>
                      <span className="block text-[11px] font-body text-muted-foreground truncate">
                        {c.cliente_nome} · via {c.agencia_nome}
                        {/* HÁ QUANTOS DIAS ESTÁ NA MÃO DELE: o dado existia no
                            banco (assigned_at) e nenhuma tela mostrava. É o que
                            diz se a peça está encostando (Walter, 09/09/2026). */}
                        {c.assigned_at && (() => {
                          const dias = Math.floor((Date.now() - new Date(c.assigned_at).getTime()) / 86400000);
                          return dias >= 1 ? ` · há ${dias} dia${dias > 1 ? "s" : ""} com você` : "";
                        })()}
                      </span>
                      <span className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {c.formato && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-foreground text-background capitalize">{c.formato}</span>}
                        {c.plataforma && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{c.plataforma}</span>}
                        {c.prazo_status === "proposto" && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">confirmar prazo</span>}
                        {c.producao_status === "ajuste" && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">voltou pra ajuste</span>}
                      </span>
                    </span>
                    <span className={cn("text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      atrasado ? "bg-red-600 text-white" : ehHoje ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground")}>
                      {!c.prazo_producao ? "sem prazo" : atrasado ? "atrasada" : ehHoje ? "hoje" : `${c.prazo_producao.slice(8, 10)}/${c.prazo_producao.slice(5, 7)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ── COMO FUNCIONA (só enquanto a fila está vazia) ── */}
      {fila.length === 0 && (
        <Card className="rounded-2xl border-dashed border-border p-5 mb-5">
          <p className="font-display font-bold text-[15px] mb-3">Como funciona o seu lado do Cria</p>
          <ol className="space-y-2.5">
            {[
              ["A agência delega", "Ela abre o post dela e manda pra você, com prazo, legenda, material e cachê combinado."],
              ["Você produz aqui", "A peça entra na sua fila. Aceite ou negocie o prazo, converse no card, marque como entregue com o arquivo ou o link."],
              ["A agência revisa e paga", "Ela leva pro cliente aprovar. O cachê nasce no Caixa dela na hora que você entrega e aparece em Meus cachês."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="h-6 w-6 rounded-full bg-violet-600 text-white text-[11px] font-bold grid place-items-center shrink-0">{i + 1}</span>
                <span>
                  <span className="block text-[13.5px] font-body font-bold">{t}</span>
                  <span className="block text-[12.5px] font-body text-muted-foreground leading-relaxed">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* ── AS MARCAS QUE PASSAM PELA MINHA MÃO ──
           Atalho pra ficha de cada uma (cor, fontes, hashtags, o que evitar).
           Antes essa informação vinha repetida dentro de cada card de peça e a
           home não dizia nem quais marcas ele atende. */}
      {marcas.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
            <p className="font-display font-bold text-[15px] flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Suas marcas
            </p>
            <button type="button" onClick={() => navigate("/socialmidia/marcas")} className="text-[12px] font-bold text-primary">Ver as fichas</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {marcas.slice(0, 8).map((m) => (
              <button key={m.external_client_id} type="button" onClick={() => navigate("/socialmidia/marcas")}
                className="shrink-0 w-[150px] rounded-2xl border border-border bg-card overflow-hidden text-left hover:border-primary/40 transition-colors">
                <span className="block h-1.5" style={{ background: m.cor || "#4B3FA8" }} />
                <span className="flex items-center gap-2 p-2.5">
                  <span className="w-7 h-7 rounded-full border border-border bg-background overflow-hidden grid place-items-center shrink-0"
                    style={{ background: m.logo ? undefined : (m.cor || "#4B3FA8") }}>
                    {m.logo
                      ? <img src={m.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
                      : <span className="text-white font-display font-bold text-[11px]">{m.nome.charAt(0).toUpperCase()}</span>}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display font-bold text-[12px] truncate">{m.nome}</span>
                    <span className="block text-[10px] font-body text-muted-foreground">
                      {m.abertos > 0 ? `${m.abertos} na sua mão` : "em dia"}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── MÓDULOS DO CRIA: o "ir além" pros clientes diretos ──
           id="modulos": o item "Módulos do Cria" do menu abre a home e rola até
           aqui. Antes ele largava a pessoa no topo do dashboard e a vitrine
           ficava escondida no rodapé (Walter, 09/09/2026). */}
      {vitrine.length > 0 && (
        <section id="modulos" className="scroll-mt-24 relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-6">
          {/* A faixa era quatro caixas brancas de texto corrido, e o quinto
              módulo nem aparecia por causa de um slice(0,4) (Walter,
              09/09/2026: "tá parecendo um lixo morto"). Agora cada módulo tem
              o ÍCONE do menu, a cor dele e o preço na cara, sobre a mesma
              linguagem orgânica da LP. */}
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/[0.07]" />
          <span aria-hidden className="pointer-events-none absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-amber-400/[0.09]" />
          <div className="relative">
            <p className="flex items-center gap-2 mb-1.5">
              <Boxes className="h-[18px] w-[18px] text-primary" />
              <span className="font-display font-extrabold text-[17px]">Tem cliente direto também?</span>
            </p>
            <p className="text-[12.5px] font-body text-muted-foreground mb-4 max-w-2xl leading-relaxed">
              O trabalho que vem das agências é <b className="text-foreground">sempre grátis</b> pra você.
              Estes módulos são pra quando o cliente é seu: você ativa só o que usa, e cancela quando quiser.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vitrine.map((m) => {
                const Icone = MODULE_ICON[m.code] ?? Boxes;
                const cor = COR_MODULO[m.code] ?? { fundo: "bg-primary/10", tinta: "text-primary" };
                return (
                  <button key={m.code} type="button" onClick={() => openModule(m)}
                    className="group relative text-left rounded-2xl border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40">
                    <span className="flex items-start gap-3">
                      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", cor.fundo, cor.tinta)}>
                        <Icone className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display font-extrabold text-[14.5px] leading-tight">{m.name}</span>
                        <span className="block text-[11.5px] font-body text-muted-foreground mt-1 leading-snug line-clamp-3">
                          {m.description ?? "Conhecer o módulo"}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center justify-between mt-3 pt-3 border-t border-border/70">
                      <span className="text-[12px] font-body font-bold text-foreground">
                        {m.price_cents > 0
                          ? <>{brl(m.price_cents / 100)}<span className="font-normal text-muted-foreground">/mês</span></>
                          : "Grátis"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11.5px] font-body font-bold text-primary">
                        conhecer <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
      {/* O card abre AQUI, sem tirar a pessoa da home. */}
      <CardAbertoDialog postId={abrirCard} aoFechar={() => setAbrirCard(null)} />
    </div>
  );
}
