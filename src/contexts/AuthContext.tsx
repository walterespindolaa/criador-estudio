import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
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
  signUp: (email: string, password: string, name: string, meta?: Record<string, unknown>) => Promise<{ error: any; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string, meta?: Record<string, unknown>) => {
    const intencao = meta?.account_intent;
    /* Cada tipo de conta pousa no lugar dele: social mídia no onboarding da
       agência, parceiro direto na fila de demandas (ele não tem onboarding de
       criador nem de agência) e criador no onboarding normal. */
    const destino = intencao === "manager" ? "/comecar-agencia"
      : intencao === "parceiro" ? "/socialmidia/demandas"
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
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
