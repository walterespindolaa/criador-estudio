import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /**
   * needsConfirmation: true quando o projeto EXIGE confirmação por e-mail (o signUp
   * volta sem sessão). Com o auto-confirm ligado, a sessão já vem e a pessoa entra
   * direto, então a tela de "confirme seu e-mail" não pode aparecer, senão promete
   * um e-mail que nunca é enviado e trava o usuário numa tela morta.
   */
  signUp: (email: string, password: string, name: string, meta?: Record<string, unknown>) => Promise<{ error: AuthError | null; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  /** Entrar ou criar conta pelo Google. No cadastro, `meta` leva as escolhas da
   *  tela (tipo de conta, plano, origem), aplicadas na volta em /entrar-google. */
  entrarComGoogle: (meta?: Record<string, string>) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

/* Escolhas do cadastro guardadas no aparelho enquanto a pessoa está no Google.
   A tela /entrar-google lê e apaga. Vencem em 1 hora. */
export const CHAVE_CADASTRO_GOOGLE = "cria-cadastro-google";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      /* SÓ TROCA O OBJETO `user` QUANDO A PESSOA MUDA (pente fino 23/09/2026).
         A cada TOKEN_REFRESHED (a cada ~50 min) o Supabase entrega um objeto
         novo com o mesmo usuário; trocar o `user` aqui re-renderizava os 85+
         consumidores de useAuth e disparava de novo todo efeito com [user]
         nas dependências (notificações, prefetch, tour...). Mesmo id = mesmo
         objeto; a sessão (token) continua atualizando normalmente. */
      setUser((atual) => {
        const novo = session?.user ?? null;
        if (atual && novo && atual.id === novo.id && atual.email === novo.email
            && JSON.stringify(atual.user_metadata) === JSON.stringify(novo.user_metadata)) return atual;
        return novo;
      });
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, meta?: Record<string, unknown>) => {
    const intencao = meta?.account_intent;
    /* Cada tipo de conta pousa no lugar dele: social mídia no onboarding da
       agência, parceiro no onboarding de prestador (25/10/2026; antes caía
       direto na fila de demandas vazia) e criador no onboarding normal. */
    const destino = intencao === "manager" ? "/comecar-agencia"
      : intencao === "parceiro" ? "/comecar-parceiro"
      : "/onboarding";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, ...(meta ?? {}) },
        emailRedirectTo: `${window.location.origin}${destino}`,
      },
    });
    // Sem sessão de volta = o projeto exige confirmação por e-mail. Com sessão, a
    // conta já está ativa e o fluxo segue direto pro app.
    return { error, needsConfirmation: !error && !data?.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    /* LOGIN SEMPRE ABRE NA PRÓPRIA CONTA (Gabriela, 19/10/2026). A conta de
       equipe escolhida antes ficava salva e voltava no login seguinte. Recarregar
       a página continua mantendo a escolha; só o login novo zera. */
    if (!error) { try { localStorage.removeItem("cf_active_account"); } catch { /* ignore */ } }
    return { error };
  }, []);

  /* ENTRAR COM O GOOGLE (Walter, 25/11/2026: "fizesse login ou cadastro tanto
     com a conta do google quanto manualmente"). O Supabase junta sozinho a conta
     do Google com a de e-mail quando o e-mail é o mesmo (doc oficial: identity
     linking automático), então quem já tem conta cai nela com tudo dentro.
     A volta é sempre em /entrar-google, que decide o destino. */
  const entrarComGoogle = useCallback(async (meta?: Record<string, string>) => {
    try {
      if (meta) localStorage.setItem(CHAVE_CADASTRO_GOOGLE, JSON.stringify({ meta, em: Date.now() }));
      else localStorage.removeItem(CHAVE_CADASTRO_GOOGLE);
      // Igual ao login por senha: entrar de novo sempre abre na própria conta.
      localStorage.removeItem("cf_active_account");
    } catch { /* modo privado: a conta nasce como criador, que é o padrão */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/entrar-google` },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    try { localStorage.removeItem("cf_active_account"); } catch { /* ignore */ }
    queryClient.clear();
  }, [queryClient]);

  // Valor memoizado: sem isto o Provider criava um objeto novo a cada render
  // e todo consumidor re-renderizava junto, mesmo sem nada ter mudado.
  const value = useMemo(() => ({ user, session, loading, signUp, signIn, entrarComGoogle, signOut }), [user, session, loading, signUp, signIn, entrarComGoogle, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
