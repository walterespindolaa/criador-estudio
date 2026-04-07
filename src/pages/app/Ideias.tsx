import { motion } from "framer-motion";
import { Plus, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

const Ideias = () => {
  return (
    <div className="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Minhas Ideias</h1>
            <p className="text-muted-foreground font-body mt-1">
              Seu banco de inspirações. Anote tudo que vier à mente.
            </p>
          </div>
          <Button variant="hero" size="default">
            <Plus className="h-4 w-4 mr-1" /> Nova Ideia
          </Button>
        </div>

        {/* Empty state */}
        <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Lightbulb className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-display font-semibold text-foreground mb-2">
            Sua primeira ideia está te esperando 💡
          </p>
          <p className="text-muted-foreground font-body max-w-sm mx-auto mb-6">
            Anota aquela ideia que veio no banho, no ônibus, ou no meio da madrugada.
            Aqui é o lugar seguro pra ela.
          </p>
          <Button variant="hero">
            <Plus className="h-4 w-4 mr-1" /> Anotar minha primeira ideia
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Ideias;
