import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { AutoMediaKit } from "@/components/mediakit/AutoMediaKit";
import { AssinaturaCria } from "@/components/publico/AssinaturaCria";
import { buscarKitPublico } from "@/hooks/useMediaKit";

/* LINK DO MEDIA KIT (Walter, 06/11/2026; mockup aprovado):
   criaclub.bio/nome/kit e criaclub.bio/nome/kit/versao. A marca abre no
   celular e vê os números do dia (a RPC calcula na hora a partir do que o
   robô do Instagram grava). Só aparece o que a pessoa deixou visível. A
   abertura conta uma vez por sessão do navegador. */

export default function MediaKitPublico() {
  const { slug = "", versao = null } = useParams<{ slug: string; versao?: string }>();
  useForceLightTheme();
  const chave = `mk-aberto:${slug}/${versao ?? ""}`;
  const contar = useMemo(() => {
    try { if (sessionStorage.getItem(chave)) return false; sessionStorage.setItem(chave, "1"); return true; } catch { return true; }
  }, [chave]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["media-kit-publico", slug, versao],
    queryFn: () => buscarKitPublico(slug, versao, contar),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (data?.nome) document.title = `${data.nome} · Media kit`;
  }, [data?.nome]);

  const atualizado = data?.atualizado_em
    ? new Date(`${data.atualizado_em}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;

  return (
    <div className="min-h-[100dvh] bg-[#F5F3E7] text-[#0A0A0A] px-3 sm:px-6 py-6 sm:py-10">
      <div className="mx-auto max-w-[880px]">
        {isLoading ? (
          <div className="py-32 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#0A0A0A]/60" /></div>
        ) : isError || !data ? (
          <div className="py-24 text-center">
            <p className="font-display font-extrabold text-2xl">Esse media kit não está no ar</p>
            <p className="mt-2 text-sm font-body text-[#6E675A]">Confira o endereço com quem te mandou o link.</p>
            <div className="mt-8 flex justify-center"><AssinaturaCria variante="rodape" tom="claro" altura={22} /></div>
          </div>
        ) : (
          <AutoMediaKit
            name={data.nome}
            handle={data.handle ?? ""}
            niche={data.niche}
            bio={data.bio}
            avatarUrl={data.avatar_url}
            kit={{ audience: data.audiencia, gender: data.genero, cities: data.cidades, services: data.servicos, contact: data.contato, accent: data.accent }}
            stats={data.stats ? { ...data.stats, ...(data.desempenho ?? {}) } : data.desempenho ? { followers: 0, reachMonth: 0, engagementPct: 0, saves: 0, ...data.desempenho } : null}
            posts={data.posts ?? []}
            updatedAt={atualizado}
            capa={data.capa}
            /* A RPC já tirou o que está desligado; aqui só não mostra bloco vazio. */
            mostrar={{ numeros: !!data.stats, audiencia: !!data.audiencia, desempenho: !!data.desempenho, conteudos: (data.posts ?? []).length > 0, valores: !!data.servicos }}
            contatoClicavel
          />
        )}
      </div>
    </div>
  );
}
