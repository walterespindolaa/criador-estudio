import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";

const Plano = () => {
  return (
    <div className="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Meu Plano</h1>
        <p className="text-muted-foreground font-body mb-8">
          Planeje sua semana de conteúdo e acompanhe seus hábitos criativos.
        </p>

        <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-display font-semibold text-foreground mb-2">
            Monte seu plano semanal 📅
          </p>
          <p className="text-muted-foreground font-body max-w-sm mx-auto">
            Defina quais dias você vai criar, revisar e publicar.
            Consistência é mais importante que perfeição.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Plano;
