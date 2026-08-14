import { useState } from "react";
import { useManagerProfile, useModuleCheckout, type ModuleWithStatus, type ManagerProfileInput } from "@/hooks/useModules";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { ManagerProfileForm } from "@/components/accounts/ManagerProfileForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, Check, Clock, Loader2, Send, Users2, Wallet, Radar, ArrowRight, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const ICONS: Record<string, typeof Sparkles> = { aprovapost_externo: Send, crm: Users2, financeiro: Wallet, hub_cria: Radar, hub_extra: Sparkles, cria_captacao: Camera };

// Onde cada módulo ABRE. Sem isto, o popup de um módulo ativo vira um beco sem
// saída: diz "assinatura ativa" e não oferece caminho nenhum.
const ROTA: Record<string, string> = {
  aprovapost_externo: "/socialmidia/criapost",
  crm: "/socialmidia/criacrm",
  financeiro: "/socialmidia/criacaixa",
  hub_cria: "/socialmidia/hubcria",
  cria_captacao: "/socialmidia/captacao",
};

// Cor de acento por módulo (paleta oficial): dá identidade a cada popup.
const COR: Record<string, string> = {
  aprovapost_externo: "#EA4918",
  crm: "#0061EE",
  financeiro: "#01A652",
  hub_cria: "#4B3FA8",
  hub_extra: "#EA4918",
  cria_captacao: "#FF77B9",
};

