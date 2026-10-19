import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check, CreditCard, FileText, FolderOpen, Instagram, Lock, MessageCircle, Send, Store, X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateCrmClient, type CrmClient } from "@/hooks/useCrm";
import { useCofreAcessos } from "@/hooks/useCofre";
import { useAbrirModulo } from "@/hooks/useAbrirModulo";
import { confirmar } from "@/components/shared/Confirm";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PRIMEIROS PASSOS DO CLIENTE (Walter, 19/10/2026, mockup aprovado)

   Um norte do que vale reunir no começo de cada cliente novo. Cada passo se
   marca SOZINHO olhando a ficha: ninguém precisa clicar em "feito".
   - Passo de módulo que a social mídia não tem fica tracejado, com o selo do
     módulo e "Conhecer", e NÃO entra no total: ela consegue terminar.
   - O X pergunta antes e esconde só pra aquele cliente (crm_clients.jornada_oculta).
   - Com tudo que está ao alcance feito, some sozinho.
   - Cliente que já existia antes desta tela não ganha a jornada.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Só clientes criados a partir do lançamento da jornada. */
const JORNADA_DESDE = "2026-10-19";

type sbFn = (t: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as sbFn;

type Passo = {
  chave: string; titulo: string; texto: string; Icon: LucideIcon; fundo: string; cor: string;
  feito: boolean; acao: string; onAcao: () => void;
  modulo?: { codigo: string; nome: string; tem: boolean };
};

export function JornadaCliente({ client, extClientId, displayName, hasGestao, hasPost, goTab, onEditarCadastro }: {
  client: CrmClient;
  extClientId: string | null;
  displayName: string;
  hasGestao: boolean;
  hasPost: boolean;
  goTab: (t: string) => void;
  onEditarCadastro: () => void;
}) {
  const c = client as CrmClient & { jornada_oculta?: boolean | null; created_at?: string | null };
  const ativa = !c.jornada_oculta && (c.created_at ?? "").slice(0, 10) >= JORNADA_DESDE;
  const update = useUpdateCrmClient();
  const abrirModulo = useAbrirModulo();

  const { data: acessos = [] } = useCofreAcessos(ativa ? client.id : null, ativa && hasGestao);

  // Instagram conectado: pela conta Cria do cliente ou pela conexão que a social mídia fez.
  const { data: igConectado = false } = useQuery({
    queryKey: ["jornada-ig", client.id, client.cria_owner_id ?? null],
    enabled: ativa,
    staleTime: 60_000,
    queryFn: async () => {
      let q = sbFrom("social_connections").select("id").eq("provider", "instagram").limit(1);
      q = client.cria_owner_id ? q.eq("user_id", client.cria_owner_id).is("crm_client_id", null) : q.eq("crm_client_id", client.id);
      const { data, error } = await q;
      if (error) return false;
      return (data ?? []).length > 0;
    },
  });

  // Primeiro post: algum post desse cliente já existe (no Cria Post ou na conta Cria dele).
  const { data: temPost = false } = useQuery({
    queryKey: ["jornada-post", client.id, extClientId, client.cria_owner_id ?? null],
    enabled: ativa && (!!extClientId || !!client.cria_owner_id),
    staleTime: 60_000,
    queryFn: async () => {
      let q = sbFrom("posts").select("id").is("deleted_at", null).limit(1);
      q = extClientId ? q.eq("external_client_id", extClientId) : q.eq("user_id", client.cria_owner_id!);
      const { data, error } = await q;
      if (error) return false;
      return (data ?? []).length > 0;
    },
  });

  const passos = useMemo<Passo[]>(() => {
    const bc = (client.brand_core ?? {}) as Record<string, unknown>;
    const temBrandbook = ["colorPalette", "toneOfVoice", "typography", "visualExpression"]
      .some((k) => typeof bc[k] === "string" && (bc[k] as string).trim().length > 0);
    const links = (client.useful_links ?? []) as { label?: string; url?: string }[];
    const temDrive = links.some((l) => /drive/i.test(l.label ?? "") || /drive\.google/i.test(l.url ?? ""));
    const gestao = { codigo: "crm", nome: "Cria Gestão", tem: hasGestao };
    const post = { codigo: "aprovapost_externo", nome: "Cria Post", tem: hasPost };
    return [
      { chave: "cadastro", titulo: "Cadastro da marca", texto: "Nome, @, logo e cor.", Icon: Store, fundo: "bg-orange-100 dark:bg-orange-500/15", cor: "text-orange-600",
        feito: !!client.logo && !!client.instagram && !!client.color, acao: "Completar", onAcao: onEditarCadastro },
      { chave: "brandbook", titulo: "Brandbook", texto: "Paleta, fontes, tom de voz. Sobe o PDF e confere.", Icon: FileText, fundo: "bg-rose-100 dark:bg-rose-500/15", cor: "text-rose-600",
        feito: temBrandbook, acao: "Subir o PDF", onAcao: () => goTab("brandbook"), modulo: gestao },
      { chave: "acessos", titulo: "Acessos e senhas", texto: "Instagram, Meta, Canva… guardados no cofre.", Icon: Lock, fundo: "bg-violet-100 dark:bg-violet-500/15", cor: "text-violet-600",
        feito: acessos.length > 0, acao: "Pedir pro cliente", onAcao: () => goTab("acessos"), modulo: gestao },
      { chave: "whatsapp", titulo: "WhatsApp do cliente", texto: "Pra mandar aprovação e avisos.", Icon: MessageCircle, fundo: "bg-emerald-100 dark:bg-emerald-500/15", cor: "text-emerald-600",
        feito: !!(client.whatsapp || client.phone), acao: "Preencher", onAcao: () => document.getElementById("campos-do-cliente")?.scrollIntoView({ behavior: "smooth", block: "center" }) },
      { chave: "contrato", titulo: "Contrato e pagamento", texto: "Mensalidade e dia. Entra sozinho no Cria Caixa.", Icon: CreditCard, fundo: "bg-amber-100 dark:bg-amber-500/15", cor: "text-amber-700",
        feito: !!client.monthly_value && !!client.payment_day, acao: "Preencher", onAcao: () => document.getElementById("campos-do-cliente")?.scrollIntoView({ behavior: "smooth", block: "center" }) },
      { chave: "instagram", titulo: "Instagram conectado", texto: "Pra ver os números no relatório do mês.", Icon: Instagram, fundo: "bg-pink-100 dark:bg-pink-500/15", cor: "text-pink-600",
        feito: igConectado, acao: "Conectar", onAcao: () => goTab("instagram") },
      { chave: "drive", titulo: "Pasta do Drive", texto: "Fotos e materiais num lugar só.", Icon: FolderOpen, fundo: "bg-blue-100 dark:bg-blue-500/15", cor: "text-blue-600",
        feito: temDrive, acao: "Colar o link", onAcao: () => goTab("links-uteis") },
      { chave: "post", titulo: "Primeiro post na aprovação", texto: "O cliente aprova pelo link, sem baixar nada.", Icon: Send, fundo: "bg-sky-100 dark:bg-sky-500/15", cor: "text-sky-600",
        feito: temPost, acao: "Criar post", onAcao: () => goTab("posts"), modulo: post },
    ];
  }, [client, hasGestao, hasPost, acessos.length, igConectado, temPost, goTab, onEditarCadastro]);

  if (!ativa) return null;

  const contam = passos.filter((p) => !p.modulo || p.modulo.tem);
  const feitos = contam.filter((p) => p.feito).length;
  const total = contam.length;
  if (total > 0 && feitos === total) return null;
  const proximo = contam.find((p) => !p.feito) ?? null;
  const travados = passos.filter((p) => p.modulo && !p.modulo.tem);
  const nomesTravados = [...new Set(travados.map((p) => p.modulo!.nome))];

  const R = 28;
  const C = 2 * Math.PI * R;
  const primeiro = displayName.trim();

  const esconder = async () => {
    const ok = await confirmar({
      titulo: `Esconder os primeiros passos ${primeiro ? `da ${primeiro}` : "deste cliente"}?`,
      descricao: "Eles não aparecem mais pra este cliente. Tudo continua nas abas da ficha, é só um atalho a menos.",
      acao: "Esconder",
      cancelar: "Manter",
    });
    if (!ok) return;
    await update.mutateAsync({ id: client.id, jornada_oculta: true } as never);
  };

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-emerald-200/70 dark:border-white/10 bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-violet-50 dark:from-emerald-500/10 dark:via-emerald-500/5 dark:to-violet-500/10 p-4 sm:p-5">
      <button type="button" onClick={() => void esconder()} aria-label="Esconder os primeiros passos deste cliente"
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-4 pr-8">
        <div className="relative h-[64px] w-[64px] shrink-0" title={`${feitos} de ${total} feitos`}>
          <svg viewBox="0 0 70 70" className="h-full w-full -rotate-90">
            <circle cx="35" cy="35" r={R} strokeWidth="8" fill="none" className="stroke-emerald-100 dark:stroke-white/10" />
            <circle cx="35" cy="35" r={R} strokeWidth="8" fill="none" strokeLinecap="round" className="stroke-emerald-600 transition-[stroke-dashoffset] duration-700"
              strokeDasharray={C} strokeDashoffset={C * (1 - (total ? feitos / total : 0))} />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-display text-base font-extrabold">{feitos}/{total}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-body font-extrabold uppercase tracking-[0.09em] text-emerald-800 dark:text-emerald-300 truncate">
            Primeiros passos{primeiro ? ` com ${primeiro}` : ""}
          </p>
          <h3 className="mt-0.5 font-display text-lg sm:text-[22px] font-extrabold leading-tight">Reúna o essencial e o resto do mês anda sozinho.</h3>
          <p className="mt-0.5 text-[13px] font-body text-muted-foreground">
            {proximo ? `Próximo: ${proximo.titulo.toLowerCase()}.` : ""}
            {nomesTravados.length > 0 && ` ${travados.length} ${travados.length === 1 ? "passo depende" : "passos dependem"} do ${nomesTravados.join(" e do ")} e ${travados.length === 1 ? "fica" : "ficam"} fora da conta.`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {passos.map((p) => {
          const travado = !!p.modulo && !p.modulo.tem;
          const eProximo = proximo?.chave === p.chave;
          return (
            <div key={p.chave}
              className={cn("flex min-h-[118px] flex-col gap-2 rounded-[18px] p-3 transition-all",
                travado ? "border-[1.5px] border-dashed border-border bg-card/50"
                  : p.feito ? "border border-white/80 dark:border-white/10 bg-card/45 opacity-75"
                  : eProximo ? "border-[1.5px] border-primary/40 bg-card shadow-[0_8px_20px_-14px_hsl(var(--primary)/0.6)]"
                  : "border border-white/90 dark:border-white/10 bg-card/85")}>
              <div className="flex items-center gap-2.5">
                <span className={cn("grid h-[34px] w-[34px] shrink-0 place-items-center rounded-xl",
                  p.feito && !travado ? "bg-emerald-100 dark:bg-emerald-500/15" : travado ? "bg-muted" : p.fundo)}>
                  {p.feito && !travado
                    ? <Check className="h-4 w-4 text-emerald-700" strokeWidth={2.5} />
                    : <p.Icon className={cn("h-4 w-4", travado ? "text-muted-foreground" : p.cor)} />}
                </span>
                <b className={cn("min-w-0 flex-1 text-[13.5px] font-body font-bold leading-tight",
                  p.feito && !travado && "line-through decoration-emerald-300", travado && "opacity-70")}>{p.titulo}</b>
                {travado ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-body font-extrabold text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">
                    <Lock className="h-2.5 w-2.5" strokeWidth={3} />{p.modulo!.nome}
                  </span>
                ) : eProximo ? (
                  <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-body font-extrabold text-primary">próximo</span>
                ) : p.modulo ? (
                  <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-body font-extrabold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">{p.modulo.nome}</span>
                ) : null}
              </div>
              <span className={cn("text-[11.5px] font-body leading-snug text-muted-foreground", travado && "opacity-70")}>{p.texto}</span>
              {p.feito && !travado ? (
                <span className="mt-auto text-[12px] font-body font-extrabold text-emerald-700">Feito</span>
              ) : travado ? (
                <button type="button" onClick={() => abrirModulo(p.modulo!.codigo)}
                  className="mt-auto self-start text-[12px] font-body font-extrabold text-violet-600 hover:underline">
                  Conhecer o {p.modulo!.nome}
                </button>
              ) : (
                <button type="button" onClick={p.onAcao}
                  className="mt-auto self-start text-[12px] font-body font-extrabold text-primary hover:underline">
                  {p.acao}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default JornadaCliente;
