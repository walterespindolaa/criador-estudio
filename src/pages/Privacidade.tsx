import { Link } from "react-router-dom";
import { Logo } from "@/components/shared/Logo";

export default function Privacidade() {
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
          Política de Privacidade
        </h1>
        <p className="text-muted-foreground text-sm mb-12">
          Última atualização: 28 de maio de 2026 · Versão 1.0
        </p>

        <section className="prose prose-sm max-w-none space-y-8 text-foreground">
          <div>
            <h2 className="text-xl font-display font-semibold mb-3">1. Quem somos</h2>
            <p className="text-muted-foreground leading-relaxed">
              O cria é uma plataforma operada por Walter Espindola, com sede em
              Blumenau, Santa Catarina, Brasil. Esta Política de Privacidade
              explica como coletamos, usamos, armazenamos e protegemos seus
              dados pessoais, em conformidade com a Lei Geral de Proteção de
              Dados (LGPD — Lei nº 13.709/2018).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              2. Dados que coletamos
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              <strong className="text-foreground">Dados de cadastro:</strong> nome,
              email, senha (armazenada com hash criptográfico).
            </p>
            <p className="text-muted-foreground leading-relaxed mb-2">
              <strong className="text-foreground">Dados de uso:</strong> conteúdo
              que você cria na plataforma (ideias, posts, brandbook, tarefas,
              metas), preferências de tema, configurações.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-2">
              <strong className="text-foreground">Dados de pagamento:</strong>{" "}
              processados exclusivamente pela Stripe — não armazenamos números
              de cartão. Recebemos apenas identificadores não-sensíveis
              (stripe_customer_id, stripe_subscription_id).
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Dados técnicos:</strong>{" "}
              endereço IP (registrado apenas em momentos específicos, como
              aceitação dos termos), navegador, sistema operacional, logs de
              acesso.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              3. Para que usamos seus dados (finalidades)
            </h2>
            <ul className="text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
              <li>Operar a plataforma e prestar o serviço contratado</li>
              <li>Autenticar você, manter sua sessão e proteger sua conta</li>
              <li>Processar pagamentos e gerenciar sua assinatura</li>
              <li>
                Enviar emails transacionais (confirmação, recuperação de senha,
                alertas)
              </li>
              <li>
                Gerar sugestões personalizadas via IA com base no seu próprio
                conteúdo
              </li>
              <li>Cumprir obrigações legais e fiscais</li>
              <li>
                Melhorar a plataforma com base em dados agregados e anônimos
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              4. Base legal (LGPD)
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Tratamos seus dados com base em: (i) execução de contrato (art. 7º,
              V); (ii) cumprimento de obrigação legal (art. 7º, II); (iii)
              consentimento (art. 7º, I) para o aceite dos termos; e (iv)
              legítimo interesse para melhoria do serviço (art. 7º, IX), sempre
              respeitando seus direitos fundamentais.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              5. Compartilhamento com terceiros
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Compartilhamos dados estritamente com os subprocessadores
              necessários pra operação do serviço:
            </p>
            <ul className="text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
              <li>
                <strong className="text-foreground">Supabase / Lovable Cloud:</strong>{" "}
                infraestrutura de banco de dados e autenticação
              </li>
              <li>
                <strong className="text-foreground">Stripe:</strong> processamento
                de pagamentos (dados de cobrança)
              </li>
              <li>
                <strong className="text-foreground">Resend:</strong> envio de
                emails transacionais (somente email e conteúdo do email)
              </li>
              <li>
                <strong className="text-foreground">Google (Anthropic/Gemini):</strong>{" "}
                processamento de requisições de IA (apenas o prompt enviado,
                sem dados de cadastro)
              </li>
              <li>
                <strong className="text-foreground">Cloudflare:</strong> DNS e
                proteção de infraestrutura
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Não vendemos, alugamos ou comercializamos seus dados pessoais a
              terceiros pra fins de marketing.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              6. Seus direitos (LGPD)
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Você tem direito a:
            </p>
            <ul className="text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
              <li>Acessar seus dados (Configurações → Exportar dados)</li>
              <li>Corrigir dados inexatos ou desatualizados</li>
              <li>Solicitar exclusão (Configurações → Excluir conta)</li>
              <li>Revogar consentimento (impedindo uso futuro)</li>
              <li>Solicitar portabilidade dos dados</li>
              <li>
                Informações sobre compartilhamento (essa Política já cumpre
                essa função)
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Pra exercer qualquer direito, entre em contato pelo email{" "}
              <a
                href="mailto:contato@criasocialclub.com.br"
                className="text-primary hover:underline"
              >
                contato@criasocialclub.com.br
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              7. Segurança
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Adotamos medidas técnicas e organizacionais pra proteger seus
              dados: criptografia em trânsito (HTTPS/TLS), criptografia em
              repouso, autenticação por JWT, Row Level Security no banco de
              dados, segregação de chaves de API.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Apesar dos esforços, nenhum sistema é 100% inviolável. Em caso de
              incidente que comprometa seus dados, comunicaremos você e a ANPD
              (Autoridade Nacional de Proteção de Dados) conforme exigido pela
              LGPD.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              8. Retenção de dados
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Mantemos seus dados pelo período em que sua conta está ativa.
              Após exclusão da conta, os dados são removidos no prazo de até
              30 dias, exceto quando houver obrigação legal de retenção (ex:
              dados fiscais de pagamentos, retidos por 5 anos conforme
              legislação tributária).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              9. Cookies e tecnologias similares
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Usamos cookies essenciais pra manter sua sessão autenticada e
              cookies funcionais pra lembrar preferências (tema, idioma). Não
              usamos cookies de publicidade ou rastreamento de terceiros.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              10. Alterações nesta Política
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Esta Política pode ser atualizada periodicamente. Mudanças
              materiais serão comunicadas por email ou banner no app, com
              antecedência mínima de 15 dias antes da entrada em vigor.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">
              11. Contato e DPO
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Pra qualquer questão sobre privacidade ou seus dados, entre em
              contato com nosso encarregado de proteção de dados (DPO):{" "}
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
