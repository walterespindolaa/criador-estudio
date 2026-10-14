import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   COFRE DE ACESSOS DO CLIENTE (Walter, 14/10/2026)

   Logins e senhas das contas do cliente, dentro da ficha (Cria Gestão).
   Tudo passa por RPC security definer (migration 20261014000002_cofre_acessos):
   as tabelas não têm policy, então a API não lê nada direto. A listagem NUNCA
   traz a senha; ver ou copiar chama cofre_revelar, que registra no histórico.
   As RPCs não estão no types.ts (travado), por isso o cast igual ao do portal.
   ═══════════════════════════════════════════════════════════════════════════ */

type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

export type CofreAcesso = {
  id: string;
  plataforma: string;
  login: string | null;
  url: string | null;
  codigo_via: string | null;
  tem_senha: boolean;
  tem_observacao: boolean;
  senha_alterada_em: string | null;
  enviado_pelo_cliente: boolean;
  updated_at: string;
};
export type CofreStatus = { pode: boolean; sou_dono: boolean; tem_modulo: boolean };
export type CofreLog = { acao: string; plataforma: string | null; autor_nome: string | null; created_at: string };
export type CofreQuemVe = { nome: string; papel: "dona" | "colaboradora" | "parceiro"; pode: boolean };

// Plataformas sugeridas no formulário (a pessoa pode digitar outra).
export const COFRE_PLATAFORMAS = ["Instagram", "Facebook / Meta", "Meta Business", "Google Meu Negócio", "Google (e-mail)", "TikTok", "YouTube", "LinkedIn", "Site", "Outro"];
export const COFRE_CODIGO_VIA = ["SMS", "WhatsApp", "E-mail", "App autenticador", "Não pede"];

// Mensagem humana pros erros que as RPCs levantam.
export function cofreErro(e: unknown, acao: string): string {
  const msg = (e as { message?: string })?.message ?? "";
  if (msg.includes("sem_permissao")) return "Você não tem permissão pra ver os acessos deste cliente. Peça pra dona da conta liberar em Equipe.";
  if (msg.includes("plataforma_obrigatoria")) return "Diga de qual conta é o acesso (Instagram, Google…).";
  if (msg.includes("texto_grande_demais")) return "Algum campo ficou grande demais. Encurte e tente de novo.";
  if (msg.includes("muitas_tentativas")) return "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.";
  if (msg.includes("link_invalido")) return "Este link venceu ou foi desativado. Peça um novo pra sua social mídia.";
  if (msg.includes("limite_do_link")) return "Este link já recebeu o máximo de acessos. Peça um novo pra sua social mídia.";
  if (msg.includes("Could not find the function") || msg.includes("PGRST202")) return "O cofre ainda não foi ativado no banco. Rode a migration do cofre de acessos.";
  return `${acao} não deu certo. Verifique a conexão e tente de novo.`;
}

export function useCofreStatus(crmClientId: string | null) {
  return useQuery({
    queryKey: ["cofre-status", crmClientId],
    enabled: !!crmClientId,
    queryFn: async (): Promise<CofreStatus> => {
      const { data, error } = await sbRpc("cofre_status", { _crm_client_id: crmClientId });
      if (error) throw error;
      const row = (data as CofreStatus[] | null)?.[0];
      return row ?? { pode: false, sou_dono: false, tem_modulo: false };
    },
  });
}

export function useCofreAcessos(crmClientId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["cofre-acessos", crmClientId],
    enabled: !!crmClientId && enabled,
    queryFn: async (): Promise<CofreAcesso[]> => {
      const { data, error } = await sbRpc("cofre_listar", { _crm_client_id: crmClientId });
      if (error) throw error;
      return (data as CofreAcesso[]) ?? [];
    },
  });
}

