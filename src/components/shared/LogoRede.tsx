import { cn } from "@/lib/utils";

/* LOGOS OFICIAIS DAS REDES (Walter, 25/11/2026: "pq nao bota a logo do youtube
   e do tiktok e do google drive?"). Logo de marca, nas cores de cada rede, num
   círculo do mesmo tamanho do avatar do Instagram conectado. Nada de letra nem
   ícone genérico. `selo`: versão pequena pra ficar no canto de uma foto. */

export type MarcaRede = "youtube" | "tiktok" | "linkedin" | "drive" | "instagram";

const TT = "M19.589 6.686a4.793 4.793 0 01-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 01-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 013.183-4.51v-3.5a6.329 6.329 0 00-5.232 3.052 6.334 6.334 0 00.52 7.495 6.333 6.333 0 005.435 2.373 6.333 6.333 0 005.903-4.413V7.722a8.21 8.21 0 005.056 1.716v-3.5a4.746 4.746 0 01-2.449-.752z";
const YT = "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z";
const LI = "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z";

function Desenho({ marca, px }: { marca: MarcaRede; px: number }) {
  if (marca === "youtube") return (
    <svg width={px} height={px} viewBox="0 0 24 24" aria-hidden><path d={YT} fill="#FF0000" /><path d="M9.545 15.568V8.432L15.818 12z" fill="#fff" /></svg>
  );
  if (marca === "tiktok") return (
    <svg width={px} height={px} viewBox="0 0 24 24" aria-hidden>
      <path d={TT} fill="#25F4EE" transform="translate(-1 -1)" /><path d={TT} fill="#FE2C55" transform="translate(1 1)" /><path d={TT} fill="#fff" />
    </svg>
  );
  if (marca === "linkedin") return (
    <svg width={px} height={px} viewBox="0 0 24 24" aria-hidden><path d={LI} fill="#fff" /></svg>
  );
  if (marca === "instagram") return (
    <svg width={px} height={px} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="4.3" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" />
    </svg>
  );
  return (
    <svg width={px} height={px * 78 / 87.3} viewBox="0 0 87.3 78" aria-hidden>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

const FUNDO: Record<MarcaRede, string> = {
  youtube: "bg-white border border-border",
  tiktok: "bg-black",
  linkedin: "bg-[#0A66C2]",
  drive: "bg-white border border-border",
  instagram: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4]",
};
const MIOLO: Record<MarcaRede, number> = { youtube: 24, tiktok: 22, linkedin: 20, drive: 22, instagram: 22 };

export function LogoRede({ marca, className, tamanho = 40 }: { marca: MarcaRede; className?: string; tamanho?: number }) {
  const px = Math.round(MIOLO[marca] * tamanho / 40);
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full", FUNDO[marca], className)} style={{ width: tamanho, height: tamanho }}>
      <Desenho marca={marca} px={px} />
    </span>
  );
}

/** Foto do canal ou perfil com a logo da rede de selinho no canto. */
export function FotoComSelo({ src, marca }: { src: string; marca: MarcaRede }) {
  return (
    <span className="relative h-10 w-10 shrink-0">
      <img src={src} alt="" className="h-10 w-10 rounded-full object-cover" />
      <LogoRede marca={marca} tamanho={18} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card" />
    </span>
  );
}
