export type PostTemplateCategory =
  | "howto"
  | "story"
  | "tip"
  | "question"
  | "list"
  | "opinion"
  | "behindscenes"
  | "cta";

export type PostTemplate = {
  id: string;
  category: PostTemplateCategory;
  title: string;
  description: string;
  caption: string;
  format: string;
  icon: string;
};

export const POST_TEMPLATES: PostTemplate[] = [
  // HOW-TO
  {
    id: "howto-1",
    category: "howto",
    title: "Tutorial passo a passo",
    description: "Ensine algo em 3-5 passos práticos",
    caption:
      "Como {{resultado desejado}} em {{tempo}} 👇\n\n1️⃣ {{passo 1}}\n2️⃣ {{passo 2}}\n3️⃣ {{passo 3}}\n\nSalva esse post pra consultar depois! 📌\n\nQual passo você já faz? Me conta aqui 👇",
    format: "carrossel",
    icon: "📋",
  },
  {
    id: "howto-2",
    category: "howto",
    title: "Antes e Depois",
    description: "Mostre uma transformação com o processo",
    caption:
      "{{situação antes}} → {{situação depois}}\n\nO que mudou? {{processo/método}}\n\nO segredo? {{insight principal}}.\n\nSe você quer o mesmo resultado, salva esse post e começa pelo passo 1.\n\nJá passou por essa transformação? Me conta! 💬",
    format: "reels",
    icon: "✨",
  },

  // STORY
  {
    id: "story-1",
    category: "story",
    title: "Storytelling pessoal",
    description: "Conte uma história sua que ensina algo",
    caption:
      "{{Frase de impacto sobre o momento}}.\n\nEu {{situação inicial}}. Todo mundo {{reação esperada}}, mas eu {{decisão diferente}}.\n\nResultado? {{resultado surpreendente}}.\n\nA lição que eu levo: {{aprendizado}}.\n\nVocê já viveu algo parecido? 💭",
    format: "reels",
    icon: "📖",
  },
  {
    id: "story-2",
    category: "story",
    title: "O que eu gostaria de saber antes",
    description: "Compartilhe lições que aprendeu tarde",
    caption:
      "Se eu pudesse voltar no tempo, eu diria pra mim:\n\n❌ Pare de {{erro comum}}\n✅ Comece a {{hábito positivo}}\n🔑 Entenda que {{verdade que demorou pra aprender}}\n\nIsso teria me economizado {{tempo/dinheiro/energia}}.\n\nQual conselho você daria pro seu eu do passado?",
    format: "carrossel",
    icon: "⏪",
  },

  // TIP
  {
    id: "tip-1",
    category: "tip",
    title: "Dica rápida",
    description: "Uma dica prática em formato curto",
    caption:
      "Dica que vale ouro 🪙\n\n{{Dica específica e acionável}}\n\nPor quê? {{Explicação em 1-2 frases}}.\n\nTesta e me conta o resultado! 🚀",
    format: "foto",
    icon: "💡",
  },
  {
    id: "tip-2",
    category: "tip",
    title: "Mito vs Verdade",
    description: "Desminta um mito comum do seu nicho",
    caption:
      "❌ MITO: \"{{crença popular errada}}\"\n\n✅ VERDADE: {{fato real com explicação}}\n\nA maioria das pessoas acredita nisso porque {{razão}}. Mas a realidade é {{dado/experiência}}.\n\nVocê acreditava nesse mito? 🤔",
    format: "carrossel",
    icon: "🔍",
  },

  // QUESTION
  {
    id: "question-1",
    category: "question",
    title: "Enquete/Debate",
    description: "Gere engajamento com uma pergunta polêmica",
    caption:
      "{{Pergunta polêmica ou divisiva}} 🤔\n\nOpção A: {{posição 1}}\nOpção B: {{posição 2}}\n\nEu pessoalmente acho que {{sua opinião}}, mas quero ouvir vocês!\n\nComenta A ou B e defende sua escolha 👇",
    format: "foto",
    icon: "🗳️",
  },

  // LIST
  {
    id: "list-1",
    category: "list",
    title: "Top 5 / Top 10",
    description: "Liste os melhores itens de um tema",
    caption:
      "{{Número}} {{coisas}} que {{benefício}} 🏆\n\n1. {{item + porquê}}\n2. {{item + porquê}}\n3. {{item + porquê}}\n4. {{item + porquê}}\n5. {{item + porquê}}\n\nQual é o seu favorito? Eu amo o número {{X}}! 💜",
    format: "carrossel",
    icon: "📝",
  },

  // BEHIND THE SCENES
  {
    id: "bts-1",
    category: "behindscenes",
    title: "Um dia na minha rotina",
    description: "Mostre os bastidores do seu dia",
    caption:
      "Um dia real criando conteúdo 📱\n\n☀️ {{manhã}}\n🌤️ {{tarde}}\n🌙 {{noite}}\n\nNão é glamouroso, mas é consistente. E consistência > perfeição.\n\nComo é a rotina de vocês? 📋",
    format: "reels",
    icon: "🎬",
  },

  // CTA
  {
    id: "cta-1",
    category: "cta",
    title: "Oferta / Promoção",
    description: "Promova algo com urgência",
    caption:
      "🚨 {{Nome da oferta/produto}}\n\n{{Benefício principal em 1 frase}}\n\n✅ {{Incluído 1}}\n✅ {{Incluído 2}}\n✅ {{Incluído 3}}\n\n⏰ {{Urgência: vagas limitadas / desconto até data}}\n\n👉 Link na bio pra garantir o seu!",
    format: "foto",
    icon: "🎯",
  },

  // OPINION
  {
    id: "opinion-1",
    category: "opinion",
    title: "Opinião impopular",
    description: "Compartilhe uma visão contrária ao senso comum",
    caption:
      "Opinião impopular: {{afirmação contrária}} 🔥\n\nEu sei que a maioria pensa que {{senso comum}}. Mas na minha experiência, {{argumento com base}}.\n\nIsso pode incomodar quem {{grupo afetado}}, mas precisava ser dito.\n\nConcorda ou discorda? Debate aberto 👇",
    format: "reels",
    icon: "🔥",
  },
  {
    id: "opinion-2",
    category: "opinion",
    title: "Pare de fazer isso",
    description: "Alerte sobre um erro comum",
    caption:
      "Se você ainda {{erro comum}}, para agora. Sério.\n\nIsso está {{consequência negativa}}.\n\nEm vez disso, tenta {{alternativa melhor}}. Eu fiz a troca {{tempo}} atrás e {{resultado positivo}}.\n\nVocê faz isso? Me conta 👇",
    format: "reels",
    icon: "🛑",
  },
];

export const TEMPLATE_CATEGORIES: { key: "all" | PostTemplateCategory; label: string; icon: string }[] = [
  { key: "all", label: "Todos", icon: "🔤" },
  { key: "howto", label: "How-to", icon: "📋" },
  { key: "story", label: "Story", icon: "📖" },
  { key: "tip", label: "Dica", icon: "💡" },
  { key: "question", label: "Pergunta", icon: "🗳️" },
  { key: "list", label: "Lista", icon: "📝" },
  { key: "opinion", label: "Opinião", icon: "🔥" },
  { key: "behindscenes", label: "Bastidores", icon: "🎬" },
  { key: "cta", label: "CTA", icon: "🎯" },
];
