/**
 * TourProvider — cérebro do tour guiado.
 * - Auto-start na primeira visita de cada tela (persistido; nunca repete sozinho)
 * - startTour manual via botão "?" (HelpButton)
 * - step -1 = card de abertura (valueProp + benefícios); 0..N-1 = passos com spotlight
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { findTourByRoute, findTourById, type TourConfig } from "@/lib/tours/registry";
import { loadSeenTours, markTourSeen } from "@/lib/tours/progress";
import { TourOverlay } from "./TourOverlay";

type TourContextValue = {
  active: TourConfig | null;
  step: number;
  hasTourForRoute: (pathname: string) => boolean;
  startTour: (routeOrId?: string) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour precisa estar dentro de <TourProvider>");
  return ctx;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [active, setActive] = useState<TourConfig | null>(null);
  const [step, setStep] = useState(-1);
  const seenRef = useRef<Set<string>>(new Set());
  const [seenLoaded, setSeenLoaded] = useState(false);

  // Carrega o progresso uma vez por sessão
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    loadSeenTours(user.id).then(s => {
      if (alive) {
        seenRef.current = s;
        setSeenLoaded(true);
      }
    });
    return () => { alive = false; };
  }, [user?.id]);

  const begin = useCallback((tour: TourConfig) => {
    setActive(tour);
    setStep(-1);
  }, []);

  // Auto-start: primeira visita da tela (depois que soubermos o que já foi visto)
  useEffect(() => {
    if (!seenLoaded || active) return;
    const tour = findTourByRoute(location.pathname);
    if (tour && !seenRef.current.has(tour.id)) {
      const id = window.setTimeout(() => begin(tour), 700); // deixa a tela montar
      return () => window.clearTimeout(id);
    }
  }, [location.pathname, seenLoaded, active, begin]);

  const finish = useCallback(
    (completed: boolean) => {
      if (!active) return;
      seenRef.current.add(active.id);
      if (user?.id) markTourSeen(user.id, active.id, completed, step);
      setActive(null);
      setStep(-1);
    },
    [active, step, user?.id],
  );

  const startTour = useCallback(
    (routeOrId?: string) => {
      const tour =
        (routeOrId && (findTourById(routeOrId) || findTourByRoute(routeOrId))) ||
        findTourByRoute(location.pathname);
      if (tour) begin(tour);
    },
    [location.pathname, begin],
  );

  const next = useCallback(() => {
    if (!active) return;
    if (step >= active.steps.length - 1) finish(true);
    else setStep(s => s + 1);
  }, [active, step, finish]);

  const prev = useCallback(() => setStep(s => Math.max(-1, s - 1)), []);
  const skip = useCallback(() => finish(false), [finish]);

  const hasTourForRoute = useCallback((p: string) => Boolean(findTourByRoute(p)), []);

  return (
    <TourContext.Provider value={{ active, step, hasTourForRoute, startTour, next, prev, skip }}>
      {children}
      {active && <TourOverlay tour={active} step={step} onNext={next} onPrev={prev} onSkip={skip} />}
    </TourContext.Provider>
  );
}
