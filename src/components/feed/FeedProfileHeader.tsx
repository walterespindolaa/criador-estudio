import { Clapperboard, Grid3X3, SquareUser } from "lucide-react";
import type { Profile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

/* PERFIL COMO O INSTAGRAM NO IPHONE (Walter, 06/11/2026: "a grade do iPhone bem
   fidedigna"). Branco no claro e preto no escuro, igual ao app; @ no topo,
   foto à esquerda com nome e números ao lado, bio embaixo, botão cinza e as
   três abas com ícone. O resto da tela continua no visual do Cria. */

// Dados REAIS do Instagram conectado (via instagram-sync). Quando presentes,
// o header vira um espelho do perfil de verdade: foto, @ e seguidores atuais.
export type IgHeaderData = {
  username: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following?: number | null;
};

/** A fonte do sistema do iPhone (SF), com reserva parecida nos outros aparelhos. */
export const FONTE_IOS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

export type AbaFeed = "grade" | "reels" | "marcados";

type Props = {
  profile: Profile | null;
  postCount: number;
  ig?: IgHeaderData | null;
  // So aparece quando e a propria conta (manager gerenciando outro nao edita aqui).
  onEdit?: () => void;
  aba: AbaFeed;
  onAba: (a: AbaFeed) => void;
};

// 12345 -> "12,3 mil" (jeito que o proprio Instagram abrevia em PT).
function formataSeguidores(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 10_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR");
}

const ABAS: { key: AbaFeed; icone: typeof Grid3X3; rotulo: string }[] = [
  { key: "grade", icone: Grid3X3, rotulo: "Publicações" },
  { key: "reels", icone: Clapperboard, rotulo: "Reels" },
  { key: "marcados", icone: SquareUser, rotulo: "Marcações" },
];

export function FeedProfileHeader({ profile, postCount, ig, onEdit, aba, onAba }: Props) {
  const name = profile?.name || "Criador";
  const niche = profile?.niche || "";
  const bio = profile?.bio || "";
  const initial = name.charAt(0).toUpperCase();
  const avatar = ig?.avatarUrl || profile?.avatar_url || null;
  const handle = ig?.username || profile?.instagram_handle?.replace(/^@/, "") || null;

  const numero = (valor: string, rotulo: string) => (
    <div className="min-w-0">
      <p className="text-[16px] font-semibold leading-tight tabular-nums">{valor}</p>
      <p className="text-[13px] leading-tight">{rotulo}</p>
    </div>
  );

  return (
    <div className="text-[#000] dark:text-[#F5F5F5]" style={{ fontFamily: FONTE_IOS }}>
      {handle && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-[20px] font-bold tracking-tight truncate">{handle}</p>
        </div>
      )}
      <div className="px-4 pt-2 flex items-center gap-5">
        <div className="h-[86px] w-[86px] shrink-0 overflow-hidden rounded-full bg-[#EFEFEF] dark:bg-[#262626]">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              // Link do CDN da Meta expirado: cai pra foto do perfil do CRIA
              // em vez de mostrar o icone de imagem quebrada.
              onError={(e) => {
                const img = e.currentTarget;
                if (profile?.avatar_url && img.src !== profile.avatar_url) img.src = profile.avatar_url;
                else img.style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-2xl font-semibold text-[#737373]">{initial}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold truncate mb-1.5">{name}</p>
          <div className="grid grid-cols-3 gap-2">
            {numero(String(postCount), postCount === 1 ? "post" : "posts")}
            {numero(typeof ig?.followers === "number" ? formataSeguidores(ig.followers) : "-", "seguidores")}
            {numero(typeof ig?.following === "number" ? formataSeguidores(ig.following) : "-", "seguindo")}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 text-[14px] leading-[18px]">
        {niche && <p className="text-[#737373] dark:text-[#A8A8A8]">{niche}</p>}
        {bio && <p className="whitespace-pre-line">{bio}</p>}
      </div>

      {onEdit && (
        <div className="px-4 pt-3">
          <button type="button" onClick={onEdit}
            className="w-full h-8 rounded-lg bg-[#EFEFEF] dark:bg-[#363636] text-[14px] font-semibold hover:bg-[#DBDBDB] dark:hover:bg-[#262626] transition-colors">
            Editar perfil
          </button>
        </div>
      )}

      <div className="mt-4 flex border-t border-[#DBDBDB] dark:border-[#262626]" role="tablist" aria-label="Abas do perfil">
        {ABAS.map(({ key, icone: Icone, rotulo }) => (
          <button key={key} type="button" role="tab" aria-selected={aba === key} aria-label={rotulo} onClick={() => onAba(key)}
            className={cn("flex-1 h-11 grid place-items-center border-b transition-colors",
              aba === key ? "border-[#000] dark:border-[#F5F5F5] text-[#000] dark:text-[#F5F5F5]" : "border-transparent text-[#737373] dark:text-[#A8A8A8]")}>
            <Icone className="h-6 w-6" strokeWidth={aba === key ? 2 : 1.6} />
          </button>
        ))}
      </div>
    </div>
  );
}
