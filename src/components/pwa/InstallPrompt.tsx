import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Bell, Zap, WifiOff, Share, PlusSquare, Loader2, CheckCircle2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { pushSupported, isPushEnabled, enablePush } from "@/lib/push";
import { estaInstalado, ehIOS, ehMobile } from "@/lib/pwa";

/* ═══════════════════════════════════════════════════════════════════════════
   INSTALAR O APP + LIGAR AS NOTIFICAÇÕES

   Ninguém instala o que não pede pra ser instalado. Não existia NADA disso no
   sistema: nem o `beforeinstallprompt` (Android/Chrome) nem a instrução do iOS
   (que não tem esse evento e exige "Compartilhar → Adicionar à Tela de Início").

   E tem um detalhe que muda tudo: NO IPHONE, O PUSH SÓ FUNCIONA SE O APP
   ESTIVER INSTALADO NA TELA DE INÍCIO. Ou seja, todo o trabalho de notificação
   que já existe estava desligado pra metade da base por falta de um banner.

   Por isso os dois passos moram no mesmo lugar: instalar é o meio, a notificação
   é o motivo. E o motivo é dito em benefício, não em recurso ("o cliente aprovou"
   em vez de "notificações push").
   ═══════════════════════════════════════════════════════════════════════════ */

const CHAVE_DISPENSADO = "cria_pwa_dispensado_em";
const CHAVE_SESSOES = "cria_sessoes";
/** Dispensou? Some por 14 dias. Insistir é o caminho mais curto pra desinstalação. */
const DIAS_ATE_PERGUNTAR_DE_NOVO = 14;
/** Não pede na 1ª visita: a pessoa ainda não sabe se gosta. */
const SESSAO_MINIMA = 2;

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function contarSessao(): number {
  try {
    const n = Number(localStorage.getItem(CHAVE_SESSOES) ?? "0") + 1;
    localStorage.setItem(CHAVE_SESSOES, String(n));
    return n;
  } catch {
    return 99;
  }
}

