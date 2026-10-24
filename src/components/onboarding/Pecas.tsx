import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PEÇAS DO ONBOARDING v3 (24/10/2026, mockup aprovado pelo Walter)

   Linguagem da LP: fundo creme, cores chapadas, bolhas com olhos, post-its,
   uma pergunta por tela e botão preto fixo embaixo. As cores são fixas (hex),
   não seguem o tema do app: o onboarding é a primeira impressão e precisa ser
   igual pra todo mundo, inclusive pra quem está com o celular no modo escuro
   (as telas usam useForceLightTheme).
   ═══════════════════════════════════════════════════════════════════════════ */

export const COR = {
  creme: "#F5F3E7",
  papel: "#FDFBF5",
  tinta: "#0A0A0A",
  laranja: "#EA4918",
  azul: "#0061EE",
  rosa: "#FF77B9",
  amarelo: "#FFCF03",
  verde: "#01A652",
  borda: "#E4DECB",
  apagado: "#5B574C",
} as const;

export const FORMAS = [
  "42% 58% 63% 37% / 45% 40% 60% 55%",
  "60% 40% 35% 65% / 50% 60% 40% 50%",
  "50% 50% 40% 60% / 60% 45% 55% 40%",
  "30% 70% 60% 40% / 40% 35% 65% 60%",
  "55% 45% 60% 40% / 45% 60% 40% 55%",
] as const;

/** Casca de toda tela: creme de ponta a ponta, coluna de celular no centro. */
export function TelaOnb({ children, rodape, className }: { children: ReactNode; rodape?: ReactNode; className?: string }) {
  return (
    <div className="min-h-[100dvh] w-full font-body" style={{ background: COR.creme, color: COR.tinta }}>
      <div className={cn("relative mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden px-5 pt-4", rodape ? "pb-40" : "pb-8", className)}>
        {children}
      </div>
      {rodape && (
        <div className="fixed inset-x-0 bottom-0 z-30" style={{ background: `linear-gradient(to top, ${COR.creme} 70%, transparent)` }}>
          <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-2.5 px-5 pt-6"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
            {rodape}
          </div>
        </div>
      )}
    </div>
  );
}

/** Voltar + bolinhas de progresso + Pular (opcional). */
export function TopoOnb({ passo, total, onVoltar, onPular }: { passo: number; total: number; onVoltar?: () => void; onPular?: () => void }) {
  return (
    <div className="flex h-11 items-center gap-2.5">
      {onVoltar ? (
        <button type="button" onClick={onVoltar} aria-label="Voltar" className="-ml-2.5 grid h-11 w-11 place-items-center rounded-full hover:bg-black/5">
          <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
        </button>
      ) : <span className="w-8" />}
      <div className="flex flex-1 gap-1.5" aria-label={`Passo ${passo} de ${total}`}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i < passo ? COR.tinta : "#DCD6C3" }} />
        ))}
      </div>
      {onPular ? (
        <button type="button" onClick={onPular} className="min-h-11 px-1 text-sm font-medium" style={{ color: COR.apagado }}>Pular</button>
      ) : <span className="w-8" />}
    </div>
  );
}

/** Título grande da tela, com a parte final em laranja. */
export function TituloOnb({ antes, destaque, sub, className }: { antes: string; destaque?: string; sub?: ReactNode; className?: string }) {
  return (
    <header className={cn("text-center", className)}>
      <h1 className="mt-3 font-display text-[32px] font-extrabold leading-[1.02] tracking-[-0.5px] sm:text-[34px]">
        {antes}{destaque && <> <span style={{ color: COR.laranja }}>{destaque}</span></>}
      </h1>
      {sub && <p className="mx-auto mt-2 max-w-[340px] text-[14.5px] leading-snug" style={{ color: "#4A463D" }}>{sub}</p>}
    </header>
  );
}

/** Botão preto principal (largura toda). */
export function BotaoOnb({ children, onClick, disabled, type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-full font-display text-lg font-bold transition-transform hover:-translate-y-px disabled:translate-y-0 disabled:opacity-40"
      style={{ background: COR.tinta, color: COR.papel }}>
      {children}
    </button>
  );
}

export function MicroOnb({ children }: { children: ReactNode }) {
  return <p className="m-0 text-center text-[12.5px]" style={{ color: COR.apagado }}>{children}</p>;
}

/** Bolha com dois olhos (os bichinhos do Cria). */
export function Bicho({ cor, forma = FORMAS[0], tamanho = 52, giro = 0, boca, className }: {
  cor: string; forma?: string; tamanho?: number; giro?: number; boca?: string; className?: string;
}) {
  const olho = Math.max(10, Math.round(tamanho * 0.16));
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 flex-col items-center justify-center", className)}
      style={{ width: tamanho, height: Math.round(tamanho * 0.88), background: cor, borderRadius: forma, transform: `rotate(${giro}deg)`, gap: Math.round(tamanho * 0.05) }}>
      <span className="flex" style={{ gap: Math.round(olho * 0.45) }}>
        {[0, 1].map((k) => (
          <span key={k} className="rounded-full" style={{ width: olho, height: olho, background: `radial-gradient(circle at 60% 58%, ${COR.tinta} 0 36%, ${COR.papel} 38%)` }} />
        ))}
      </span>
      {boca && (
        <svg width={Math.round(tamanho * 0.28)} height={Math.round(tamanho * 0.13)} viewBox="0 0 40 18" fill="none" stroke={COR.tinta} strokeWidth="3.4" strokeLinecap="round">
          <path d={boca} />
        </svg>
      )}
    </span>
  );
}

/** Cartão/pílula selecionável: fica preto quando marcado. */
export function estiloMarcado(marcado: boolean) {
  return marcado
    ? { background: COR.tinta, color: COR.papel, borderColor: COR.tinta }
    : { background: COR.papel, color: COR.tinta, borderColor: COR.borda };
}

/** Selo picotado (o "carimbo" do fim do onboarding). */
export function SeloPicotado({ children, giro = -3, className }: { children: ReactNode; giro?: number; className?: string }) {
  return (
    <span className={cn("inline-block p-3 shadow-[0_10px_24px_rgba(10,10,10,0.12)]", className)}
      style={{ transform: `rotate(${giro}deg)`, background: `radial-gradient(circle at 7px 7px, ${COR.creme} 4.5px, ${COR.papel} 5px) -7px -7px / 14px 14px` }}>
      {children}
    </span>
  );
}

export const campoOnb =
  "h-[52px] w-full rounded-2xl border-2 bg-[#FDFBF5] px-4 text-base font-medium text-[#0A0A0A] outline-none placeholder:text-[#8A8577] focus:border-[#0A0A0A] border-[#DCD6C3]";
export const rotuloOnb = "mb-1.5 ml-1 block text-[13px] font-semibold text-[#4A463D]";
