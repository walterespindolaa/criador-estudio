import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  moodboardSectionKeys: ReadonlyArray<string>;
  renderGuided: (sectionKey: string) => ReactNode;
};

export function MoodboardSection({ moodboardSectionKeys, renderGuided }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Moodboard</h2>
          <p className="text-sm text-muted-foreground font-body">
            Defina a direção criativa e emocional da sua marca.
          </p>
        </div>
      </div>

      {moodboardSectionKeys.map(key => (
        <div key={key}>{renderGuided(key)}</div>
      ))}
    </motion.div>
  );
}
