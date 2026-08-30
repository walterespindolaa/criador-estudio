import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Camera, Check, FileText, Gem, KanbanSquare, LineChart, Link2, Mic, Search,
  Send, Sparkles, Users, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* ═══════════════════════════════════════════════════════════════════════════
   A VITRINE DE CADA MÓDULO, NA VOZ DO PARCEIRO

   Clicar num módulo do menu abria a página GENÉRICA de planos: cadeado não
   vende, vitrine vende. Aqui cada módulo tem a própria página: a dor que o
   designer/filmmaker/copy vive hoje, o que o módulo destrava PRA ELE (não a
   copy da social mídia reciclada), e os dois caminhos de destravar no fim.
   O trabalho vindo das agências continua grátis: isto aqui é o "ir além".
   ═══════════════════════════════════════════════════════════════════════════ */

type Beneficio = { Icone: LucideIcon; t: string; d: string };
type InfoModulo = {
  nome: string;
  Icone: LucideIcon;
  cor: string;        // classes do ícone do hero
  dor: string;        // a frase que descreve a vida sem o módulo
  beneficios: Beneficio[];
};

const MODULOS: Record<string, InfoModulo> = {
  criapost: {
    nome: "Cria Post",
    Icone: Send,
    cor: "bg-orange-100 text-orange-600",
    dor: "Job direto fechado no WhatsApp, arte aprovada por print e versão final perdida na conversa. Pro cliente que é SEU, você vira a própria social mídia, sem as ferramentas dela.",
    beneficios: [
      { Icone: KanbanSquare, t: "Kanban da ideia ao publicado", d: "As peças dos seus clientes diretos nas mesmas colunas que você já usa na fila das agências. Um jeito de trabalhar só." },
      { Icone: Link2, t: "Link de aprovação pro seu cliente", d: "O cliente aprova ou pede ajuste num link, sem conta, e o motivo fica registrado. Chega de aprovação por áudio." },
      { Icone: FileText, t: "Legenda, roteiro e material juntos", d: "Cada peça carrega o briefing completo. Três meses depois, você acha a versão final em segundos." },
      { Icone: LineChart, t: "Calendário e histórico", d: "O mês do seu cliente visível, e as entregas somando no seu histórico igual às das agências." },
    ],
  },
  gestao: {
    nome: "Cria Gestão",
    Icone: Users,
    cor: "bg-pink-100 text-pink-600",
    dor: "Proposta num doc solto, contrato por e-mail, combinado de preço na memória. Quando o cliente some, você não sabe se foi o preço, o prazo ou o follow-up que faltou.",
    beneficios: [
      { Icone: Users, t: "CRM dos seus clientes e leads", d: "Ficha por cliente com contatos, combinados, etiquetas e pipeline de quem está pra fechar." },
      { Icone: FileText, t: "Propostas e contratos", d: "Proposta com aceite e contrato com o seu nome, no padrão que as agências usam com os clientes delas." },
      { Icone: Sparkles, t: "Brandbook por cliente", d: "Cores, fontes, tom e persona de cada marca num lugar só: o mesmo material que você já recebe pronto das agências." },
      { Icone: LineChart, t: "Relatórios com a sua cara", d: "Relatório white-label pra mostrar resultado e renovar o job." },
    ],
  },
  caixa: {
    nome: "Cria Caixa",
    Icone: Wallet,
    cor: "bg-blue-100 text-blue-600",
    dor: "Quanto cada agência te deve este mês? Quanto sobrou depois do imposto? Se a resposta está numa planilha atrasada (ou na memória), a cobrança sempre chega tímida.",
    beneficios: [
      { Icone: Wallet, t: "A receber por agência e cliente", d: "Cada entrega vira dinheiro previsto. No fim do mês, o número da cobrança sai pronto, com prova." },
      { Icone: LineChart, t: "Rentabilidade real", d: "Quem paga bem e quem suga: o lucro por cliente e por agência, não só o faturamento." },
      { Icone: FileText, t: "Impostos do MEI ao Simples", d: "O imposto calculado por regime, pra nunca ser pego de surpresa." },
      { Icone: Check, t: "PJ e PF separados", d: "O caixa do trabalho e o da vida, com contas fixas, metas e projeção dos próximos meses." },
    ],
  },
  captacao: {
    nome: "Cria Captação",
    Icone: Camera,
    cor: "bg-amber-100 text-amber-700",
    dor: "Dia de gravação sem roteiro estruturado é diária dobrada: cliente que trava, take refeito, cena esquecida. O prejuízo é seu, não do cliente.",
    beneficios: [
      { Icone: FileText, t: "Roteiro estruturado por cena", d: "Fala e direção lado a lado, no formato que faz o cliente gravar certo de primeira." },
      { Icone: Mic, t: "Teleprompter com voz", d: "O texto rola sozinho enquanto a pessoa fala. Menos takes, menos hora perdida." },
      { Icone: Camera, t: "Guia de gravação em PDF", d: "A ordem das tomadas do dia impressa: ninguém volta pra casa com cena faltando." },
      { Icone: KanbanSquare, t: "Biblioteca de roteiros", d: "Os roteiros que funcionam, salvos por cliente, prontos pra adaptar no próximo job." },
    ],
  },
  radar: {
    nome: "Cria Radar",
    Icone: Search,
    cor: "bg-green-100 text-green-700",
    dor: "Referência boa hoje é caçada manual: abrir dez perfis, printar, perder no rolo da galeria. E o cliente pergunta \"por que esse formato?\" sem você ter o dado na mão.",
    beneficios: [
      { Icone: Search, t: "Concorrência do nicho do cliente", d: "O que os perfis do nicho estão postando e o que performa, organizado por cliente." },
      { Icone: Sparkles, t: "Engenharia reversa de roteiro", d: "Cole um reels viral e a IA desmonta o roteiro: gancho, estrutura, CTA. Ouro pro filmmaker." },
      { Icone: KanbanSquare, t: "Referência vira ideia", d: "Achou, salvou, virou card de produção. A galeria do celular deixa de ser o seu banco de referências." },
      { Icone: LineChart, t: "Argumento com dado", d: "\"Esse formato rendeu X no nicho\" convence cliente e agência mais que opinião." },
    ],
  },
};

