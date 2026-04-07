import { motion } from "framer-motion";
import { Lightbulb, FileText, CheckCircle2, TrendingUp } from "lucide-react";

const stats = [
  { label: "Ideias capturadas", value: "0", icon: Lightbulb, color: "text-primary" },
  { label: "Em criação", value: "0", icon: FileText, color: "text-secondary" },
  { label: "Publicados", value: "0", icon: CheckCircle2, color: "text-secondary" },
  { label: "Esta semana", value: "0", icon: TrendingUp, color: "text-primary" },
];

const Dashboard = () => {
  return (
    <div className="max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Olá, criador! 👋
        </h1>
        <p className="text-muted-foreground font-body mb-8">
          Aqui está um resumo da sua produção criativa.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="bg-card rounded-2xl p-6 shadow-warm border border-border"
            >
              <stat.icon className={`h-5 w-5 ${stat.color} mb-3`} />
              <p className="text-3xl font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground font-body mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
          <p className="text-lg font-display font-semibold text-foreground mb-2">
            Seu estúdio está pronto! 🎨
          </p>
          <p className="text-muted-foreground font-body max-w-md mx-auto">
            Comece capturando sua primeira ideia. Pode ser uma frase, um tema, um insight —
            tudo vale. Depois, leve ela pro kanban e transforme em conteúdo.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
