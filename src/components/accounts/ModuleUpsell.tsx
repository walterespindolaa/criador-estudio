import type { LucideIcon } from "lucide-react";
import {
  Wallet, TrendingUp, Receipt, CalendarClock, Repeat, ArrowRight,
  Send, Link2, Eye, Bell, Users2, ListTodo, Handshake, FileSignature,
} from "lucide-react";
import { useModules } from "@/hooks/useModules";
import { useManagerOutlet } from "@/components/accounts/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import type { CriaColor } from "@/lib/moduleTheme";

// ═══════════════════════════════════════════════════════════════════════
// VITRINE DE MÓDULO
//
// Quando a pessoa esbarra num recurso que ela não assina, ela NÃO leva uma
// porta na cara. Ela vê o que ganharia — e, quando dá, sobre ESTE cliente,
// citando o nome dele. É a diferença entre "módulo inativo" e uma oferta.
//
// Um lugar só: o texto de venda de cada módulo mora aqui. Antes existia um
// card só do Caixa e nada pro Cria Post nem pro Gestão.
// ═══════════════════════════════════════════════════════════════════════

type Ganho = { icon: LucideIcon; t: string; d: string };
type UpsellDef = {
  icone: LucideIcon;
  cor: CriaColor;
  selo: string;
  titulo: (nome?: string) => string;
  linha: (nome?: string) => string;
  ganhos: Ganho[];
  rodape: string;
};

export const UPSELL: Record<string, UpsellDef> = {
  aprovapost_externo: {
    icone: Send,
    cor: "laranja",
    selo: "Exclusivo do Cria Post",
    titulo: (n) => (n ? `Pare de aprovar post com ${n} no WhatsApp` : "Pare de aprovar post no WhatsApp"),
    linha: (n) =>
      `Print, áudio, "muda a terceira", print de novo. ${n ? `${n} aprova` : "Seu cliente aprova"} num link, do celular, sem baixar nada e sem criar conta.`,
    ganhos: [
      { icon: Link2, t: "Um link, sem senha", d: "Você manda o link, ele abre no celular e aprova. Não precisa de app, cadastro nem explicação." },
      { icon: Eye, t: "Você sabe se ele viu", d: "O card mostra “visto há 2h” e “esperando há 5 dias”. Chega de cobrar no escuro." },
      { icon: Bell, t: "Avisa na hora", d: "Ele aprovou ou pediu ajuste? Você recebe a notificação na hora, com o comentário dele junto." },
      { icon: FileSignature, t: "Com a cara do cliente", d: "Logo e cor da marca dele na página. Vira entrega profissional, não link de sistema." },
    ],
    rodape: "Aprovação, calendário e relatório no mesmo link.",
  },

  crm: {
    icone: Users2,
    cor: "rosa",
    selo: "Exclusivo do Cria Gestão",
    titulo: (n) => (n ? `Tudo sobre ${n} num lugar só` : "Sua carteira num lugar só"),
    linha: () =>
      "Contrato, brandbook, tarefas, contatos e histórico espalhados em bloco de notas, planilha e conversa de WhatsApp. Aqui tudo mora na ficha do cliente.",
    ganhos: [
      { icon: Users2, t: "Ficha completa do cliente", d: "Brandbook, personas, diagnóstico, concorrência e contatos. O que você precisa saber antes de criar." },
      { icon: ListTodo, t: "Tarefas e calendário", d: "O que fazer pra cada cliente, com prazo, direto na agenda da semana." },
      { icon: Handshake, t: "Pipeline de vendas", d: "Do lead ao contrato assinado, arrastando o card. Você vê quanto tem pra fechar." },
      { icon: FileSignature, t: "Contratos", d: "Modelos prontos pra agilizar o fechamento, com o valor e a renovação registrados." },
    ],
    rodape: "A carteira inteira, sem planilha.",
  },

  financeiro: {
    icone: Wallet,
    cor: "azul",
    selo: "Exclusivo do Cria Caixa",
    titulo: (n) => (n ? `${n} dá lucro?` : "Sua operação dá lucro?"),
    linha: (n) =>
      `Você sabe quanto ${n ?? "o cliente"} paga. Mas sabe quanto ele CUSTA? O Caixa liga o dinheiro a cada cliente e responde a pergunta que decide se vale continuar.`,
    ganhos: [
      { icon: TrendingUp, t: "Margem real por cliente", d: "Quanto ele paga, quanto você gasta com ele (design, copy, tráfego) e o que sobra de verdade." },
      { icon: Receipt, t: "Imposto mastigado", d: "Você diz o regime (MEI, Simples, Presumido) e o Caixa calcula quanto separar, no mês e por cliente." },
      { icon: Repeat, t: "Entradas e saídas fixas", d: "Cadastre uma vez. Todo mês elas já aparecem previstas, sem você lembrar de nada." },
      { icon: CalendarClock, t: "Calendário de recebimentos", d: "Quem paga dia 10, quem paga dia 15, o que vence semana que vem. Bate o olho e sabe." },
    ],
    rodape: "Empresa e pessoal separados, no mesmo lugar.",
  },
};

export function ModuleUpsell({ code, clientName }: { code: string; clientName?: string }) {
  const { modules } = useModules();
  const { openModule } = useManagerOutlet();
  const def = UPSELL[code];
  const mod = modules.find((m) => m.code === code);
  if (!def) return null;

  const Icone = def.icone;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-8">
      <OrganicBlobs color={def.cor} />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 mb-3">
          <Icone className="h-3.5 w-3.5" />
          <span className="text-[11px] font-body font-bold uppercase tracking-wider">{def.selo}</span>
        </div>

        <h2 className="font-display font-extrabold text-xl sm:text-2xl text-foreground tracking-tight">
          {def.titulo(clientName)}
        </h2>
        <p className="text-sm font-body text-muted-foreground mt-1.5 max-w-lg leading-relaxed">
          {def.linha(clientName)}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          {def.ganhos.map((g) => {
            const G = g.icon;
            return (
              <div key={g.t} className="rounded-2xl border border-border bg-background/70 backdrop-blur-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <G className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-[13px] font-display font-bold text-foreground">{g.t}</p>
                </div>
                <p className="text-[12px] font-body text-muted-foreground leading-relaxed">{g.d}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mt-6 flex-wrap">
          {mod && !mod.coming_soon ? (
            <Button size="lg" onClick={() => openModule(mod)}>
              Ativar o {mod.name} <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <p className="text-[13px] font-body text-muted-foreground">Este módulo ainda está em desenvolvimento.</p>
          )}
          <p className="text-[12px] font-body text-muted-foreground">{def.rodape}</p>
        </div>
      </div>
    </div>
  );
}

/** Mesma vitrine, em popup. Pra quando a pessoa CLICA numa ação que exige o módulo. */
export function ModuleUpsellDialog({ open, onOpenChange, code, clientName }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  code: string;
  clientName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <ModuleUpsell code={code} clientName={clientName} />
      </DialogContent>
    </Dialog>
  );
}

export default ModuleUpsell;