export default function ModuloParceiro() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const info = slug ? MODULOS[slug] : undefined;
  if (!info) return <Navigate to="/parceiro/planos" replace />;

  return (
    <div className="pb-10 max-w-3xl">
      {/* A DOR PRIMEIRO: quem chega aqui clicou curioso; a página precisa
          reconhecer a vida dele antes de listar recurso. */}
      <div className="flex items-start gap-3.5 mb-5">
        <span className={cn("w-12 h-12 rounded-2xl grid place-items-center shrink-0", info.cor)}>
          <info.Icone className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display font-extrabold text-[22px] leading-tight">{info.nome}</h2>
          <p className="text-[13.5px] font-body text-muted-foreground mt-1.5 leading-relaxed">{info.dor}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {info.beneficios.map((b) => (
          <Card key={b.t} className="rounded-2xl border-border p-4">
            <span className={cn("w-9 h-9 rounded-xl grid place-items-center mb-2.5", info.cor)}>
              <b.Icone className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <p className="font-display font-bold text-[14px]">{b.t}</p>
            <p className="text-[12.5px] font-body text-muted-foreground mt-1 leading-relaxed">{b.d}</p>
          </Card>
        ))}
      </div>

      {/* COMO DESTRAVAR: os dois caminhos, sem misturar produto. */}
      <Card className="rounded-2xl border-primary/30 bg-primary/5 p-5">
        <p className="font-display font-extrabold text-[15px] mb-1">Como destravar o {info.nome}</p>
        <p className="text-[12.5px] font-body text-muted-foreground leading-relaxed mb-3">
          O seu trabalho pras agências segue grátis pra sempre. O {info.nome} entra quando você
          quer usar isso com clientes SEUS: pela conta de gestão (gratuita pra começar, o mesmo
          caminho das social mídias) ou pelos planos do Cria criador, se você também toca a
          própria marca.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-xl" onClick={() => navigate("/comecar-agencia")}>
            <Users className="h-4 w-4 mr-1.5" /> Ativar meu lado gestão (grátis)
          </Button>
          <Button variant="outline" className="rounded-xl" asChild>
            <Link to="/parceiro/planos"><Gem className="h-4 w-4 mr-1.5" /> Ver os planos</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
