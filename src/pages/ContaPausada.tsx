import { PauseCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function ContaPausada() {
  const navigate = useNavigate();
  const sair = () => { void supabase.auth.signOut().then(() => navigate("/login")); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
          <PauseCircle className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-display font-extrabold text-foreground">Sua conta está pausada</h1>
        <p className="text-sm font-body text-muted-foreground mt-3 leading-relaxed">
          O acesso a esta conta foi pausado pela sua social mídia. Enquanto estiver pausada, as ferramentas ficam indisponíveis e seus dados ficam guardados.
        </p>
        <p className="text-sm font-body text-foreground mt-4 font-medium">
          Quer voltar a usar? Fale com a sua social mídia pra reativar.
        </p>
        <Button variant="outline" onClick={sair} className="mt-6 gap-2">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );
}
