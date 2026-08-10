// Guardas compartilhadas para atalhos de teclado globais (window/document).
//
// Contexto: no macOS, segurar uma letra abre o seletor de acentos (press-and-hold).
// Esse popup só aparece quando a página deixa o fluxo de keydown seguir intacto
// até o campo focado: o navegador só entrega a tecla segurada pro sistema de
// texto nativo depois que os listeners da página rodam sem consumir o evento.
// Listener global que processa/cancela teclas repetidas (e.repeat) ou eventos de
// composição (e.isComposing, dead keys) faz o macOS desistir do popup e cair no
// auto-repeat cru, que é exatamente o bug de "letra repetindo em vez de abrir o
// seletor de acento".
//
// Regras pra qualquer atalho global novo:
// 1. chamar ehAtalhoSeguro(e) e sair cedo se for false;
// 2. atalho SEM modificador nunca dispara com foco em campo de texto
//    (usar ehCampoDeTexto no e.target), exceto teclas pensadas pra campo, tipo Escape;
// 3. preventDefault SÓ quando o atalho realmente casou (modificador + tecla),
//    nunca em letra pura.

/** O alvo do evento é um campo onde a pessoa digita? (input, textarea, select ou contenteditable) */
export function ehCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  const tag = alvo.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || alvo.isContentEditable;
}

/**
 * Filtro comum de atalho global: descarta o que nenhum atalho deveria processar.
 * - e.repeat: tecla segurada é digitação (ou o seletor de acentos do macOS), nunca atalho.
 * - e.isComposing / "Dead" / "Process": acento ou IME em andamento; mexer aqui quebra a composição.
 */
export function ehAtalhoSeguro(e: Pick<KeyboardEvent, "repeat" | "isComposing" | "key">): boolean {
  if (e.repeat) return false;
  if (e.isComposing || e.key === "Dead" || e.key === "Process") return false;
  return true;
}
