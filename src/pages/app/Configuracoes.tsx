import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";

const Configuracoes = () => {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground font-body mb-8">
          Gerencie sua conta e preferências.
        </p>

        <div className="bg-card rounded-2xl p-8 shadow-warm border border-border space-y-6">
          <div>
            <h3 className="font-display font-semibold text-foreground mb-1">Perfil</h3>
            <p className="text-sm text-muted-foreground font-body">
              {profile?.name} • {profile?.niche || "Sem nicho definido"} • Plano: {profile?.plan || "free"}
            </p>
          </div>
          <div className="border-t border-border pt-6">
            <Button variant="outline" className="font-body" onClick={handleSignOut}>
              Sair da conta
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Configuracoes;
