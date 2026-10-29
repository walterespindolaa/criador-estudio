import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandbookEditor, personasDaFicha, useFichaEditavel } from "@/components/accounts/crm/BrandbookEditor";
import { BotaoBrandbookPdf } from "@/components/pdf/BrandbookClientePdf";
import { ClienteBrandbookCria } from "@/components/accounts/ClienteBrandbookCria";

/* ═══════════════════════════════════════════════════════════════════════════
   O BRANDBOOK DE QUEM NÃO TEM CONTA NO CRIA

   Cliente com conta tem o brandbook na conta dele. O resto (a maioria) tem o
   que a social mídia preencheu na ficha do CRM, e aqui isso era só leitura:
   quem via um campo errado tinha que abrir outra tela pra arrumar, e não
   abria. Agora é o MESMO formulário da ficha, dentro do cockpit, salvando
   sozinho. O "Copiar tudo" continua, porque é assim que a pessoa leva a marca
   pro chat de IA na hora de escrever.
   ═══════════════════════════════════════════════════════════════════════════ */
// Rótulos do "Copiar tudo": o texto vai pro ChatGPT, então cada campo precisa
// chegar lá com nome de gente, não com a chave do banco.
/* UMA TELA SÓ (Gabriela, 19/10/2026: "não deve ter divergência de tela,
   independente de qual caminho eu use"). Este arquivo é o brandbook do
   cliente: a ficha dele (ClienteHub) e o Cria Gestão (CriaCrmClient) montam
   exatamente este componente. Antes eram dois, e um tinha o "Peça os dados
   pro cliente", o Copiar tudo e a persona dentro; o outro não. */
const COPIA_BRAND: [string, [string, string][]][] = [
  ["Estratégia", [
    ["mainGoal", "Meta principal"], ["bigIdea", "A Big Idea"], ["promise", "Promessa"],
    ["perception6m", "Como quer ser percebida em 6 a 12 meses"], ["successMetric", "Como o cliente sabe que funcionou"],
  ]],
  ["O que vende e pra quem", [
    ["offer", "O que a marca vende"], ["mainProducts", "Produtos e serviços"], ["valueProp", "Proposta de valor"],
    ["specialty", "Especialidade técnica"], ["audience", "Público"], ["contentThemes", "Pilares de conteúdo"],
    ["coreMessage", "Mensagem central"],
  ]],
  ["Como falar", [
    ["toneOfVoice", "Tom de voz"], ["archetype", "Arquétipo"], ["personality", "Personalidade"],
    ["communicationStyle", "Estilo de comunicação"], ["avoid", "O que evitar"],
  ]],
  ["Visual", [
    ["colorPalette", "Paleta"], ["typography", "Tipografia"], ["visualExpression", "Expressão visual"],
  ]],
  ["História", [
    ["history", "Como a empresa nasceu"], ["brandValues", "Valores"], ["impact", "Transformação que quer gerar"],
    ["vision", "Visão"], ["marketSince", "Tempo de mercado"], ["admiredBrands", "Marcas que admira"],
  ]],
];
const COPIA_PERSONA: [string, string][] = [
  ["pains", "Dores"], ["desires", "Desejos"], ["doubts", "Dúvidas antes de fechar"], ["objections", "Objeções"],
  ["seeks", "O que procura"], ["valuesWhat", "O que valoriza"], ["buying", "Como compra"], ["lifestyle", "Estilo de vida"],
];

