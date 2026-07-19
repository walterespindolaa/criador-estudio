import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sticker, type StickerName } from "@/components/shared/Sticker";

/* ═══════════════════════════════════════════════════════════════════════════
   A COMEMORAÇÃO

   Overlay rápido pra marcar uma vitória (post publicado, meta batida). O selo
   grande no centro, alguns selos menores espalhados como confete, e some sozinho
   em ~2.5s (ou ao tocar). É tempero: aparece, celebra, sai. Não trava o fluxo.
   ═══════════════════════════════════════════════════════════════════════════ */

type Confete = { name: StickerName; style: React.CSSProperties; rotate: number };

const CONFETES: Confete[] = [
  { name: "selo-social-club-amarelo", style: { top: "14%", left: "12%", width: 54 }, rotate: -14 },
  { name: "selo-social-club-verde", style: { top: "18%", right: "14%", width: 62 }, rotate: 12 },
  { name: "selo-sem-formula", style: { bottom: "20%", left: "16%", width: 50 }, rotate: 10 },
  { name: "selo-social-club-azul", style: { bottom: "16%", right: "16%", width: 52 }, rotate: -8 },
  { name: "selo-da-ideia-ao-post-rosa", style: { top: "40%", left: "6%", width: 46 }, rotate: -18 },
  { name: "selo-social-club-amarelo", style: { top: "42%", right: "7%", width: 46 }, rotate: 16 },
];

export function StickerCelebration({
  show,
  title = "Publicado!",
  subtitle,
  onDone,
}: {
  show: boolean;
  title?: string;
  subtitle?: string;
  onDone?: () => void;
}) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onDone?.(), 2500);
    return () => clearTimeout(t);
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => onDone?.()}
          className="fixed inset-0 z-[120] grid place-items-center overflow-hidden bg-black/25 px-6 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          {CONFETES.map((c, i) => (
            <motion.div
              key={`${c.name}-${i}`}
              className="pointer-events-none absolute"
              style={c.style}
              initial={{ opacity: 0, scale: 0.4, rotate: c.rotate - 20 }}
              animate={{ opacity: 1, scale: 1, rotate: c.rotate }}
              transition={{ delay: 0.05 * i, type: "spring", stiffness: 260, damping: 16 }}
            >
              <Sticker name={c.name} className="w-full drop-shadow-lg" />
            </motion.div>
          ))}

          <motion.div
            className="relative flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 16, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
          >
            <Sticker
              name="selo-da-ideia-ao-post-amarelo"
              className="w-[170px] drop-shadow-[0_12px_24px_rgba(0,0,0,0.22)] sm:w-[200px]"
            />
            <h3 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-3xl">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1.5 max-w-xs font-body text-sm leading-relaxed text-white/90 drop-shadow">
                {subtitle}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default StickerCelebration;
