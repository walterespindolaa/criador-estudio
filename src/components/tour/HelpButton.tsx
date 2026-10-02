/**
 * Botão "?" da barra superior, reabre o tour da tela atual quando quiser.
 * Desde 02/10/2026 também abre o vídeo tutorial da tela (quando existe) e a
 * página com todos os tutoriais.
 */
import { CircleHelp, Clapperboard, MonitorPlay, PlayCircle, Route } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTour } from "./TourProvider";
import { duracaoTexto, tutorialDaRota, useCatalogoTutoriais } from "@/hooks/useTutoriais";

export function HelpButton({ light = false }: { light?: boolean }) {
  const { startTour, startTraining, hasTourForRoute } = useTour();
  const location = useLocation();
  const available = hasTourForRoute(location.pathname);
  const navigate = useNavigate();
  const { data: tutoriais } = useCatalogoTutoriais();
  const video = tutorialDaRota(tutoriais, location.pathname);
  const baseTutoriais = location.pathname.startsWith("/socialmidia") ? "/socialmidia/tutoriais" : "/app/tutoriais";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Ajuda e tutorial"
          className={
            light
              ? "rounded-xl p-2 text-white/85 transition-colors hover:bg-white/15 hover:text-white"
              : "rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          }
        >
          <CircleHelp className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {video && (
          <>
            <DropdownMenuItem onClick={() => navigate(`${baseTutoriais}?v=${video.slug}`)} className="gap-2 font-body">
              <MonitorPlay className="h-4 w-4 text-[#E8458B]" />
              <div className="flex flex-col">
                <span className="font-semibold">Assistir o vídeo desta tela</span>
                <span className="text-[11px] text-muted-foreground">{video.titulo}{video.duracao_s ? ` · ${duracaoTexto(video.duracao_s)}` : ""}</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          disabled={!available}
          onClick={() => startTour()}
          className="gap-2 font-body"
        >
          <PlayCircle className="h-4 w-4" />
          {available ? "Ver tutorial desta tela" : "Tutorial em breve nesta tela"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => startTraining()} className="gap-2 font-body">
          <Route className="h-4 w-4" />
          <div className="flex flex-col">
            <span>Fazer o tour completo</span>
            <span className="text-[11px] text-muted-foreground">Todas as telas, uma por uma</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(baseTutoriais)} className="gap-2 font-body">
          <Clapperboard className="h-4 w-4" />
          Ver todos os tutoriais
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default HelpButton;
