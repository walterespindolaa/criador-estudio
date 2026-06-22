import { Link } from "react-router-dom";
import { Logo } from "@/components/shared/Logo";

export default function ExcluirDados() {
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
          Exclusão de dados — Cria Social Club
        </h1>
        <p className="text-muted-foreground text-sm mb-10">
          Como excluir seus dados, incluindo os dados conectados do Instagram e do Google.
        </p>

        <section className="space-y-8 text-foreground">
          <div>
            <h2 className="text-xl font-display font-semibold mb-3">Excluir sua conta e todos os dados</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Para apagar permanentemente sua conta e todos os dados associados:
            </p>
            <ol className="text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
              <li>Acesse <strong className="text-foreground">app.criasocialclub.com.br</strong> e faça login.</li>
              <li>Vá em <strong className="text-foreground">Configurações → Conta</strong>.</li>
              <li>Clique em <strong className="text-foreground">Excluir conta</strong> e confirme.</li>
            </ol>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Seus dados são removidos em até <strong className="text-foreground">30 dias</strong>, exceto
              quando houver obrigação legal de retenção (ex.: dados fiscais de pagamentos).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">Desconectar e apagar dados do Instagram</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Se você conectou sua conta profissional do Instagram, pode revogar o acesso e remover
              esses dados a qualquer momento:
            </p>
            <ol className="text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
              <li>No app, vá em <strong className="text-foreground">Configurações → Integrações</strong> e clique em <strong className="text-foreground">Desconectar Instagram</strong>; ou</li>
              <li>Revogue o acesso direto na Meta em <a href="https://www.instagram.com/accounts/manage_access/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">instagram.com/accounts/manage_access</a>.</li>
            </ol>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Ao desconectar, deixamos de acessar sua conta e as métricas importadas são removidas do
              seu painel.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-display font-semibold mb-3">Solicitar exclusão por e-mail</h2>
            <p className="text-muted-foreground leading-relaxed">
              Você também pode pedir a exclusão dos seus dados escrevendo para{" "}
              <a href="mailto:contato@criasocialclub.com.br" className="text-primary hover:underline">
                contato@criasocialclub.com.br
              </a>
              . Atendemos a solicitação em até 30 dias.
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Data deletion (English):</strong> To delete your
              account and all associated data (including connected Instagram and Google data), log in
              at app.criasocialclub.com.br, go to Settings → Account → Delete account, or email
              contato@criasocialclub.com.br. To disconnect Instagram only, use Settings → Integrations
              → Disconnect Instagram, or revoke access at instagram.com/accounts/manage_access. Data is
              removed within 30 days.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Veja também nossa{" "}
            <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.
          </p>
        </section>
      </article>
    </div>
  );
}