export function useCofreHistorico(crmClientId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["cofre-historico", crmClientId],
    enabled: !!crmClientId && enabled,
    queryFn: async (): Promise<CofreLog[]> => {
      const { data, error } = await sbRpc("cofre_historico", { _crm_client_id: crmClientId });
      if (error) throw error;
      return (data as CofreLog[]) ?? [];
    },
  });
}

export function useCofreQuemVe(crmClientId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["cofre-quem-ve", crmClientId],
    enabled: !!crmClientId && enabled,
    queryFn: async (): Promise<CofreQuemVe[]> => {
      const { data, error } = await sbRpc("cofre_quem_ve", { _crm_client_id: crmClientId });
      if (error) throw error;
      return (data as CofreQuemVe[]) ?? [];
    },
  });
}

/* Revelar não é uma query: cada chamada vira uma linha no histórico, então
   só acontece quando a pessoa clica. A senha fica só na memória da tela. */
export async function cofreRevelar(acessoId: string, acao: "revelou" | "copiou_senha"): Promise<{ senha: string | null; observacao: string | null }> {
  const { data, error } = await sbRpc("cofre_revelar", { _acesso_id: acessoId, _acao: acao });
  if (error) throw error;
  const row = (data as { senha: string | null; observacao: string | null }[] | null)?.[0];
  return row ?? { senha: null, observacao: null };
}

export type CofreSalvarInput = {
  id: string | null;
  crmClientId: string;
  plataforma: string;
  login: string;
  url: string;
  // null = manter a senha atual; "" = apagar.
  senha: string | null;
  codigoVia: string;
  observacao: string | null;
};

function useInvalidarCofre(crmClientId: string | null) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["cofre-acessos", crmClientId] });
    qc.invalidateQueries({ queryKey: ["cofre-historico", crmClientId] });
  };
}

export function useCofreSalvar(crmClientId: string | null) {
  const invalidar = useInvalidarCofre(crmClientId);
  return useMutation({
    mutationFn: async (v: CofreSalvarInput) => {
      const { data, error } = await sbRpc("cofre_salvar", {
        _id: v.id, _crm_client_id: v.crmClientId, _plataforma: v.plataforma, _login: v.login,
        _url: v.url, _senha: v.senha, _codigo_via: v.codigoVia, _observacao: v.observacao,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: invalidar,
  });
}

export function useCofreApagar(crmClientId: string | null) {
  const invalidar = useInvalidarCofre(crmClientId);
  return useMutation({
    mutationFn: async (acessoId: string) => {
      const { error } = await sbRpc("cofre_apagar", { _acesso_id: acessoId });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useCofreCriarLink(crmClientId: string | null) {
  const invalidar = useInvalidarCofre(crmClientId);
  return useMutation({
    mutationFn: async (): Promise<{ token: string; expires_at: string }> => {
      const { data, error } = await sbRpc("cofre_criar_link", { _crm_client_id: crmClientId });
      if (error) throw error;
      const row = (data as { token: string; expires_at: string }[] | null)?.[0];
      if (!row) throw new Error("sem_link");
      return row;
    },
    onSuccess: invalidar,
  });
}

// ── Página pública do cliente (/acessos/:token) ──
export type CofreLinkInfo = { cliente_nome: string; agencia_nome: string | null; agencia_logo: string | null; cor: string | null; expira_em: string };

export async function cofreLinkInfo(token: string): Promise<CofreLinkInfo | null> {
  const { data, error } = await sbRpc("cofre_link_info", { _token: token });
  if (error) throw error;
  return (data as CofreLinkInfo[] | null)?.[0] ?? null;
}

export async function cofreEnviarPorLink(token: string, v: { plataforma: string; login: string; senha: string; codigoVia: string; observacao: string }) {
  const { error } = await sbRpc("cofre_enviar_por_link", {
    _token: token, _plataforma: v.plataforma, _login: v.login, _senha: v.senha,
    _codigo_via: v.codigoVia, _observacao: v.observacao,
  });
  if (error) throw error;
}

// Dias desde a última troca de senha (aviso de senha velha a partir de 90).
export function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
