import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============================================================
// BANCO DE HASHTAGS DO CLIENTE
//
// Guarda o bloco de hashtags que a social mídia usa nos posts daquele cliente
// (#hof #balneariocamboriu #harmonizacaofacial...), na ORDEM em que ela montou,
// pra copiar tudo de uma vez e colar na legenda do Instagram.
//
// Mora em crm_clients.hashtags (text[]). A justificativa completa de coluna x
// tabela está no comentário da migration 20260802000004_client_hashtags.sql.
//
// TUDO AQUI É DEFENSIVO, mesmo padrão do usePostTags: enquanto a migration não
// roda, a coluna não existe. Nesse caso a leitura devolve vazio (nenhuma tela
// quebra) e só a ESCRITA avisa que falta rodar o SQL.
// ============================================================

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

// A migration ainda não rodou? O Postgres devolve 42703 (coluna) / 42P01 (tabela).
// Também cai aqui a mensagem crua do PostgREST quando o schema não conhece o campo.
function faltaMigration(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  const code = err?.code ?? "";
  if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") return true;
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find");
}

const AVISO_MIGRATION =
  "O banco de hashtags ainda não foi liberado no banco de dados. Rode a migration e tente de novo.";

// O Instagram só considera 30 hashtags por post. Passar disso não quebra nada,
// só faz o excedente ser ignorado, então a tela AVISA e não bloqueia: o banco
// do cliente pode (e costuma) ser maior do que o que vai em cada legenda.
export const LIMITE_HASHTAGS_POST = 30;

// Teto duro, igual ao check constraint da migration. Protege de alguém colar
// uma legenda inteira sem querer e o insert estourar erro do Postgres.
export const LIMITE_HASHTAGS_BANCO = 300;

// ============================================================
// NORMALIZAÇÃO
//
// Hashtag do Instagram não aceita acento, espaço nem pontuação: sobra letra,
// número e "_". Quem cola "#Harmonização Facial" está colando algo que NÃO
// funciona lá. Então normalizamos na entrada, num lugar só:
//   tira acento → tira o "#" que já veio → joga fora tudo que não é
//   letra/número/_ → minúsculas → devolve com um "#" na frente.
// "#Harmonização Facial" → "#harmonizacaofacial"
// ============================================================
export function normalizarHashtag(bruta: string): string | null {
  const semAcento = (bruta ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const limpa = semAcento
    .replace(/^#+/, "")            // "#" (ou "##") que já veio na frente
    .replace(/[^0-9A-Za-z_]/g, "") // espaço, acento restante, pontuação, emoji: fora
    .toLowerCase();
  return limpa ? `#${limpa}` : null;
}

// ============================================================
// PARSE DE UMA COLAGEM INTEIRA
//
// A pessoa vai colar o bloco todo de uma vez. Duas regras, nesta ordem:
//
// 1) Quebra de linha SEMPRE separa. Ninguém tem hashtag com \n no meio, e é
//    comum a lista vir uma por linha.
// 2) Dentro da linha: se tem "#", o "#" é o separador mais forte (cada bloco
//    vai de um "#" até o próximo). É isso que faz "#Harmonização Facial" virar
//    UMA hashtag (#harmonizacaofacial) e não duas metades. Se NÃO tem nenhum
//    "#", cai no separador comum: espaço, vírgula e ponto e vírgula.
//
// O preço da regra 2 é que colar uma frase solta grudada num "#" gruda a frase
// junto. É o caso raro, e o certo aqui é privilegiar o caso real: a pessoa cola
// um bloco de hashtags, não uma legenda.
//
// Já sai sem repetido (a normalização deixa tudo minúsculo, então "#HOF" e
// "#hof" são a mesma coisa).
// ============================================================
export function parseHashtags(texto: string): string[] {
  const saida: string[] = [];
  const vistas = new Set<string>();
  for (const linha of (texto ?? "").split(/[\r\n]+/)) {
    const pedacos = linha.includes("#") ? linha.split("#") : linha.split(/[\s,;]+/);
    for (const p of pedacos) {
      const tag = normalizarHashtag(p);
      if (tag && !vistas.has(tag)) { vistas.add(tag); saida.push(tag); }
    }
  }
  return saida;
}

// Junta o que já existe com o que chegou, sem duplicar e MANTENDO A ORDEM:
// as antigas ficam onde estavam, as novas entram no fim. Devolve também
// quantas foram ignoradas por já existirem, pra tela poder dizer isso.
export function mesclarHashtags(atuais: string[], novas: string[]): { lista: string[]; repetidas: number } {
  const vistas = new Set(atuais);
  const lista = [...atuais];
  let repetidas = 0;
  for (const t of novas) {
    if (vistas.has(t)) { repetidas++; continue; }
    vistas.add(t);
    lista.push(t);
  }
  return { lista, repetidas };
}

// O bloco pronto pra colar na legenda: separado por espaço, na ordem montada.
export function blocoParaColar(tags: string[]): string {
  return tags.join(" ");
}

// ── Leitura ──
// Query PRÓPRIA, separada do useCrmClient de propósito: se as hashtags fossem
// junto do select("*") da ficha, a ficha inteira ficaria refém desta coluna.
// Aqui, coluna ausente vira "esse cliente não tem hashtag ainda".
export function useClientHashtags(clientId: string | null | undefined) {
  return useQuery<string[]>({
    queryKey: ["client-hashtags", clientId ?? null],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_clients")
        .select("hashtags")
        .eq("id", clientId!)
        .maybeSingle();
      if (error) { if (faltaMigration(error)) return []; throw error; }
      const bruto = (data as unknown as { hashtags?: string[] | null } | null)?.hashtags;
      if (!Array.isArray(bruto)) return [];
      // Defesa também contra lixo antigo na coluna (null, string vazia).
      return bruto.filter((t): t is string => typeof t === "string" && t.trim() !== "");
    },
  });
}

// ── Escrita ──
// Grava o bloco INTEIRO. É a unidade certa aqui: adicionar, remover e reordenar
// são todos "o array agora é este". OTIMISTA, porque adicionar chip e ver o
// chip aparecer só depois do round-trip é péssimo no celular.
export function useSetClientHashtags(clientId: string | null | undefined) {
  const qc = useQueryClient();
  const key = ["client-hashtags", clientId ?? null];
  return useMutation({
    mutationFn: async (tags: string[]) => {
      if (!clientId) throw new Error("Sem cliente");
      const { error } = await sbFrom("crm_clients")
        .update({ hashtags: tags } as never)
        .eq("id", clientId);
      if (error) throw error;
    },
    onMutate: async (tags: string[]) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key);
      qc.setQueryData<string[]>(key, tags);
      return { prev };
    },
    onError: (e: unknown, _v, ctx) => {
      const c = ctx as { prev?: string[] } | undefined;
      // Rollback: a tela volta pro que estava antes, sem chip fantasma.
      if (c?.prev !== undefined) qc.setQueryData(key, c.prev);
      if (faltaMigration(e)) { toast.error(AVISO_MIGRATION); return; }
      const msg = (e as Error)?.message ?? "";
      if (msg.includes("crm_clients_hashtags_max")) {
        toast.error(`Passou de ${LIMITE_HASHTAGS_BANCO} hashtags neste cliente. Remova algumas antes de adicionar mais.`);
        return;
      }
      toast.error("Não consegui salvar as hashtags.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      // A ficha do cliente também carrega a coluna no select("*"); sem isso o
      // cache dela ficaria com o array velho.
      if (clientId) qc.invalidateQueries({ queryKey: ["crm-client", clientId] });
    },
  });
}
