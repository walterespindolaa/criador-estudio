// Cliente Supabase do Cria (projeto próprio, sem Lovable desde 13/10/2026).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Fallback fixo (a URL e a chave anon são públicas) pra o app não quebrar caso a
// env do build não seja injetada. A env, quando existe, tem prioridade.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ecbzfjzoqidowrsfsfih.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYnpmanpvcWlkb3dyc2ZzZmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTc0NTMsImV4cCI6MjEwNjQzMzQ1M30.ia4C-QAjE3tfbwfK93gCBpPrXi9CK6axt1J2V53BVgY";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Mesmo localStorage de antes: quem já está logado continua logado.
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Base das edge functions e a chave anon, pra chamadas via fetch direto (ex.: baixar
// binário/zip lendo os headers da resposta, o que o supabase.functions.invoke não expõe).
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
export const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;