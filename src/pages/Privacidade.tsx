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
          Última atualização: 19 de junho de 2026 · Versão 1.1
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
            <p className="text-muted-foreground leading-relaxed mb-2">
              <strong className="text-foreground">Dados técnicos:</strong>{" "}
              endereço IP (registrado apenas em momentos específicos, como
              aceitação dos termos), navegador, sistema operacional, logs de
              acesso.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Dados de redes sociais (opcional):</strong>{" "}
              se você conectar sua conta profissional do Instagram, coletamos métricas
              (alcance, interações, salvos, visualizações), informações básicas do perfil
              (nome de usuário, número de seguidores) e dados das suas publicações (legenda,
              tipo de mídia, miniatura, data). Acesso somente leitura — não publicamos nada por você.
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
                <strong className="text-foreground">Google Gemini (via Lovable AI Gateway):</strong>{" "}
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

            <h3 className="text-base font-display font-semibold text-foreground mt-5 mb-2">
              Acesso aos seus dados do Google (Drive e Agenda)
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Ao conectar sua conta Google, o CRIA solicita acesso estritamente
              aos escopos abaixo, sempre mediante seu consentimento explícito na
              tela do Google. Você pode revogar esse acesso a qualquer momento em{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                myaccount.google.com/permissions
              </a>.
            </p>
            <ul className="text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
              <li>
                <strong className="text-foreground">Google Drive (drive.file):</strong>{" "}
                acessamos apenas os arquivos que você seleciona ou cria através do
                app (via Google Picker), para anexar e pré-visualizar mídias nos
                seus posts. Não acessamos nem listamos os demais arquivos do seu Drive.
              </li>
              <li>
                <strong className="text-foreground">Google Agenda (calendar.events):</strong>{" "}
                criamos e atualizamos eventos do seu calendário de conteúdo, para
                sincronizar suas publicações planejadas.
              </li>
              <li>
                <strong className="text-foreground">Perfil básico (email, profile):</strong>{" "}
                identificar a conta Google conectada.
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              <strong className="text-foreground">Uso limitado:</strong> o uso que o
              CRIA faz das informações recebidas das APIs do Google adere à{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Política de Dados do Usuário dos Serviços de API do Google
              </a>
              , incluindo os requisitos de Uso Limitado. Os dados obtidos do Google
              não são usados para publicidade, não são vendidos a terceiros e não
              são usados para treinar modelos de IA; o acesso se restringe às
              funcionalidades descritas acima.
            </p>

            <h3 className="text-base font-display font-semibold text-foreground mt-5 mb-2">
              Acesso aos seus dados do Instagram
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Ao conectar sua conta profissional (Business ou Creator) do Instagram, o CRIA
              solicita acesso estritamente aos escopos abaixo, sempre mediante seu
              consentimento explícito na tela do Instagram. Você pode revogar esse acesso a
              qualquer momento em{" "}
              <a href="https://www.instagram.com/accounts/manage_access/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                instagram.com/accounts/manage_access
              </a>{" "}
              ou em Configurações → Integrações no app.
            </p>
            <ul className="text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
              <li>
                <strong className="text-foreground">instagram_business_basic:</strong>{" "}
                ler o perfil e a lista de mídias da sua própria conta, para exibir seu
                conteúdo e informações básicas no seu painel.
              </li>
              <li>
                <strong className="text-foreground">instagram_business_manage_insights:</strong>{" "}
                ler as métricas (alcance, interações, salvos, visualizações) da sua conta e
                das suas publicações, para mostrar sua análise de desempenho no painel.
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              O acesso é <strong className="text-foreground">somente leitura</strong>: o CRIA
              não publica, edita nem exclui conteúdo no seu Instagram. Os dados do Instagram
              não são usados para publicidade, não são vendidos a terceiros e não são usados
              para treinar modelos de IA; o acesso se restringe às funcionalidades de análise
              descritas acima.
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
