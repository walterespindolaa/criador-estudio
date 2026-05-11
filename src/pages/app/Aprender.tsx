import { motion } from "framer-motion";
import { GraduationCap } from "lucide-react";

const Aprender = () => {
  return (
    <div className="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-display font-extrabold text-foreground mb-2">Aprender Mais</h1>
        <p className="text-muted-foreground font-body mb-8">
          Cursos e materiais bônus para acelerar seu crescimento.
        </p>

        <div className="bg-card rounded-xl p-12 shadow-warm border border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-display font-semibold text-foreground mb-2">
            Em breve! 🎓
          </p>
          <p className="text-muted-foreground font-body max-w-sm mx-auto">
            Estamos preparando conteúdos exclusivos para te ajudar a crescer.
            Fique de olho!
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Aprender;
