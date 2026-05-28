import { Link } from "react-router-dom";
import { Logo } from "@/components/shared/Logo";

export default function Termos() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo className="h-8" />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 font-body">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Termos de Uso
        </h1>
        <p className="text-muted-foreground text-sm mb-12">
          Última atualização: 28 de maio de 2026 · Versão 1.0
        </p>

        <section className="prose prose-sm max-w-none space-y-8 text-foreground">
          <div>
            <h2 className="text-xl font-display font-semibold mb-3">1. Aceitação dos termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ao criar uma conta ou utilizar o cria (criasocialclub.com.br), você
              concorda integralmente com estes Termos de Uso e com a nossa Política
              de Privacidade. Se você não concorda com qualquer dispositivo, não
              utilize a plataforma.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Estes termos podem ser atualizados periodicamente. Mudanças
              materiais serão comunicadas com antecedência razoável, e o uso
              continuado da plataforma após a alteração implica aceitação dos
              novos termos.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">2. O que é o cria</h2>
            <p className="text-muted-foreground leading-relaxed">
              O cria é uma plataforma de organização e gestão de conteúdo para
              criadores nas redes sociais. Oferecemos ferramentas para
              planejamento, ideação, produção, agendamento e análise de conteúdo,
              incluindo recursos baseados em inteligência artificial para apoiar
              o processo criativo.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">3. Cadastro e conta</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para usar o cria, você precisa criar uma conta fornecendo email
              válido e senha. Você é responsável por manter a confidencialidade
              de suas credenciais e por todas as atividades realizadas em sua
              conta.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              O cria é destinado a maiores de 18 anos, ou maiores de 16 anos
              com assistência dos responsáveis legais, conforme o Marco Civil
              da Internet e a LGPD.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              4. Inteligência Artificial — natureza orientativa
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              O cria utiliza modelos de inteligência artificial para gerar
              sugestões de legendas, roteiros, ideias, ganchos e outros conteúdos
              criativos.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              <strong className="text-foreground">
                Os resultados gerados por IA são orientativos e não substituem o
                julgamento profissional do criador.
              </strong>{" "}
              Você é responsável por revisar, adaptar e validar todo conteúdo
              antes de publicá-lo em suas redes ou utilizá-lo de qualquer outra
              forma.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              O cria não se responsabiliza por consequências decorrentes do uso
              direto de sugestões geradas por IA, incluindo, mas não se limitando
              a: reações do público, sanções de plataformas, questões de direitos
              autorais, imprecisões factuais ou qualquer outro impacto reputacional
              ou financeiro.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              5. Conteúdo do usuário
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Você mantém todos os direitos sobre o conteúdo que produz, armazena
              ou organiza no cria (ideias, posts, mídias, brandbook etc). Não
              reivindicamos propriedade sobre seu conteúdo.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Você concede ao cria apenas a licença técnica necessária para
              operar o serviço — armazenar, processar e exibir seu conteúdo
              para você mesmo, dentro da plataforma.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Você se compromete a não utilizar a plataforma para criar,
              armazenar ou organizar conteúdo que: (a) viole direitos de
              terceiros (autorais, imagem, marca); (b) seja ilegal, difamatório,
              discriminatório ou pornográfico; (c) infrinja as regras das
              plataformas onde será publicado (Instagram, TikTok, YouTube etc).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              6. Planos, pagamento e cancelamento
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              O cria oferece um período de teste gratuito de 7 dias, durante o
              qual você tem acesso a todas as funcionalidades. Após o período de
              teste, o uso continuado exige assinatura paga.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Atualmente oferecemos dois planos mensais (cria Pro e cria Studio),
              com valores divulgados na página de assinatura. Os pagamentos são
              processados pela Stripe, com cobrança recorrente automática no
              cartão informado.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              <strong className="text-foreground">Cancelamento:</strong> você
              pode cancelar a assinatura a qualquer momento pelo painel do
              cliente (acessível dentro do app). O cancelamento é efetivado no
              fim do período já pago, mantendo o acesso até a próxima data de
              cobrança.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              <strong className="text-foreground">Reembolso:</strong> conforme o
              Código de Defesa do Consumidor (art. 49), você tem direito a
              arrependimento em até 7 dias da contratação, com reembolso
              integral. Após esse prazo, não realizamos reembolsos proporcionais
              — o cancelamento simplesmente impede a próxima cobrança.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              7. Limitação de responsabilidade
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              O cria é oferecido "no estado em que se encontra". Embora nos
              esforcemos para garantir disponibilidade e qualidade, não
              garantimos operação ininterrupta ou livre de erros.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Em nenhuma hipótese a responsabilidade total do cria por danos
              relacionados ao serviço excederá o valor pago pelo usuário nos 12
              meses anteriores ao evento que originou a controvérsia.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Não nos responsabilizamos por: perda de seguidores, queda de
              engajamento, suspensão de contas em redes sociais, prejuízos
              comerciais decorrentes do uso da plataforma, ou qualquer dano
              indireto ou lucros cessantes.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              8. Privacidade e dados pessoais
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              O tratamento dos seus dados pessoais é regido pela nossa{" "}
              <Link to="/privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              , que é parte integrante destes Termos. O cria está em conformidade
              com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              9. Suspensão e encerramento
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Podemos suspender ou encerrar sua conta a qualquer momento em caso
              de violação destes termos, fraude, ou uso abusivo da plataforma.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Você pode encerrar sua conta a qualquer momento dentro do app
              (Configurações → Excluir conta). A exclusão remove permanentemente
              seus dados, e, se houver assinatura ativa, ela é cancelada
              automaticamente no Stripe.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              10. Lei aplicável e foro
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Estes Termos são regidos pela legislação brasileira. Para dirimir
              qualquer controvérsia, fica eleito o foro da comarca de Blumenau,
              Santa Catarina, salvo disposição legal específica em contrário.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">11. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Dúvidas ou solicitações relacionadas a estes Termos podem ser
              enviadas para{" "}
              <a
                href="mailto:contato@criasocialclub.com.br"
                className="text-primary hover:underline"
              >
                contato@criasocialclub.com.br
              </a>
              .
            </p>
          </div>
        </section>
      </article>
    </div>
  );
}