export function BrandbookDoCrmEditavel({ clientId, nomeCliente }: { clientId: string; nomeCliente: string }) {
  const { form, setForm, saveState, isLoading } = useFichaEditavel(clientId, {
    /* Só brandbook e persona. O cabeçalho do cliente fica montado aqui do lado
       e escreve status, cor, foto e valor no mesmo registro: se este autosave
       mandasse a ficha inteira, ele desfaria o que o cabeçalho acabou de fazer. */
    campos: ["brand_core", "persona"],
  });

  // isLoading e não só !form: query que falhou deixava o esqueleto pulsando
  // pra sempre, sem nunca dizer que deu erro.
  if (isLoading) return <div className="h-72 rounded-2xl bg-muted animate-pulse" />;
  if (!form) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-body font-medium text-foreground">Não consegui carregar a ficha deste cliente</p>
        <p className="text-xs font-body text-muted-foreground mt-1">Recarregue a página e tente de novo.</p>
      </div>
    );
  }

  const copiarTudo = async () => {
    const bc = form.brand_core ?? {};
    const linhas: string[] = [`Brandbook de ${nomeCliente || form.name}`, ""];
    for (const [titulo, campos] of COPIA_BRAND) {
      const cheios = campos.filter(([k]) => (bc[k] ?? "").trim());
      if (cheios.length === 0) continue;
      linhas.push(`## ${titulo}`);
      for (const [k, rotulo] of cheios) linhas.push(`${rotulo}: ${bc[k]}`);
      linhas.push("");
    }
    const personas = personasDaFicha(form).filter((p) => COPIA_PERSONA.some(([k]) => (p[k] ?? "").trim()));
    personas.forEach((p, i) => {
      linhas.push(`## Persona ${personas.length > 1 ? i + 1 : ""}`.trim());
      for (const [k, rotulo] of COPIA_PERSONA) if ((p[k] ?? "").trim()) linhas.push(`${rotulo}: ${p[k]}`);
      linhas.push("");
    });
    // Brandbook vazio copiava só o título e ainda dizia "copiado", o que
    // parece que funcionou até a pessoa colar e ver uma linha só.
    if (linhas.length <= 2) { toast.error("O brandbook deste cliente ainda está vazio."); return; }
    await navigator.clipboard.writeText(linhas.join("\n"));
    toast.success("Brandbook copiado. Cole no ChatGPT ou no Claude.");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          {/* O texto antigo abria explicando um detalhe interno ("este cliente
              não tem conta no Cria, então a direção vem da ficha do CRM"), que
              não é problema de ninguém que abre esta tela. O que a pessoa
              precisa saber é o que ISSO faz por ela. */}
          <p className="text-sm font-display font-semibold text-foreground">A direção da marca deste cliente</p>
          <p className="text-xs font-body text-muted-foreground mt-0.5 leading-relaxed">
            É daqui que sai o tom, os pilares e a persona de tudo que você escreve pra ele, e é isto que a Cria IA lê
            quando gera ideia, legenda e prompt de arte. Quanto mais completo, menos genérico sai. Edite direto nos
            campos: salva sozinho.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-xs font-body px-2.5 py-1.5 rounded-lg transition-colors",
            saveState === "saving" ? "text-muted-foreground bg-muted"
            : saveState === "saved" ? "text-emerald-600 bg-emerald-500/10"
            : "text-muted-foreground")}>
            {saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo" : "Salva automático"}
          </span>
          <Button variant="outline" size="sm" onClick={copiarTudo}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar tudo
          </Button>
          {/* O "Copiar tudo" leva a marca pro chat de IA; o PDF leva a marca pro
              cliente. São os dois destinos do mesmo conteúdo, então ficam lado a lado. */}
          <BotaoBrandbookPdf form={form} nome={nomeCliente} />
        </div>
      </div>

      {/* comPersona: a Persona é mais uma aba do editor, nos dois caminhos. */}
      <BrandbookEditor form={form} setForm={setForm} isCria={false} comPersona comLinkCadastro />
    </div>
  );
}


/** O brandbook do cliente, decidindo a fonte: com conta Cria, o que ele
 *  preencheu lá; sem conta, o editor da ficha do CRM. */
export function BrandbookDoCliente({ crmClientId, criaOwnerId, nomeCliente }: {
  crmClientId: string; criaOwnerId: string | null; nomeCliente: string;
}) {
  return criaOwnerId
    ? <ClienteBrandbookCria criaOwnerId={criaOwnerId} crmClientId={crmClientId} clienteNome={nomeCliente} />
    : <BrandbookDoCrmEditavel clientId={crmClientId} nomeCliente={nomeCliente} />;
}
