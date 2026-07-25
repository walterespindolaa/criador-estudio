/* Utilitários de PWA compartilhados (instalação, plataforma, badge, haptics). */

/** O app está rodando instalado (ícone na tela de início), não numa aba? */
export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(standalone || iosStandalone);
}

export function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * É um aparelho móvel (Android/iOS)? Importa pro convite de instalação: em
 * desktop Firefox/Safari não existe `beforeinstallprompt` NEM o passo a passo
 * do celular faz sentido; mostrar "toque em Compartilhar no Safari" pra quem
 * está num PC só queima credibilidade.
 */
export function ehMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) return true;
  // iPad moderno se apresenta como Mac, mas tem toque:
  return /macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1;
}

/**
 * No iPhone, o push SÓ existe com o app instalado na tela de início (regra da
 * Apple). Pedir permissão no Safari em aba é garantia de falhar e queimar a
 * pergunta: o usuário nega uma vez e não dá pra pedir de novo.
 */
export function podePedirPushAgora(): boolean {
  if (ehIOS() && !estaInstalado()) return false;
  return true;
}

/**
 * Bolinha com número no ícone do app (Android/desktop). É o que traz a pessoa
 * de volta sem depender de notificação: ela bate o olho na tela do celular e vê
 * "3 posts esperando o cliente".
 */
export function definirBadge(n: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (n > 0) void nav.setAppBadge?.(n);
    else void nav.clearAppBadge?.();
  } catch {
    /* não suportado: silêncio, é enfeite */
  }
}

/**
 * Zera a bolinha do ícone do app. `setAppBadge` é um estado do SISTEMA
 * OPERACIONAL: uma vez marcado, ele fica no ícone mesmo depois que o motivo
 * some, até alguém mandar limpar. Por isso "ler tudo" precisa chamar isto
 * explicitamente, senão o ícone continua mostrando "1 em aberto" fantasma.
 */
export function limparBadge(): void {
  const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
  try {
    void nav.clearAppBadge?.();
  } catch {
    /* não suportado: silêncio, é enfeite */
  }
}

/**
 * Vibração curtinha. É o que faz o arrastar do card "parecer nativo": o dedo
 * sente que pegou e que soltou. iOS ignora (não expõe a API), Android responde.
 */
export function tocar(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignora */
  }
}