// ── Copy de venda por módulo: a DOR que a social mídia vive, a PROMESSA e o
// RESULTADO no fim do mês. Sem número inventado: só o que o módulo entrega. ──
const DOR: Record<string, string> = {
  aprovapost_externo: "Manda o post no WhatsApp, o cliente some, o feed atrasa e a aprovação vira caça ao “ok”.",
  crm: "Cliente na planilha, proposta no e-mail, follow-up na memória. Nesse esquema, sempre escapa alguém.",
  financeiro: "Quanto entra esse mês? Quem ainda não pagou? Se a resposta é “deixa eu ver na planilha”, tá caro.",
  hub_cria: "O cliente pergunta o que o concorrente anda fazendo e a resposta não pode ser achismo.",
  cria_captacao: "Dia de gravação: roteiro perdido no bloco de notas, cliente esperando e você tentando lembrar o que falta gravar.",
};
const TAGLINES: Record<string, string> = {
  aprovapost_externo: "Aprovação de post sem caçar cliente no WhatsApp",
  crm: "Sua carteira de clientes rodando no automático",
  financeiro: "O financeiro da social mídia, sem planilha",
  hub_cria: "A espiã oficial dos concorrentes dos seus clientes",
  hub_extra: "Mais fôlego de análise pro Cria Radar",
  cria_captacao: "Suas captações do mês organizadas como uma produção",
};
// Cenários CONCRETOS de uso: a pessoa se enxerga usando (dia, situação, gesto).
// É o "na prática" que dá ideia, não frase de efeito.
const NA_PRATICA: Record<string, string[]> = {
  aprovapost_externo: [
    "Terminou a arte às 18h? Manda o link e o cliente aprova do celular, na fila do mercado. O post sai no dia certo.",
    "Pediu ajuste? O pedido chega comentado no post certo, sem áudio de 3 minutos pra decifrar.",
    "Fim do mês: você gera o relatório de entregas com capa, sua logo e análise, e manda o PDF direto no WhatsApp do cliente.",
    "Cliente novo entrou? Cria o kanban dele em minutos e importa o que já existia de outro board.",
  ],
  crm: [
    "Segunda de manhã: você abre o pipeline e vê qual proposta está parada e quem precisa de follow-up hoje.",
    "Lead chegou pelo direct? Cadastra em 30 segundos e ele nunca mais se perde na caixa de mensagens.",
    "Chegou gente nova na equipe? Brandbook e persona estão na ficha do cliente: a pessoa pega o tom sem você repetir tudo.",
    "Na renovação, o histórico e o custo daquele cliente estão ali pra justificar o reajuste com segurança.",
  ],
  financeiro: [
    "Dia 5: o Caixa mostra quem já pagou e quem merece uma cobrada educada, antes de virar bola de neve.",
    "Fechou cliente novo? Lança a mensalidade recorrente UMA vez e ela entra sozinha na previsão de todo mês.",
    "Quer saber se aquele cliente difícil compensa? A rentabilidade por cliente responde com número, não com feeling.",
    "E a vida pessoal não fica de fora: orçamento, contas fixas e metas num caixa separado do da empresa.",
  ],
  hub_cria: [
    "Antes da reunião de pauta, você roda a análise e chega com: “os concorrentes estão apostando em X, a gente responde com Y”.",
    "Viu um reel bombando no nicho? Transcreve, adapta pro tom do seu cliente e vira ideia no cronograma dele.",
    "Os anúncios que os concorrentes estão rodando agora viram referência pro seu criativo, sem print de espiã.",
  ],
  hub_extra: [
    "Mês cheio de pauta? Os créditos extras entram na hora e você analisa todos os clientes sem esperar a cota virar.",
    "Acabou o pique do mês, é só cancelar o pacote: ele existe pros meses de aperto.",
  ],
  cria_captacao: [
    "Na véspera, você gera a folha do dia: roteiros e tomadas de todas as gravações de amanhã numa página só.",
    "No cliente, abre o teleprompter no celular, entrega na mão dele e grava com o texto rolando na tela.",
    "Cliente em outra cidade? O painel sugere aproveitar a viagem e agrupar as captações do mesmo lugar.",
  ],
};
const BENEFITS: Record<string, string[]> = {
  aprovapost_externo: [
    "Kanban do mês por cliente: em produção, aguardando, aprovado, publicado",
    "Link de aprovação sem login: o cliente aprova ou pede ajuste do celular",
    "Visão de feed igual ao Instagram e comentários por post",
    "Cronograma e calendário com data e hora de cada peça",
    "Materiais no Drive vinculados ao post (carrossel importa a pasta inteira)",
    "Relatório de entregas em PDF estilo apresentação, com a sua logo",
    "Clientes externos ilimitados",
  ],
  crm: [
    "Carteira de clientes e leads num lugar só, com as suas etiquetas",
    "Pipeline de propostas em kanban, do primeiro contato ao fechamento",
    "Contratos com data de renovação pra ninguém te pegar de surpresa",
    "Tarefas e lembretes de follow-up por cliente",
    "Brandbook, persona e histórico completo na ficha de cada cliente",
    "Custo por cliente (design, copy, tráfego) pra enxergar o seu lucro",
  ],
  financeiro: [
    "Mensalidades e trabalhos avulsos por cliente, sem planilha",
    "Recorrência lançada UMA vez e prevista em todos os meses",
    "Contas a receber com status: pago, pendente, atrasado",
    "Calendário financeiro com projeção dos próximos meses",
    "Impostos pelo seu regime e rentabilidade por cliente",
    "Caixa pessoal separado: orçamento, contas fixas e metas",
  ],
  hub_cria: [
    "Acompanhe o que os concorrentes de cada cliente estão postando",
    "Veja os anúncios que eles estão rodando agora",
    "Transcrição dos reels que bombaram, pronta pra adaptar",
    "Tudo salvo na aba Concorrência da ficha do cliente",
    "Pauta boa vira ideia no cronograma do cliente com um clique",
    "40 análises por mês (amplia com créditos extras quando precisar)",
  ],
  hub_extra: [
    "+20 análises no Cria Radar",
    "Some à sua cota do mês",
    "Cancele quando quiser",
  ],
  cria_captacao: [
    "O mês de gravações por dia e por local, num painel só",
    "Roteiro por captação com teleprompter pro cliente ler gravando",
    "Folha do dia: todos os roteiros do dia numa página, pronta pra levar",
    "Checklist de tomadas pra nada ficar sem gravar",
    "Captação recorrente e lembrete automático na véspera",
    "Sugestão por cidade pra aproveitar a mesma viagem",
  ],
};

