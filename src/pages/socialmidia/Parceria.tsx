import { useState } from "react";
import { Handshake, Check, Clock, Ticket, TrendingUp, LineChart, HeartHandshake, Share2, Wallet } from "lucide-react";
import { usePartner } from "@/hooks/usePartner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/CopyButton";
import { PartnerApplyDrawer } from "@/components/accounts/PartnerApplyDrawer";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";

// Paleta oficial (a mesma da LP e do relatório) pros acentos da página.
const P = { laranja: "#EA4918", verde: "#01A652", azul: "#0061EE", rosa: "#FF77B9", amarelo: "#FFCF03", creme: "#F6F2E8" };

export default function Parceria() {
  const { partner, isPartner, isPending: isPartnerPending } = usePartner();
  const [partnerOpen, setPartnerOpen] = useState(false);
  return (
    <div>
      <ManagerSectionTitle t="Parceria" s="Indique o Cria pros seus clientes e ganhe comissão recorrente." />
      {/* Os alvos do tour (parceria-programa e parceria-acao) aparecem nos três
          estados da tela: parceira aprovada, em análise e ainda não parceira.
          Só um ramo existe no DOM por vez, então o passo sempre acha o alvo. */}
      {isPartner ? (
        <div data-tour="parceria-programa" className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-card px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Handshake className="h-4 w-4 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-semibold text-foreground flex items-center gap-2">Você é parceira <span aria-hidden>🎉</span></p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">Compartilhe seu cupom com seus clientes.</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-body font-semibold shrink-0"><Check className="h-3 w-3" /> Aprovada</span>
          </div>
          {partner?.coupon_code && (
            <div data-tour="parceria-acao" className="rounded-xl border border-primary/30 bg-background/60 px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Ticket className="h-5 w-5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Seu cupom{partner.coupon_type === "client_discount" && partner.coupon_discount_pct ? ` · ${partner.coupon_discount_pct}% off` : ""}</p>
                <p className="text-lg font-display font-extrabold text-foreground tracking-wider truncate">{partner.coupon_code}</p>
              </div>
              <CopyButton text={partner.coupon_code} />
            </div>
          )}
        </div>
      ) : isPartnerPending ? (
        <div data-tour="parceria-programa" className="rounded-2xl border border-border bg-card/50 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><Clock className="h-4 w-4 text-amber-600" /></div>
          <div><p className="text-sm font-display font-semibold text-foreground">Solicitação em análise</p><p className="text-xs text-muted-foreground font-body mt-0.5">Vamos te avisar assim que aprovarmos seu cadastro.</p></div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Hero no estilo Cria: creme + formas orgânicas + pitch direto ── */}
          <div data-tour="parceria-programa" className="relative overflow-hidden rounded-3xl border border-border px-6 py-8 sm:px-10 sm:py-10" style={{ background: P.creme }}>
            <span className="absolute -top-14 -right-10 w-44 h-44 rounded-full" style={{ background: P.rosa }} aria-hidden />
            <span className="absolute -bottom-16 -left-12 w-44 h-44 rounded-full" style={{ background: P.amarelo }} aria-hidden />
            <span className="absolute top-1/2 right-16 w-7 h-7 rounded-full hidden sm:block" style={{ background: P.verde }} aria-hidden />
            <div className="relative max-w-xl">
              <span className="inline-block text-[10px] font-body font-bold uppercase tracking-widest text-white px-3 py-1.5 rounded-full" style={{ background: P.laranja }}>
                Programa de parceria
              </span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-display font-extrabold text-[#1a1a2e] leading-tight">
                Você já recomenda ferramenta boa de graça.
                <span className="block" style={{ color: P.laranja }}>Aqui, a recomendação vira renda todo mês.</span>
              </h2>
              <p className="mt-3 text-sm font-body text-[#6b7280] leading-relaxed">
                Indique o Cria pros seus clientes e pra quem vive de conteúdo. Enquanto a pessoa
                seguir assinante, a comissão cai recorrente pra você. Sem meta, sem custo, sem pegadinha.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button data-tour="parceria-acao" size="lg" onClick={() => setPartnerOpen(true)}>Quero ser parceira</Button>
                <span className="text-[11px] font-body text-[#6b7280]">Leva 1 minuto. A gente aprova rapidinho.</span>
              </div>
            </div>
          </div>

          {/* ── Como funciona: 3 passos ── */}
          <div className="rounded-2xl border border-border bg-card px-5 py-5">
            <p className="text-sm font-display font-bold text-foreground mb-4">Como funciona</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { n: "1", cor: P.rosa, icon: Ticket, t: "Peça seu cupom", d: "Você ganha um código só seu, com desconto pra quem você indicar." },
                { n: "2", cor: P.azul, icon: Share2, t: "Compartilhe", d: "Manda pros seus clientes, colegas social mídias e criadores da sua rede." },
                { n: "3", cor: P.verde, icon: Wallet, t: "Receba todo mês", d: "Assinou com seu cupom, virou comissão recorrente enquanto a assinatura durar." },
              ].map(({ n, cor, icon: Icon, t, d }) => (
                <div key={n} className="relative rounded-2xl border border-border bg-background p-4 pt-5">
                  <span className="absolute -top-3 left-4 w-7 h-7 rounded-full text-white text-xs font-display font-extrabold flex items-center justify-center" style={{ background: cor }}>{n}</span>
                  <Icon className="h-5 w-5 mb-2" style={{ color: cor }} />
                  <p className="text-sm font-display font-semibold text-foreground">{t}</p>
                  <p className="text-xs font-body text-muted-foreground mt-1 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Por que vale a pena ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { cor: P.laranja, icon: TrendingUp, t: "Renda que se acumula", d: "Cada indicação ativa soma na próxima. Três clientes indicados já viram uma renda extra que chega todo mês, sem você produzir nada a mais." },
              { cor: P.verde, icon: HeartHandshake, t: "Seu cliente também ganha", d: "O cupom dá vantagem pra quem entra. Você indica algo que melhora a rotina do cliente e ainda fica bem na foto." },
              { cor: P.azul, icon: LineChart, t: "Acompanhamento transparente", d: "Painel com suas indicações, carência e valores recebidos. Nada de planilha nem de cobrar ninguém." },
              { cor: P.rosa, icon: Handshake, t: "Sem meta e sem custo", d: "Não tem mínimo de indicações nem mensalidade de parceira. Indicou quando quiser, ganhou quando converter." },
            ].map(({ cor, icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-border bg-card p-4 flex gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cor}1A` }}>
                  <Icon className="h-5 w-5" style={{ color: cor }} />
                </span>
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">{t}</p>
                  <p className="text-xs font-body text-muted-foreground mt-1 leading-relaxed">{d}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Dúvidas rápidas ── */}
          <div className="rounded-2xl border border-border bg-card px-5 py-4">
            <p className="text-sm font-display font-bold text-foreground mb-2">Dúvidas rápidas</p>
            {[
              ["Pra quem faz sentido?", "Social mídias e agências que querem monetizar a própria rede: clientes, colegas de área, mentorados e criadores que já pedem indicação de ferramenta."],
              ["Como e quando eu recebo?", "As regras de comissão, carência e repasse aparecem no seu painel de parceira assim que o cadastro é aprovado, tudo às claras antes de você divulgar."],
              ["Até quando eu ganho pela indicação?", "Enquanto a pessoa que usou seu cupom seguir assinante do Cria. Cancelou, para; voltou, volta."],
            ].map(([q, a]) => (
              <details key={q} className="border-b border-border last:border-0 py-2.5">
                <summary className="cursor-pointer text-[13px] font-body font-semibold text-foreground list-none [&::-webkit-details-marker]:hidden">{q}</summary>
                <p className="mt-1.5 text-xs font-body text-muted-foreground leading-relaxed">{a}</p>
              </details>
            ))}
            <div className="pt-3">
              <Button variant="outline" onClick={() => setPartnerOpen(true)}>Começar minha parceria</Button>
            </div>
          </div>
        </div>
      )}
      <PartnerApplyDrawer open={partnerOpen} onOpenChange={setPartnerOpen} />
    </div>
  );
}
