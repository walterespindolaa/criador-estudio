/**
 * TourProvider, cérebro do tour guiado.
 * - Auto-start na primeira visita de cada tela (persistido; nunca repete sozinho)
 * - startTour manual via botão "?" (HelpButton)
 * - step -1 = card de abertura (valueProp + benefícios); 0..N-1 = passos com spotlight
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  areaForPath,
  findTourByRoute,
  findTourById,
  TRAINING_SEQUENCES,
  type TourConfig,
} from "@/lib/tours/registry";
import { loadSeenTours, markTourSeen } from "@/lib/tours/progress";
import { TourOverlay } from "./TourOverlay";

type TourContextValue = {
  active: TourConfig | null;
  step: number;
  hasTourForRoute: (pathname: string) => boolean;
  startTour: (routeOrId?: string) => void;
  /** Inicia um tour uma única vez (pra tours de modal, ex: editor de post). */
  startTourOnce: (id: string) => void;
  /** Tour completo da área atual (criador ou gestor), tela por tela. */
  startTraining: () => void;
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [active, setActive] = useState<TourConfig | null>(null);
  const [step, setStep] = useState(-1);
  const seenRef = useRef<Set<string>>(new Set());
  const [seenLoaded, setSeenLoaded] = useState(false);
  /** fila do modo treinamento: ids que ainda faltam */
  const trainingRef = useRef<string[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

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
    // Resolve os passos pro dispositivo atual: alvos/textos mobile e passos exclusivos.
    // Assim o tour NUNCA aponta pra um elemento que não existe nesta versão do layout.
    const isMobile = window.innerWidth < 768;
    const steps = tour.steps
      .filter(s => !(isMobile && s.skipOnMobile) && !(!isMobile && s.skipOnDesktop))
      .map(s => ({
        ...s,
        target: isMobile && s.mobileTarget ? s.mobileTarget : s.target,
        body: isMobile && s.mobileBody ? s.mobileBody : s.body,
        // O controle que precisa ser aberto antes do alvo existir (aba, acordeão).
        openFirst: isMobile && s.mobileOpenFirst ? s.mobileOpenFirst : s.openFirst,
      }));
    setActive({ ...tour, steps });
    setStep(-1);
  }, []);

  // Modo treinamento: quando a navegação chega na rota do próximo tour da fila, inicia.
  // IMPORTANTE: o pendingId só é limpo DENTRO do timer. Limpar antes re-dispara o efeito
  // e o cleanup cancela o próprio timer (bug que travava o tour completo na 2ª tela).
  useEffect(() => {
    if (!pendingId) return;
    const tour = findTourById(pendingId);
    if (!tour || tour.route !== location.pathname) return;
    const id = window.setTimeout(() => {
      setPendingId(null);
      begin(tour);
    }, 400);
    return () => window.clearTimeout(id);
  }, [pendingId, location.pathname, begin]);

  // Auto-start: primeira visita da tela (depois que soubermos o que já foi visto)
  useEffect(() => {
    if (!seenLoaded || active || pendingId) return;
    const tour = findTourByRoute(location.pathname);
    if (tour && !seenRef.current.has(tour.id)) {
      const id = window.setTimeout(() => begin(tour), 400); // deixa a tela montar
      return () => window.clearTimeout(id);
    }
  }, [location.pathname, seenLoaded, active, pendingId, begin]);

  const finish = useCallback(
    (completed: boolean) => {
      if (!active) return;
      seenRef.current.add(active.id);
      if (user?.id) markTourSeen(user.id, active.id, completed, step);
      setActive(null);
      setStep(-1);

      // Treinamento: pulou = sai do modo; concluiu = avança pra próxima tela
      if (!completed) {
        trainingRef.current = null;
        return;
      }
      const queue = trainingRef.current;
      if (queue && queue.length > 0) {
        const nextId = queue.shift()!;
        const nextTour = findTourById(nextId);
        if (nextTour) {
          setPendingId(nextId);
          navigate(nextTour.route);
        } else {
          trainingRef.current = null;
        }
        if (queue.length === 0) trainingRef.current = null;
      }
    },
    [active, step, user?.id, navigate],
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

  const startTourOnce = useCallback(
    (id: string) => {
      if (!seenLoaded || active || seenRef.current.has(id)) return;
      const tour = findTourById(id);
      if (tour) begin(tour);
    },
    [seenLoaded, active, begin],
  );

  const startTraining = useCallback(() => {
    const area = areaForPath(location.pathname);
    const ids = [...TRAINING_SEQUENCES[area]];
    const firstId = ids.shift();
    if (!firstId) return;
    const first = findTourById(firstId);
    if (!first) return;
    trainingRef.current = ids;
    if (first.route === location.pathname) {
      begin(first);
    } else {
      setPendingId(firstId);
      navigate(first.route);
    }
  }, [location.pathname, navigate, begin]);

  const next = useCallback(() => {
    if (!active) return;
    if (step >= active.steps.length - 1) finish(true);
    else setStep(s => s + 1);
  }, [active, step, finish]);

  const prev = useCallback(() => setStep(s => Math.max(-1, s - 1)), []);
  const skip = useCallback(() => finish(false), [finish]);

  const hasTourForRoute = useCallback((p: string) => Boolean(findTourByRoute(p)), []);

  return (
    <TourContext.Provider value={{ active, step, hasTourForRoute, startTour, startTourOnce, startTraining, next, prev, skip }}>
      {children}
      {active && <TourOverlay tour={active} step={step} onNext={next} onPrev={prev} onSkip={skip} />}
    </TourContext.Provider>
  );
}