export function ModulePopup({ module: m, onClose }: { module: ModuleWithStatus | null; onClose: () => void }) {
  const { profile, hasProfile, save } = useManagerProfile();
  const checkout = useModuleCheckout();
  const { openPortal, isLoading: portalLoading } = useManageSubscription();
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const Icon = m ? (ICONS[m.code] ?? Sparkles) : Sparkles;
  const cor = m ? (COR[m.code] ?? "#EA4918") : "#EA4918";
  const active = m ? (m.status === "active" || m.status === "past_due") : false;
  const benefits = m ? (BENEFITS[m.code] ?? []) : [];
  const dor = m ? DOR[m.code] : undefined;
  const napratica = m ? (NA_PRATICA[m.code] ?? []) : [];
  const busy = checkout.isPending || portalLoading;
  const navigate = useNavigate();
  const rota = m ? ROTA[m.code] : undefined;

  const onBuy = (code: string) => {
    if (!hasProfile) { setPending(code); setFormOpen(true); return; }
    checkout.mutate(code);
  };
  const onSaved = async (input: ManagerProfileInput) => {
    await save.mutateAsync(input);
    setFormOpen(false);
    const c = pending; setPending(null);
    if (c) checkout.mutate(c);
  };

  return (
    <>
      <Dialog open={!!m} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden">
          {m && (
            <div className="max-h-[88vh] overflow-y-auto scrollbar-none">
              {/* ── Hero no estilo Cria: creme + formas + ícone + preço ── */}
              <div className="relative overflow-hidden px-8 pt-9 pb-6 text-center" style={{ background: "#F6F2E8" }}>
                <span className="absolute -top-10 -right-8 w-28 h-28 rounded-full opacity-90" style={{ background: "#FF77B9" }} aria-hidden />
                <span className="absolute -bottom-12 -left-10 w-28 h-28 rounded-full opacity-90" style={{ background: "#FFCF03" }} aria-hidden />
                <span className="absolute top-8 left-8 w-4 h-4 rounded-full" style={{ background: "#0061EE" }} aria-hidden />
                <div className="relative flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/10 flex items-center justify-center mb-3">
                    <Icon className="h-7 w-7" style={{ color: cor }} />
                  </div>
                  <h2 className="text-2xl font-display font-extrabold text-[#1a1a2e]">{m.name}</h2>
                  <p className="text-sm font-body font-semibold mt-1" style={{ color: cor }}>{TAGLINES[m.code] ?? ""}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-body font-bold px-3 py-1.5 rounded-full text-white" style={{ background: active ? "#01A652" : "#1a1a2e" }}>
                    {active ? <><Check className="h-3.5 w-3.5" /> Ativo na sua conta</> : m.coming_soon ? <><Clock className="h-3.5 w-3.5" /> Em breve</> : `${brl(m.price_cents)}/mês`}
                  </span>
                </div>
              </div>

              <div className="px-8 pb-7">
                {/* ── A dor (só pra quem ainda não tem) ── */}
                {!active && dor && (
                  <div className="mt-5 rounded-2xl px-4 py-3" style={{ background: `${cor}0F`, borderLeft: `3px solid ${cor}` }}>
                    <p className="text-[10.5px] uppercase tracking-wider font-body font-bold mb-1" style={{ color: cor }}>Te soa familiar?</p>
                    <p className="text-[13px] font-body text-foreground/90 leading-relaxed">{dor}</p>
                  </div>
                )}

                {/* ── O que destrava ── */}
                <div className="mt-4 text-left">
                  <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-body font-bold mb-2.5">O que você destrava</p>
                  <ul className="space-y-2">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm font-body text-foreground/90">
                        <span className="mt-0.5 flex h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full" style={{ background: `${cor}1A` }}>
                          <Check className="h-3 w-3" strokeWidth={3} style={{ color: cor }} />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ── Na prática: cenários concretos que dão ideia de uso ── */}
                {napratica.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-border bg-muted/30 px-4 py-3">
                    <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-body font-bold mb-2">Na prática</p>
                    <ul className="space-y-2">
                      {napratica.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] font-body text-foreground leading-relaxed">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cor }} />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-body mt-4">
                  <Check className="h-3.5 w-3.5" /> {active ? "Assinatura ativa" : m.coming_soon ? "Avisamos quando estiver disponível" : "Ativa na hora · cobrança separada · cancele quando quiser"}
                </p>

                <div className="mt-3">
                  {active ? (
                    // Módulo ativo: a ação principal é ENTRAR NELE. "Gerenciar
                    // assinatura" é secundário, e vira o único botão quando não
                    // existe destino (o pacote de créditos, por exemplo).
                    <div className="space-y-2">
                      {rota && (
                        <Button className="w-full rounded-xl h-12" onClick={() => { onClose(); navigate(rota); }}>
                          Abrir {m.name} <ArrowRight className="h-4 w-4 ml-1.5" />
                        </Button>
                      )}
                      <Button variant="outline" className="w-full rounded-xl h-12" onClick={openPortal} disabled={busy}>Gerenciar assinatura</Button>
                    </div>
                  ) : m.coming_soon ? (
                    <Button className="w-full rounded-xl h-12" disabled>Em breve</Button>
                  ) : (
                    <Button className="w-full rounded-xl h-12 text-[15px]" onClick={() => onBuy(m.code)} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Quero o {m.name} · {brl(m.price_cents)}/mês</>}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ManagerProfileForm open={formOpen} initial={profile} saving={save.isPending}
        onClose={() => { setFormOpen(false); setPending(null); }} onSave={onSaved} />
    </>
  );
}
