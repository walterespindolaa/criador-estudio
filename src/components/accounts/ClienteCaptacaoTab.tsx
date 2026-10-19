import { lazy, Suspense } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA CAPTAÇÃO DENTRO DA FICHA DO CLIENTE

   23/09/2026 (Gabriela): "não tem como ter a captação aqui em cima também?"
   A aba mostrava um resumo e um botão "Abrir a pasta" que levava pro módulo.

   19/10/2026 (Walter): "precisa espelhar aqui na tela do cliente a captação
   dele, pra aparecer essa mesma tela que fizemos agora, pra eu não precisar
   ir lá em Cria Captação". Agora a aba É a pasta do cliente do módulo
   (CaptacaoDoCliente): mês, roteiros e gravações por dia, marcar, guia em PDF
   e envio pro cliente. Uma tela só, nos dois caminhos.

   Carrega sob demanda: o módulo é grande e só entra quando a aba abre.
   ═══════════════════════════════════════════════════════════════════════════ */

const CaptacaoDoCliente = lazy(() =>
  import("@/pages/socialmidia/CriaCaptacao").then((m) => ({ default: m.CaptacaoDoCliente })));

export function ClienteCaptacaoTab({ clientId }: { clientId: string; clientName?: string }) {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-border bg-card p-10 text-center text-sm font-body text-muted-foreground">Carregando a captação…</div>}>
      <CaptacaoDoCliente crmClientId={clientId} />
    </Suspense>
  );
}
