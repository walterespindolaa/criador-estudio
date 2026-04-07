import { motion } from "framer-motion";
import { Kanban } from "lucide-react";

const columns = [
  { title: "Rascunho", color: "bg-muted", items: [] },
  { title: "Escrevendo", color: "bg-primary/10", items: [] },
  { title: "Revisando", color: "bg-secondary/10", items: [] },
  { title: "Pronto", color: "bg-secondary/20", items: [] },
];

const Criando = () => {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Estou Criando</h1>
        <p className="text-muted-foreground font-body mb-8">
          Seu pipeline de criação. Arraste os cards entre as colunas.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {columns.map((col) => (
            <div key={col.title} className="min-h-[300px]">
              <div className={`${col.color} rounded-xl px-4 py-2 mb-3`}>
                <h3 className="font-body font-semibold text-sm text-foreground">{col.title}</h3>
              </div>
              {col.items.length === 0 && (
                <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center">
                  <Kanban className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-body">
                    Arraste uma ideia pra cá
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Criando;