function foiDispensadoRecentemente(): boolean {
  try {
    const em = Number(localStorage.getItem(CHAVE_DISPENSADO) ?? "0");
    if (!em) return false;
    return Date.now() - em < DIAS_ATE_PERGUNTAR_DE_NOVO * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

const GANHOS = [
  { icon: Bell, t: "Saiba na hora que o cliente aprovou", d: "Aprovou, pediu ajuste, comentou: chega no seu celular sem você abrir nada." },
  { icon: Zap, t: "Abre instantâneo", d: "Sem barra de endereço, sem carregar de novo. Abre como qualquer app do celular." },
  { icon: WifiOff, t: "Funciona sem internet", d: "No elevador, no metrô: você continua usando e tudo sincroniza quando a rede volta." },
];

export function InstallPrompt() {
  const { user } = useAuth();
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [aberto, setAberto] = useState(false);
  const [instalado, setInstalado] = useState(() => estaInstalado());
  const [ios] = useState(() => ehIOS());
  const [pushLigado, setPushLigado] = useState(false);
  const [ligandoPush, setLigandoPush] = useState(false);
  const [checou, setChecou] = useState(false);

  // Captura o evento do Chrome/Android. Ele só dispara uma vez, então precisa
  // ser guardado assim que chega, mesmo que a gente vá usar depois.
  useEffect(() => {
    const capturar = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", capturar);
    const instalou = () => { setInstalado(true); setBip(null); };
    window.addEventListener("appinstalled", instalou);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturar);
      window.removeEventListener("appinstalled", instalou);
    };
  }, []);

  useEffect(() => { void isPushEnabled().then((v) => { setPushLigado(v); setChecou(true); }); }, []);

  // Decide se mostra. Regras: logado, não dispensou faz pouco tempo, e já é a
  // 2ª sessão. Se JÁ está instalado mas sem push, ainda vale mostrar: é o caso
  // do iPhone que instalou e nunca ligou o aviso.
  useEffect(() => {
    if (!user || !checou) return;
    const sessao = contarSessao();
    if (sessao < SESSAO_MINIMA) return;
    if (foiDispensadoRecentemente()) return;

    // Só convida a instalar quem TEM como instalar: ou o navegador disparou o
    // beforeinstallprompt (Chrome/Edge, inclusive desktop), ou é um celular
    // (onde o passo a passo manual faz sentido). Desktop Firefox/Safari não
    // tem nem um nem outro; antes eles viam instrução de iPhone num PC.
    const precisaInstalar = !instalado && (!!bip || ehMobile());
    const precisaPush = pushSupported() && !pushLigado && instalado;
    if (!precisaInstalar && !precisaPush) return;

    // Deixa a tela montar antes de aparecer por cima dela.
    const t = setTimeout(() => setAberto(true), 2500);
    return () => clearTimeout(t);
  }, [user, checou, instalado, pushLigado]);

  const dispensar = useCallback(() => {
    try { localStorage.setItem(CHAVE_DISPENSADO, String(Date.now())); } catch { /* modo privado */ }
    setAberto(false);
  }, []);

  const instalar = async () => {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    setBip(null);
    if (outcome === "accepted") {
      setInstalado(true);
      toast.success("CRIA instalado! Abra pelo ícone na sua tela de início.");
    } else {
      dispensar();
    }
  };

  const ligarPush = async () => {
    if (!user) return;
    setLigandoPush(true);
    try {
      const r = await enablePush(user.id);
      if (r.ok) {
        setPushLigado(true);
        toast.success("Pronto! Você vai ser avisado assim que o cliente responder.");
        setAberto(false);
      } else if (r.reason === "denied") {
        toast.error("Permissão negada. Você pode reativar nas configurações do site.");
        dispensar();
      } else {
        toast.error("Não consegui ativar os avisos agora.");
      }
    } finally {
      setLigandoPush(false);
    }
  };

  if (!aberto) return null;

  // Três estados possíveis, e a UI muda de acordo:
  // 1. Android/Chrome, não instalado → botão que instala de verdade
  // 2. iOS, não instalado → instrução (o iOS não deixa instalar por código)
  // 3. Instalado, sem push → botão que liga o aviso
  const modo: "instalar" | "ios" | "push" = instalado ? "push" : bip ? "instalar" : "ios";

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-[#0A0A0A]/55 backdrop-blur-[2px] p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <OrganicBlobs color="laranja" />

        <button
          onClick={dispensar}
          aria-label="Agora não"
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 mb-3">
            {modo === "push" ? <Bell className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            <span className="text-[11px] font-body font-bold uppercase tracking-wider">
              {modo === "push" ? "Falta um passo" : "Leva 5 segundos"}
            </span>
          </span>

          <h2 className="font-display text-xl font-extrabold text-foreground tracking-tight">
            {modo === "push"
              ? "Quer saber na hora que o cliente responder?"
              : "Deixe o CRIA na sua tela de início"}
          </h2>
          <p className="mt-1.5 text-sm font-body text-muted-foreground leading-relaxed">
            {modo === "push"
              ? "Você já instalou o app. Agora é só ligar os avisos: aprovação, ajuste pedido e post do dia chegam direto no seu celular."
              : "Não é loja, não ocupa espaço, não pede nada. Vira um ícone igual aos outros apps do seu celular."}
          </p>

          {modo !== "push" && (
            <ul className="mt-4 space-y-2.5">
              {GANHOS.map((g) => {
                const G = g.icon;
                return (
                  <li key={g.t} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <G className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-display font-bold text-foreground">{g.t}</span>
                      <span className="block text-[12px] font-body text-muted-foreground leading-relaxed">{g.d}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Instrução manual (nem iOS nem Android disparam a instalação por código
              em todos os casos). Antes isto mostrava SEMPRE o passo do iPhone —
              então um usuário de Android via "abra no Safari", que ele não tem. */}
          {modo === "ios" && (
            <div className="mt-4 rounded-2xl border border-border bg-background/70 p-3.5">
              {ios ? (
                <>
                  <p className="text-[12px] font-display font-bold text-foreground mb-2">No iPhone, é assim:</p>
                  <ol className="space-y-1.5">
                    <li className="flex items-center gap-2 text-[12px] font-body text-muted-foreground">
                      <Share className="h-4 w-4 text-primary shrink-0" />
                      1. Toque em <strong className="text-foreground">Compartilhar</strong> na barra do Safari
                    </li>
                    <li className="flex items-center gap-2 text-[12px] font-body text-muted-foreground">
                      <PlusSquare className="h-4 w-4 text-primary shrink-0" />
                      2. Escolha <strong className="text-foreground">Adicionar à Tela de Início</strong>
                    </li>
                    <li className="flex items-center gap-2 text-[12px] font-body text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      3. Abra o CRIA pelo ícone e ligue os avisos
                    </li>
                  </ol>
                  <p className="mt-2.5 text-[11px] font-body text-muted-foreground leading-relaxed">
                    No iPhone os avisos <strong>só funcionam</strong> com o app na tela de início. É uma regra da Apple, não nossa.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[12px] font-display font-bold text-foreground mb-2">No Android, é assim:</p>
                  <ol className="space-y-1.5">
                    <li className="flex items-center gap-2 text-[12px] font-body text-muted-foreground">
                      <MoreVertical className="h-4 w-4 text-primary shrink-0" />
                      1. Toque no menu <strong className="text-foreground">⋮</strong> do navegador (canto superior)
                    </li>
                    <li className="flex items-center gap-2 text-[12px] font-body text-muted-foreground">
                      <Download className="h-4 w-4 text-primary shrink-0" />
                      2. Escolha <strong className="text-foreground">Instalar app</strong> (ou "Adicionar à tela inicial")
                    </li>
                    <li className="flex items-center gap-2 text-[12px] font-body text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      3. Abra o CRIA pelo ícone e ligue os avisos
                    </li>
                  </ol>
                  <p className="mt-2.5 text-[11px] font-body text-muted-foreground leading-relaxed">
                    Os avisos chegam mesmo com o app fechado, depois que ele está na tela inicial.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            {modo === "instalar" && (
              <Button onClick={instalar} size="lg" className="flex-1">
                <Download className="h-4 w-4 mr-1.5" /> Instalar o CRIA
              </Button>
            )}
            {modo === "push" && (
              <Button onClick={ligarPush} disabled={ligandoPush} size="lg" className="flex-1">
                {ligandoPush ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Bell className="h-4 w-4 mr-1.5" />}
                Ligar os avisos
              </Button>
            )}
            {modo === "ios" && (
              <Button onClick={dispensar} size="lg" className="flex-1">Entendi</Button>
            )}
            {modo !== "ios" && (
              <button
                onClick={dispensar}
                className="shrink-0 text-sm font-body text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Agora não
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
