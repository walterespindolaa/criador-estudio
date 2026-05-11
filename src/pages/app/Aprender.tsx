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
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-sm shrink-0">
            <GraduationCap className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Aprender Mais</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">
              Cursos e materiais bônus para acelerar seu crescimento.
            </p>
          </div>
        </div>

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
